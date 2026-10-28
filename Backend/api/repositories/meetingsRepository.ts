import {CorpusSearchFilters} from "../../models/CorpusSearchFilters";
import {
    AggregationsCompositeAggregate,
    AggregationsCompositeAggregateKey,
    ClosePointInTimeResponse,
    OpenPointInTimeResponse,
    SearchResponse,
    SearchTotalHits
} from "@elastic/elasticsearch/lib/api/types";
import esClient from "../database/elasticsearch";
import utils from "../../utils/utils";
import {GetPageQueryParams} from "../../models/GetPageQueryParams";
import meetingsIndexQueryBuildersUtils from "../../utils/meetingsIndexQueryBuildersUtils";
import advancedQueryBuilder, {MATCHED_SEGMENTS, SHOWN_SENTENCES} from "../../utils/advancedQueryBuilder";
import searchStrategySelector from "../../strategies/searchStrategySelector";
import {MeetingsIndexDocument} from "../../models/MeetingsIndexDocument";
import {MeetingData} from "../../models/MeetingData";
import {SentenceData} from "../../models/SentenceData";
import {HtmlElementBuilder} from "../../builders/HtmlElementBuilder";
import {Sentence} from "../../models/Sentence";
import {Word} from "../../models/Word";
import {UniqueSpeakersAggregation} from "../../models/UniqueSpeakersAggregation";
import {AttendeesIndexDocument} from "../../models/AttendeesIndexDocument";
import {MeetingSpeaker} from "../../models/MeetingSpeaker";
import {Highlight} from "../../models/Highlight";
import {Coordinate, UtteranceBucket} from "../../models/UtteranceBucket";
import ASCIIFolder from "fold-to-ascii";
import {OriginalLanguageSearchStrategy, TranslatedLanguageSearchStrategy} from "../../strategies/SearchStrategy";


const getAllMeetings = async (filters: CorpusSearchFilters, page: number) => {

    const allMeetingsQuery: any = meetingsIndexQueryBuildersUtils.buildAllMeetingsQuery(filters);

    const meetingsIndexSearchResponse: SearchResponse<MeetingsIndexDocument> = await esClient.search({
        index: process.env.MEETINGS_INDEX_NAME || 'meetings-index',

        _source: ["id", "date", "titles", "agendas", "corpus"],
        query: allMeetingsQuery,
        size: 10,
        from: (page - 1) * 10,
        sort: utils.parseSort(filters.sort!)

    });

    const relevantMeetingData: MeetingData[] = [];
    for (const meeting of meetingsIndexSearchResponse.hits.hits) {
        if (!meeting._source) {
            continue;
        }

        relevantMeetingData.push({
            id: meeting._source.id,
            date: meeting._source.date,
            titles: meeting._source.titles,
            agendas: meeting._source.agendas,
            corpus: meeting._source.corpus,
            sentences: [],
            totalSentences: 0,
        } as MeetingData);
    }

    return {
        meetings: relevantMeetingData,
        total: (meetingsIndexSearchResponse.hits.total as SearchTotalHits).value,
    };
}


const MAX_MATCHING_MEETINGS = 10000;

// remove inner_hits, we only need the meeting ids
const stripInnerHits = (query: any): any => {
    if (Array.isArray(query)) {
        return query.map(stripInnerHits);
    }
    if (query && typeof query === "object") {
        const result: any = {};
        for (const [key, value] of Object.entries(query)) {
            if (key !== "inner_hits") {
                result[key] = stripInnerHits(value);
            }
        }
        return result;
    }
    return query;
}

