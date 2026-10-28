import {CorpusSearchFilters} from "../models/CorpusSearchFilters";
import {format} from "date-fns";
import {GetPageQueryParams} from "../models/GetPageQueryParams";
import utils from "../utils/utils";
import advancedQueryBuilder from "./advancedQueryBuilder";


const buildAllMeetingsQuery = (filters: CorpusSearchFilters): any => {
    let baseQuery: any = {bool: {must: [], filter: []}};

    // Add date range filter
    if (filters.dateTo || filters.dateFrom) {
        const rangeFilter: any = {
            range: {
                "date": {}
            }
        };

        if (filters.dateFrom) {
            rangeFilter.range.date.gte = format(new Date(filters.dateFrom!), 'dd.MM.yyyy');
        }
        if (filters.dateTo) {
            rangeFilter.range.date.lte = format(new Date(filters.dateTo!), 'dd.MM.yyyy');
        }

        baseQuery.bool.filter.push(rangeFilter);
    }

    // Add corpus filter
    if (filters.corpora) {
        baseQuery.bool.filter.push({
            terms: {
                "corpus": filters.corpora.split(",")
            }
        });
    }

    // Add language filter (OR)
    if (filters.languages) {
        const langs = filters.languages.split(",").map(l => l.trim());
        baseQuery.bool.filter.push({
            nested: {
                path: "sentences.translations",
                query: {
                    terms: {
                        "sentences.translations.lang.keyword": langs
                    }
                }
            }
        });
    }

    return baseQuery;
};


// conditions on one sentence translation (words, speaker, person, location)
const buildSentenceConditions = (queryParams: GetPageQueryParams): any[] => {

    const languages: string[] = queryParams.filters!.languages!.split(",");
    const languageFilter: any = {terms: {"sentences.translations.lang.keyword": languages}};
    // with more languages only search the originals, otherwise the sentence is found twice
    const originalOnly: any[] = languages.length > 1 ? [{match: {"sentences.translations.original": 1}}] : [];

    const speakerIds: string[] = queryParams.speaker ?? [];
    const splitEntities = (entities: string | undefined): string[] =>
        (entities ?? "").split(",").map(e => e.trim()).filter(e => e.length > 0);
    const personEntities: string[] = splitEntities(queryParams.personEntities);
    const locationEntities: string[] = splitEntities(queryParams.locationEntities);

    /* 1. SEARCHED CONTENTS (words and place names) */
    const contentsQueryFilters: any[] = [languageFilter];
    if (speakerIds.length > 0) {
        contentsQueryFilters.push({terms: {"sentences.translations.speaker_id": speakerIds}});
    }

    const contentsQueries: any[] = [];
    for (const tokenGroup of utils.tokenizeQuery(queryParams.words)) {
        if (tokenGroup.length === 0) {
            continue;
        }

        if (tokenGroup.length === 1) {
            contentsQueries.push(utils.buildShouldMatchLemmaAndTextQuery(tokenGroup[0], contentsQueryFilters));
        } else {
            contentsQueries.push({
                bool: {
                    must: tokenGroup.map(token => utils.buildShouldMatchLemmaAndTextQuery(token, contentsQueryFilters))
                },
            });
        }
    }

    const placesQueries: any[] = [];
    for (const place of queryParams.placeNames!) {
        if (!place || !place.name || place.name === "") {
            continue;
        }

        if (place.name.split(" ").length === 1) {
            placesQueries.push(utils.buildShouldMatchLemmaAndTextPlaceQuery(place.name, contentsQueryFilters));
        } else {
            placesQueries.push({
                bool: {
                    must: place.name.split(" ").map(word => utils.buildShouldMatchLemmaAndTextPlaceQuery(word, contentsQueryFilters))
                },
            });
        }
    }

    /* 2. CONDITIONS (each is matched by at least one sentence of the meeting) */
    const conditions: any[] = [];

    const contentClauses: any[] = [];
    if (contentsQueries.length > 0) {
        contentClauses.push({bool: {should: contentsQueries, minimum_should_match: 1}});
    }
    if (placesQueries.length > 0) {
        contentClauses.push({bool: {should: placesQueries, minimum_should_match: 1}});
    }

    if (contentClauses.length > 0) {
        conditions.push({bool: {must: contentClauses}});
    } else if (speakerIds.length > 0) {
        conditions.push({
            bool: {must: [languageFilter, {terms: {"sentences.translations.speaker_id": speakerIds}}, ...originalOnly]}
        });
    }
    if (personEntities.length > 0) {
        conditions.push({
            bool: {must: [languageFilter, {terms: {"sentences.translations.person_entities": personEntities}}, ...originalOnly]}
        });
    }
    if (locationEntities.length > 0) {
        conditions.push({
            bool: {must: [languageFilter, {terms: {"sentences.translations.location_entities": locationEntities}}, ...originalOnly]}
        });
    }

    return conditions;
}