// ids of all meetings that match the getPage query (max MAX_MATCHING_MEETINGS)
const getMatchingMeetingIds = async (queryParams: GetPageQueryParams): Promise<{ ids: string[], truncated: boolean }> => {

    // same query as getPage so the map shows the same meetings as the results
    const query: any = stripInnerHits(meetingsIndexQueryBuildersUtils.buildMeetingsPageQuery(queryParams));

    const response: SearchResponse<MeetingsIndexDocument> = await esClient.search({
        index: process.env.MEETINGS_INDEX_NAME || 'meetings-index',
        _source: ["id"],
        query: query,
        size: MAX_MATCHING_MEETINGS,
        track_total_hits: true
    });

    const ids: string[] = response.hits.hits
        .map(hit => hit._source?.id)
        .filter((id): id is string => !!id);
    const total: number = (response.hits.total as SearchTotalHits).value;

    return {ids, truncated: total > ids.length};
}


export type TimelineInterval = "year" | "month";
export type TimelineUnit = "meetings" | "segments" | "sentences";

export interface TimelineBucket {
    date: string;   // yyyy-MM-dd
    count: number;  // matching meetings/segments/sentences
    total: number;  // all of them in this period
}

// meetings per year/month, count = matching meetings (without the date filter), total = all meetings
const getTimeline = async (queryParams: GetPageQueryParams, interval: TimelineInterval, unit: TimelineUnit = "meetings"): Promise<TimelineBucket[]> => {

    if (unit === "sentences") return getSentencesTimeline(queryParams, interval);
    if (unit === "segments") return getSegmentsTimeline(queryParams, interval);

    const withoutDates: GetPageQueryParams = {
        ...queryParams,
        filters: {...queryParams.filters, dateFrom: undefined, dateTo: undefined}
    };
    const histogram = {
        timeline: {
            date_histogram: {field: "date", calendar_interval: interval, format: "yyyy-MM-dd", min_doc_count: 0}
        }
    };
    const index: string = process.env.MEETINGS_INDEX_NAME || 'meetings-index';

    const [matching, all] = await Promise.all([
        esClient.search({
            index,
            size: 0,
            query: stripInnerHits(meetingsIndexQueryBuildersUtils.buildMeetingsPageQuery(withoutDates)),
            aggs: histogram
        }),
        esClient.search({
            index,
            size: 0,
            query: {bool: {filter: [{terms: {"corpus": (queryParams.filters.corpora ?? "").split(",")}}]}},
            aggs: histogram
        })
    ]);

    const bucketsOf = (response: any): { key_as_string: string, doc_count: number }[] =>
        response.aggregations?.timeline?.buckets ?? [];

    const matchingCounts = new Map<string, number>(bucketsOf(matching).map(b => [b.key_as_string, b.doc_count]));
    return bucketsOf(all).map(bucket => ({
        date: bucket.key_as_string,
        count: matchingCounts.get(bucket.key_as_string) ?? 0,
        total: bucket.doc_count
    }));
}


// sentences per year/month, a sentence counts only if it matches all the conditions by itself
// segments (paragraphs) per year/month, a segment counts only if it matches all the conditions by itself
const getSegmentsTimeline = async (queryParams: GetPageQueryParams, interval: TimelineInterval): Promise<TimelineBucket[]> => {

    const languages: string[] = (queryParams.filters.languages ?? "").split(",");
    const matching: any = queryParams.advanced
        ? advancedQueryBuilder.buildAdvancedSegmentQuery(queryParams.advanced, languages)
        : advancedQueryBuilder.buildBasicSegmentQuery(queryParams, languages);

    const response: any = await esClient.search({
        index: process.env.MEETINGS_INDEX_NAME || 'meetings-index',
        size: 0,
        query: {bool: {filter: [{terms: {"corpus": (queryParams.filters.corpora ?? "").split(",")}}]}},
        aggs: {
            timeline: {
                date_histogram: {field: "date", calendar_interval: interval, format: "yyyy-MM-dd", min_doc_count: 0},
                aggs: {
                    segments: {
                        nested: {path: "segments"},
                        aggs: {
                            all: {filter: {terms: {"segments.original_language": languages}}},
                            matching: {filter: matching}
                        }
                    }
                }
            }
        }
    });

    return (response.aggregations?.timeline?.buckets ?? []).map((bucket: any) => ({
        date: bucket.key_as_string,
        count: bucket.segments.matching.doc_count,
        total: bucket.segments.all.doc_count
    }));
}


const getSentencesTimeline = async (queryParams: GetPageQueryParams, interval: TimelineInterval): Promise<TimelineBucket[]> => {

    const languages: string[] = (queryParams.filters.languages ?? "").split(",");
    const inLanguages: any = {
        nested: {path: "sentences.translations", query: {terms: {"sentences.translations.lang.keyword": languages}}}
    };
    const conditions: any[] = meetingsIndexQueryBuildersUtils.buildSentenceConditions(queryParams)
        .map(condition => ({nested: {path: "sentences.translations", query: condition}}));
    const topics: any | undefined = meetingsIndexQueryBuildersUtils.buildSentenceTopicsClause(queryParams.capTopics);

    const response: any = await esClient.search({
        index: process.env.MEETINGS_INDEX_NAME || 'meetings-index',
        size: 0,
        query: {bool: {filter: [{terms: {"corpus": (queryParams.filters.corpora ?? "").split(",")}}]}},
        aggs: {
            timeline: {
                date_histogram: {field: "date", calendar_interval: interval, format: "yyyy-MM-dd", min_doc_count: 0},
                aggs: {
                    sentences: {
                        nested: {path: "sentences"},
                        aggs: {
                            all: {filter: inLanguages},
                            matching: {
                                filter: queryParams.advanced
                                    // advanced search is checked on each sentence
                                    ? advancedQueryBuilder.buildAdvancedSentenceQuery(queryParams.advanced, languages)
                                    : {bool: {must: [inLanguages, ...conditions, ...(topics ? [topics] : [])]}}
                            }
                        }
                    }
                }
            }
        }
    });

    return (response.aggregations?.timeline?.buckets ?? []).map((bucket: any) => ({
        date: bucket.key_as_string,
        count: bucket.sentences.matching.doc_count,
        total: bucket.sentences.all.doc_count
    }));
}


const toSentenceData = (sentence: any): SentenceData => ({
    lang: sentence._source.lang,
    original: sentence._source.original,
    text: sentence._source.text,
    speaker: sentence._source.speaker,
    words: sentence._source.words,
    highlights: sentence.highlight
});

const SHOWN_SENTENCES_LIMIT = 10;

// shown sentences of the advanced search (on segment level only the ones from matching segments)
const advancedShownSentences = (meeting: any): { sentences: SentenceData[], totalSentences: number } => {
    let hits: any[] = meeting.inner_hits?.[SHOWN_SENTENCES]?.hits.hits ?? [];
    let total: number = (meeting.inner_hits?.[SHOWN_SENTENCES]?.hits.total as SearchTotalHits)?.value ?? 0;

    const segments = meeting.inner_hits?.[MATCHED_SEGMENTS];
    if (segments) {
        const ids = new Set(segments.hits.hits.map((segment: any) => segment._source.id));
        hits = hits.filter(hit => ids.has(hit._source.segment_id));
        total = hits.length;
    }

    return {
        sentences: hits.slice(0, SHOWN_SENTENCES_LIMIT)
            .map(hit => hit.inner_hits?.["sentences.translations"]?.hits.hits[0])
            .filter(translation => translation)
            .map(toSentenceData),
        totalSentences: total
    };
};