// CAP topics on one sentence (OR, main topic matches all its subtopics)
const buildSentenceTopicsClause = (capTopics: string[] | undefined): any | undefined => {
    if (!capTopics || capTopics.length === 0) return undefined;

    return {
        bool: {
            should: capTopics.map(topic => topic.includes(':')
                ? {term: {"sentences.cap_topics": topic}}
                : {prefix: {"sentences.cap_topics": topic + ":"}}),
            minimum_should_match: 1
        }
    };
}


// Words and entity filters are AND on meeting level (each can be in a different sentence).
// Shown sentences are the ones that match any of the conditions.
// If words are searched together with a speaker, only the speaker's sentences are searched.
const buildMeetingsPageQuery = (queryParams: GetPageQueryParams): any => {
    if (queryParams.advanced) return advancedQueryBuilder.buildAdvancedMeetingsQuery(queryParams);

    const conditions: any[] = buildSentenceConditions(queryParams);

    /* 3. INNER QUERY */
    const isInnerQueryNeeded: boolean = conditions.length > 0;
    let innerQuery: any;
    if (isInnerQueryNeeded) {
        const shownSentences: any = {
            nested: {
                path: "sentences.translations",
                query: {bool: {should: conditions, minimum_should_match: 1}},
                inner_hits: {
                    size: 10,
                    highlight: {
                        fields: {
                            "sentences.translations.text": {},
                            "sentences.translations.words.lemma": {},
                        }
                    },
                    sort: [
                        {
                            "sentences.translations.original": {
                                order: "desc"
                            }
                        }
                    ]
                }
            }
        };

        const requiredConditions: any[] = conditions.length > 1
            ? conditions.map(condition => ({nested: {path: "sentences.translations", query: condition}}))
            : [];
        innerQuery = {bool: {must: [...requiredConditions, shownSentences]}};
    }

    /* BUILD OUTER QUERY THAT FILTERS MEETINGS BASED ON DATE */
    const outerQuery: any = {
        bool:
            {
                filter: [],
                must: [],
                should: []
            }
    };

    // 0. Add corpus filter to outer query
    if (queryParams.filters.corpora) {
        outerQuery.bool.filter.push({terms: {"corpus": queryParams.filters.corpora.split(",")}});
    }

    // 1. Add date range filter to outer query
    if (queryParams.filters.dateFrom || queryParams.filters.dateTo) {
        const rangeFilter: any = {
            range: {
                "date": {}
            }
        };

        if (queryParams.filters.dateFrom) {
            rangeFilter.range.date.gte = format(new Date(queryParams.filters.dateFrom!), 'dd.MM.yyyy');
        }
        if (queryParams.filters.dateTo) {
            rangeFilter.range.date.lte = format(new Date(queryParams.filters.dateTo!), 'dd.MM.yyyy');
        }

        outerQuery.bool.filter.push(rangeFilter);
    }

    if (queryParams.capTopics && queryParams.capTopics.length > 0) {
        const mainTopics = queryParams.capTopics.filter((t: string | string[]) => !t.includes(':'));
        const subtopics = queryParams.capTopics.filter((t: string | string[]) => t.includes(':'));

        // Use should on outer query so each matching topic boosts the score (OR + ranking)
        // Main topics: prefix match (e.g. "Defence" matches "Defence: Military", "Defence: Arms Control", ...)
        mainTopics.forEach(main => {
            outerQuery.bool.should.push({ prefix: { "cap_topics_aggregated": main + ":" } });
        });
        // Subtopics: each as a separate term clause so each match adds to score
        subtopics.forEach(sub => {
            outerQuery.bool.should.push({ term: { "cap_topics_aggregated": sub } });
        });

        outerQuery.bool.minimum_should_match = 1;
    }

    // 2. Add inner query to outer query
    if (isInnerQueryNeeded) {
        outerQuery.bool.must.push({
            function_score: {
                query: innerQuery,
                score_mode: "sum",
            }
        });
    }

    return outerQuery;
}


const buildSpeakerUtterancesQuery = (meetingId: string, speakerId: string): any => {
    return {
        bool: {
            filter: [
                {
                    term: {
                        meeting_id: meetingId
                    }
                }
            ],
            must: [
                {
                    term: {
                        speaker_id: speakerId
                    }
                }
            ]
        }
    };
}


export default {
    buildAllMeetingsQuery,
    buildMeetingsPageQuery,
    buildSentenceConditions,
    buildSentenceTopicsClause,
    buildSpeakerUtterancesQuery
}