const getPage = async (queryParams: GetPageQueryParams) => {

    // close ES point in time if page is 1 and point in time is provided
    if (queryParams.page === 1 && queryParams.pitId) {
        await esClient.closePointInTime({id: queryParams.pitId});
    }


    const esSearchRequestBody: any = {
        _source: ["id", "date", "titles", "agendas", "corpus"],

        query: meetingsIndexQueryBuildersUtils.buildMeetingsPageQuery(queryParams),

        size: 10,
        sort: utils.parseSort(queryParams.filters!.sort!),
    }

    // Open point in time if page is 1 and add it to the request body
    let pointInTime: any;
    if (queryParams.page === 1) {
        pointInTime = await esClient.openPointInTime({
            index: process.env.MEETINGS_INDEX_NAME || 'meetings-index',
            keep_alive: '30m'
        })
    } else {
        pointInTime = {id: queryParams.pitId};
    }
    esSearchRequestBody.pit = pointInTime;

    if (queryParams.page > 1 && queryParams.searchAfterScore && queryParams.searchAfterDate) {
        // Add search after params if provided
        esSearchRequestBody.search_after = utils.parseSearchAfterParams(
            queryParams.filters!.sort!,
            queryParams.searchAfterScore!,
            queryParams.searchAfterDate,
            queryParams.searchAfterIndex!
        );
    }


    const meetingsIndexSearchResponse: SearchResponse<MeetingsIndexDocument> = await esClient.search(esSearchRequestBody);

    const relevantMeetingData: MeetingData[] = [];
    for (const meeting of meetingsIndexSearchResponse.hits.hits) {
        if (!meeting._source) {
            continue;
        }

        relevantMeetingData.push({
                id: meeting._source.id,
                date: meeting._source.date,
                titles: meeting._source.titles,
                agendas: meeting._source.agendas,
                corpus: meeting._source.corpus,
                ...(queryParams.advanced ? advancedShownSentences(meeting) : {
                    sentences: meeting.inner_hits?.["sentences.translations"].hits.hits.map(toSentenceData) ?? [],
                    totalSentences: meeting.inner_hits?.["sentences.translations"]?.hits?.total ?
                        (meeting.inner_hits["sentences.translations"].hits.total as SearchTotalHits).value : 0,
                })
            } as MeetingData
        );
    }

    return {
        meetings: relevantMeetingData,
        searchAfterScore: meetingsIndexSearchResponse.hits.hits[meetingsIndexSearchResponse.hits.hits.length - 1]?._score ?? null,
        searchAfterDate: meetingsIndexSearchResponse.hits.hits[meetingsIndexSearchResponse.hits.hits.length - 1]?._source!.date ?? null,
        searchAfterIndex: meetingsIndexSearchResponse.hits.hits[meetingsIndexSearchResponse.hits.hits.length - 1]?.sort![meetingsIndexSearchResponse.hits.hits[meetingsIndexSearchResponse.hits.hits.length - 1].sort!.length - 1] ?? null,
        pitId: pointInTime.id,
        page: queryParams.page,
        total: (meetingsIndexSearchResponse.hits.total as SearchTotalHits).value
    }
}


const getMeetingAsText = async (meetingId: string, pageLang: string, translationLang: string) => {

    const meetingsIndexSearchResponse: SearchResponse<MeetingsIndexDocument> = await esClient.search({
        index: process.env.MEETINGS_INDEX_NAME || 'meetings-index',
        _source: ["id", "date", "titles", "agendas", "sentences"],

        query: {
            term: {
                "id": meetingId
            }
        },
        size: 1

    });

    const searchedMeeting = meetingsIndexSearchResponse.hits.hits[0]._source!;


    // Build a meeting title element
    const meetingTitle: string = searchedMeeting.titles.find(title => title.lang === pageLang)?.title ||
        utils.getNoTitleMessage(pageLang);
    const meetingTitleHtmlElement: string = new HtmlElementBuilder('h2')
        .withText(meetingTitle)
        .withAttribute('class', 'title-text')
        .buildString()

    // Build agenda title element
    const agendaTitleHtmlElement: string = new HtmlElementBuilder('h3')
        .withAttribute('class', 'agendas-title')
        .withText(utils.getAgendaTitle(translationLang))
        .buildString();

    // Build agenda items elements
    const agendaItems = searchedMeeting.agendas.find(agenda => agenda.lang === translationLang)?.items.map(item => item.text) ||
        utils.getNoAgendaMessage(translationLang);
    const agendaItemsHtmlElement: string = agendaItems
        .map(itemText => {
            return new HtmlElementBuilder('div')
                .withAttribute('class', 'agenda-text')
                .withText(itemText)
                .buildString()
        })
        .join('');

    // Build agenda element
    const agendaHtmlElement: string = new HtmlElementBuilder('div')
        .withAttribute('class', 'agendas')
        .withChild(agendaItemsHtmlElement)
        .buildString();

    // Group sentences by segment id
    const segments = searchedMeeting.sentences.reduce((groupedSentences: any, currSentence) => {
        const segmentId: string = currSentence.segment_id.split("seg")[1];

        if (!groupedSentences[segmentId]) {
            groupedSentences[segmentId] = {sentences: [], speaker: currSentence.speaker};

            if (currSentence.speaker === null) {
                let placeholderLang = translationLang || currSentence.original_language;
                switch (placeholderLang) {
                    case 'sl':
                        groupedSentences[segmentId].speaker = "Zapisnik navaja";
                        break;
                    case 'sh-Cyrl':
                        groupedSentences[segmentId].speaker = "Записник наводи";
                        break;
                    case 'sh-Latn':
                        groupedSentences[segmentId].speaker = "Zapisnik navodi";
                        break;
                    case 'de':
                        groupedSentences[segmentId].speaker = "Das Protokoll gibt an";
                        break;
                }
            }
        }
        groupedSentences[segmentId].sentences.push(currSentence);

        return groupedSentences;
    }, {});

    // Build content elements
    const segmentsContent = Object.keys(segments).map(segmentId => {
        const segment = segments[segmentId];

        // 1. Build speaker element
        const segmentSpeakerHtmlElement: string = "<br>" + new HtmlElementBuilder('h5')
            .withAttribute('class', 'speaker-text')
            .withText(segment.speaker)
            .buildString();

        // 2. Build sentences elements and wrap them in a div
        const sentencesHtmlElement: string = segment.sentences.map((sentence: Sentence) => {

            const words: Word[] = sentence.translations.find(translation => {
                return (translationLang && translation.lang === translationLang) || (!translationLang && translation.original === 1)
            })?.words!
            const wordsHtmlElement: string = utils.joinWords(words);

            return new HtmlElementBuilder('span')
                .withAttribute('id', sentence.id)
                .withChild(wordsHtmlElement)
                .buildString();
        }).join('');

        const segmentTextHtmlElement: string = new HtmlElementBuilder('div')
            .withAttribute('class', 'segment-text')
            .withChild(sentencesHtmlElement)
            .buildString();

        // 3. Return segment speaker and text elements
        return segmentSpeakerHtmlElement + segmentTextHtmlElement;
    });

    // Build content element
    const contentHtmlElement: string = segmentsContent.map(segment => {
        return new HtmlElementBuilder('div')
            .withAttribute('class', 'segment')
            .withText(segment)
            .buildString();
    }).join('')


    return meetingTitleHtmlElement + agendaTitleHtmlElement + agendaHtmlElement + contentHtmlElement;
}


// speakers of a meeting with the number of their sentences
const getSpeakers = async (meetingId: string): Promise<MeetingSpeaker[]> => {

    const meetingsIndexSearchResponse: SearchResponse<MeetingsIndexDocument> = await esClient.search({
        index: process.env.MEETINGS_INDEX_NAME || 'meetings-index',

        query: {
            bool: {
                filter: [
                    {
                        term: {
                            id: meetingId
                        }
                    }
                ]
            }
        },
        aggs: {
            sentences: {
                nested: {path: "sentences"},
                aggs: {
                    unique_speakers: {
                        terms: {
                            field: "sentences.speaker_id",
                            size: 10000
                        }
                    }
                }
            }
        },
        _source: false

    });

    const uniqueSpeakersAggregation = meetingsIndexSearchResponse.aggregations as unknown as {
        sentences: { unique_speakers: UniqueSpeakersAggregation };
    };

    const buckets = uniqueSpeakersAggregation.sentences.unique_speakers.buckets
        .filter(bucket => bucket.key.trim().length > 0);
    if (buckets.length === 0) {
        return [];
    }

    // get speaker names from attendees-index
    const attendeesResponse: SearchResponse<AttendeesIndexDocument> = await esClient.search({
        index: process.env.ATTENDEES_INDEX_NAME || 'attendees-index',
        query: {ids: {values: buckets.map(bucket => bucket.key)}},
        size: buckets.length,
        _source: ["id", "names"]
    });
    const namesById = new Map<string, AttendeesIndexDocument["names"]>();
    attendeesResponse.hits.hits.forEach(hit => {
        if (hit._source) namesById.set(hit._source.id, hit._source.names);
    });

    return buckets
        .filter(bucket => namesById.has(bucket.key))
        .map(bucket => ({id: bucket.key, names: namesById.get(bucket.key)!, count: bucket.doc_count}));
}


async function* getSpeakerUtterancesHighlights(meetingId: string, speakerName: string) {

    let doneFetchingData: boolean = false;
    let searchAfterKey: AggregationsCompositeAggregateKey | undefined = undefined;
    const chunkSize: number = 5;
    const speakerUtterancesQuery = meetingsIndexQueryBuildersUtils.buildSpeakerUtterancesQuery(meetingId, speakerName);

    do {
        const sentencesIndexSearchResponse: SearchResponse<{}, Record<string, AggregationsCompositeAggregate>> = await esClient.search({
            index: process.env.SENTENCES_INDEX_NAME || 'sentences-index',
            size: 0,
            query: speakerUtterancesQuery,
            aggregations: {
                group_by_segment_id: {
                    composite: {
                        sources: [
                            {
                                segment_sort: {
                                    terms: {field: 'segment_id.sort', order: 'asc'}
                                }
                            },
                            {
                                segment_id: {
                                    terms: {field: 'segment_id'}
                                }
                            }
                        ],
                        size: chunkSize, // Number of buckets per page
                        ...(searchAfterKey ? {after: searchAfterKey} : {})
                    },
                    aggregations: {
                        sentences: {
                            top_hits: {
                                sort: [
                                    {
                                        'sentence_id.sort': {order: 'asc'}
                                    }
                                ],
                                _source: {
                                    includes: ['sentence_id', 'coordinates', 'speaker', 'segment_id']
                                },
                                size: 50000
                            }
                        }
                    }
                }
            }
        });

        searchAfterKey = sentencesIndexSearchResponse.aggregations!.group_by_segment_id.after_key;

        const highlights: Highlight[] = [];
        const utteranceBuckets: UtteranceBucket[] = sentencesIndexSearchResponse.aggregations!.group_by_segment_id.buckets as UtteranceBucket[];
        for (const utterance of Object.values(utteranceBuckets)) {

            const sentencesIds: string[] = utterance.sentences.hits.hits.map(hit => hit._source.sentence_id);
            const sentencesCoordinates: Coordinate[] = utterance.sentences.hits.hits.map(hit => hit._source.coordinates).flat();

            highlights.push({
                ids: sentencesIds,
                rects: utils.groupCoordinates(sentencesCoordinates)
            });
        }

        yield highlights;

        doneFetchingData = searchAfterKey === undefined || (utteranceBuckets && utteranceBuckets.length < chunkSize);
    } while (!doneFetchingData);
}


async function* getHighlights(meetingId: string, query: string, speaker: string | undefined, lang: string | undefined, looseSearch: boolean) {

    const tokens: string[][] = utils.tokenizeQueryDocumentSearch(query)
        .map((tokens: string[]) => tokens.map((token: string) => ASCIIFolder.foldMaintaining(token.toLowerCase())))
        .map((tokens: string[]) => tokens.map((token: string) => token.replaceAll(/[^a-zA-Z0-9\u0400-\u04FF]/g, '')))
        .map((tokens: string[]) => tokens.filter((token: string) => token.length > 0));

    const words: string[] = tokens.filter(token => token.length === 1).map(token => token.join(" ").toLowerCase());
    const phrases: string[][] = tokens.filter(token => token.length > 1);

    let wordsIndexPointInTime: OpenPointInTimeResponse | undefined = undefined;
    let sentencesIndexPointInTime: OpenPointInTimeResponse | undefined = undefined;

    let searchAfterWordsKey: string | undefined = undefined;
    let searchAfterPhrasesKey: string | undefined = undefined;

    const chunkSize: number = 1000;

    const searchStrategy: TranslatedLanguageSearchStrategy | OriginalLanguageSearchStrategy = searchStrategySelector.getSearchStrategy(lang);

    let doneFetchingData: boolean = false

    try {

        // Open point in time for words and sentences index
        [wordsIndexPointInTime, sentencesIndexPointInTime] = await Promise.all([
            esClient.openPointInTime({index: process.env.WORDS_INDEX_NAME || 'words-index', keep_alive: '5m'}),
            esClient.openPointInTime({index: process.env.SENTENCES_INDEX_NAME || 'sentences-index', keep_alive: '5m'})
        ]);

        do {

            // search
            const {
                wordsIndexResponse,
                sentencesIndexResponse,
                searchAfterWordsKey: newSearchAfterWordsKey,
                searchAfterPhrasesKey: newSearchAfterPhrasesKey
            } = await searchStrategy.search(esClient, meetingId, words, phrases, speaker, lang, looseSearch, chunkSize, wordsIndexPointInTime, sentencesIndexPointInTime, searchAfterWordsKey, searchAfterPhrasesKey);

            // process response
            const singleWordsHighlights = await searchStrategy.processSingleWordsResponse(wordsIndexResponse, esClient, meetingId);
            const phrasesHighlights = await searchStrategy.processPhrasesResponse(sentencesIndexResponse, esClient, meetingId);
            let highlights: Highlight[] = [...singleWordsHighlights, ...phrasesHighlights];

            //console.log(JSON.stringify(highlights, null, 2));

            // Filter out words if they are part of a phrase or sentence and phrases if they are part of a sentence
            highlights = utils.filterHighlights(highlights);

            //console.log(JSON.stringify(highlights, null, 2));

            yield highlights;

            // update searchAfterKeys
            searchAfterWordsKey = newSearchAfterWordsKey;
            searchAfterPhrasesKey = newSearchAfterPhrasesKey;

            // check if we are done fetching data
            const doneFetchingDataFromWordsIndex: boolean = Boolean(searchAfterWordsKey === undefined || wordsIndexResponse && wordsIndexResponse.hits.hits.length < chunkSize);
            const doneFetchingDataFromSentencesIndex: boolean = Boolean(searchAfterPhrasesKey === undefined || sentencesIndexResponse && sentencesIndexResponse.hits.hits.length < chunkSize);
            doneFetchingData = doneFetchingDataFromWordsIndex && doneFetchingDataFromSentencesIndex;

        } while (!doneFetchingData);


    } catch (error: any) {
        throw error;

    } finally {
        // close ES point in time
        const closeOpenPointInTimePromises: Promise<ClosePointInTimeResponse>[] = [];

        if (sentencesIndexPointInTime) {
            closeOpenPointInTimePromises.push(esClient.closePointInTime(sentencesIndexPointInTime));
        }
        if (wordsIndexPointInTime) {
            closeOpenPointInTimePromises.push(esClient.closePointInTime(wordsIndexPointInTime));
        }

        await Promise.all(closeOpenPointInTimePromises);
    }
}


export default {
    getAllMeetings,
    getPage,
    getMatchingMeetingIds,
    getTimeline,
    getMeetingAsText,
    getSpeakers,
    getSpeakerUtterancesHighlights,
    getHighlights
};
