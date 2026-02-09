import {Client} from "@elastic/elasticsearch";
import wordsIndexQueryBuildersUtils from "../utils/wordsIndexQueryBuildersUtils";
import sentencesIndexQueryBuildersUtils from "../utils/sentencesIndexQueryBuildersUtils";
import {OpenPointInTimeResponse, SearchHit, SearchResponse} from "@elastic/elasticsearch/lib/api/types";
import {WordsIndexDocument} from "../models/WordsIndexDocument";
import {SentencesIndexDocument} from "../models/SentecesIndexDocument";
import {Highlight} from "../models/Highlight";
import utils from "../utils/utils";

class SearchStrategy {

    async search(esClient: Client, meetingId: string, words: string[], phrases: string[][], speaker: string | undefined, lang: string | undefined, looseSearch: boolean, chunkSize: number, wordsPointInTime: OpenPointInTimeResponse, sentencesPointInTime: OpenPointInTimeResponse, searchAfterWordsKey: string | undefined, searchAfterPhrasesKey: string | undefined): Promise<{
        wordsIndexResponse: SearchResponse<WordsIndexDocument> | undefined,
        sentencesIndexResponse: SearchResponse<SentencesIndexDocument> | undefined,
        searchAfterWordsKey: string | undefined,
        searchAfterPhrasesKey: string | undefined
    }> {

        const wordsIndexSearchQuery: any = wordsIndexQueryBuildersUtils.wordsSearchQueryBuilder(meetingId, words, speaker, lang, looseSearch);
        const phrasesIndexSearchQuery: any = sentencesIndexQueryBuildersUtils.phrasesSearchQueryBuilder(meetingId, phrases, speaker, lang, looseSearch);

        const promises: [Promise<SearchResponse<WordsIndexDocument>>, Promise<SearchResponse<SentencesIndexDocument>>] = [
            esClient.search({
                size: chunkSize,
                track_total_hits: false,
                body: {
                    query: wordsIndexSearchQuery,
                },
                sort: [
                    {
                        "word_id.sort": {
                            order: "asc"
                        }
                    }
                ],
                pit: wordsPointInTime,
                ...(searchAfterWordsKey !== undefined && {search_after: [searchAfterWordsKey]}),
            }),
            esClient.search({
                size: chunkSize,
                track_total_hits: false,
                body: {
                    query: phrasesIndexSearchQuery,
                },
                min_score: 1,
                sort: [
                    {
                        "sentence_id.sort": {
                            order: "asc"
                        }
                    }
                ],
                pit: sentencesPointInTime,
                ...(searchAfterPhrasesKey !== undefined && {search_after: [searchAfterPhrasesKey]}),
            })
        ];

        // Fetch the data for single words and phrases
        const allResponses: [PromiseSettledResult<SearchResponse<WordsIndexDocument>>, PromiseSettledResult<SearchResponse<SentencesIndexDocument>>] = await Promise.allSettled(promises);
        const wordsIndexResponse: SearchResponse<WordsIndexDocument> | undefined = allResponses[0].status === "fulfilled" ? allResponses[0].value : undefined;
        const sentencesIndexResponse: SearchResponse<SentencesIndexDocument> | undefined = allResponses[1].status === "fulfilled" ? allResponses[1].value : undefined;

        const wordsIndexDocuments: SearchHit<WordsIndexDocument>[] = wordsIndexResponse ? wordsIndexResponse.hits.hits : [];
        const sentencesIndexDocuments: SearchHit<SentencesIndexDocument>[] = sentencesIndexResponse ? sentencesIndexResponse.hits.hits : [];

        searchAfterWordsKey = wordsIndexDocuments.length > 0 ? wordsIndexDocuments[wordsIndexDocuments.length - 1].sort![0] : searchAfterWordsKey;
        searchAfterPhrasesKey = sentencesIndexDocuments.length > 0 ? sentencesIndexDocuments[sentencesIndexDocuments.length - 1].sort![0] : searchAfterPhrasesKey;

        return {wordsIndexResponse, sentencesIndexResponse, searchAfterWordsKey, searchAfterPhrasesKey};
    }


    async processSingleWordsResponse(singleWordsResponse: any, esClient: Client, meetingId: string): Promise<Highlight[]> {
        throw new Error("processResponse() method must be implemented.");
    }


    async processPhrasesResponse(phrasesResponse: any, esClient: Client, meetingId: string): Promise<Highlight[]> {
        throw new Error("processResponse() method must be implemented.");
    }
}


export class OriginalLanguageSearchStrategy extends SearchStrategy {

    async processSingleWordsResponse(wordsIndexResponse: SearchResponse<WordsIndexDocument> | undefined, esClient: Client, meetingId: string): Promise<Highlight[]> {

        if (!wordsIndexResponse || wordsIndexResponse.hits.hits.length === 0)
            return [];

        // For translated words, we collect the (UNIQUE) ids of the sentences that contain them
        // We will use these ids to get the coordinates of the sentences that contain the translated words
        const sentencesIdsOfTranslatedWords: string[] = wordsIndexResponse.hits.hits
            .filter((hit: SearchHit<WordsIndexDocument>): boolean => hit._source!.original === 0)
            .map((hit: SearchHit<WordsIndexDocument>): string => hit._source!.sentence_id)
            .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index);


        // We collect the original words
        const originalWordsHighlights: Highlight[] = wordsIndexResponse.hits.hits
            .filter((hit: SearchHit<WordsIndexDocument>): boolean => hit._source!.original === 1)
            .filter((hit: SearchHit<WordsIndexDocument>): boolean => !sentencesIdsOfTranslatedWords.includes(hit._source!.sentence_id))
            .map((hit: SearchHit<WordsIndexDocument>): Highlight => ({
                    ids: [hit._source!.word_id],
                    rects: utils.groupCoordinates(hit._source!.coordinates),
                } as Highlight)
            );

        const originalSentencesQuery: any = sentencesIndexQueryBuildersUtils.sentencesIdQueryBuilder(meetingId, sentencesIdsOfTranslatedWords);
        const sentencesIndexSearchResponse: SearchResponse<SentencesIndexDocument> = await esClient.search({
            index: process.env.SENTENCES_INDEX_NAME || "sentences-index",
            size: 10000,
            track_total_hits: false,
            body: {
                query: originalSentencesQuery
            },
        });

        const sentencesHighlights: Highlight[] = sentencesIndexSearchResponse.hits.hits.map((hit: SearchHit<SentencesIndexDocument>): Highlight => ({
                ids: [hit._source!.sentence_id],
                rects: utils.groupCoordinates(hit._source!.coordinates),
            } as Highlight)
        );




        return [...originalWordsHighlights, ...sentencesHighlights];
    }

    async processPhrasesResponse(sentencesIndexResponse: SearchResponse<SentencesIndexDocument> | undefined, esClient: Client, meetingId: string): Promise<Highlight[]> {

        if (!sentencesIndexResponse || sentencesIndexResponse.hits.hits.length === 0)
            return [];

        // For translated phrases, we collect the data of the sentences that contains them
        const translatedSentencesHighlights: Highlight[] = sentencesIndexResponse.hits.hits
            .filter((hit: SearchHit<SentencesIndexDocument>): boolean => hit.inner_hits!.matched_translation.hits.hits[0]._source.original === 0)
            .map((hit: SearchHit<SentencesIndexDocument>): Highlight => ({
                    ids: [hit._source!.sentence_id],
                    rects: utils.groupCoordinates(hit._source!.coordinates)
                } as Highlight)
            );

        // For each original sentence that contains searched phrase, we create a query to get the words that are highlighted in the sentence
        const getSearchedWordsFromSentencesPromises: Promise<SearchResponse<WordsIndexDocument>>[] = sentencesIndexResponse.hits.hits
            .filter((hit: SearchHit<SentencesIndexDocument>): boolean => hit.inner_hits!.matched_translation.hits.hits[0]._source.original === 1)
            .map((hit: SearchHit<SentencesIndexDocument>) => {
                const sentenceId: string = hit._source!.sentence_id;
                const sentenceWithHighlightedWords: string = hit.inner_hits!.matched_translation.hits.hits[0].highlight!["translations.text"][0];
                const positionsOfSearchedWords: number[] = utils.getEmTagIndexes(sentenceWithHighlightedWords);

                return esClient.search({
                    index: process.env.WORDS_INDEX_NAME || "words-index",
                    size: 10000,
                    track_total_hits: false,
                    body: {
                        query: wordsIndexQueryBuildersUtils.positionWordSearchQueryBuilder(sentenceId, undefined, positionsOfSearchedWords)
                    },
                });
            });

        const wordsIndexSearchResponses: PromiseSettledResult<SearchResponse<WordsIndexDocument>>[] = await Promise.allSettled(getSearchedWordsFromSentencesPromises);
        const fulfilledWordsIndexSearchResponses: SearchResponse<WordsIndexDocument>[] = wordsIndexSearchResponses
            .filter(response => response.status === "fulfilled")
            .map(fulfilledResponse => fulfilledResponse.value as SearchResponse<WordsIndexDocument>);

        // We group words by their position in the sentence (because we have multiple phrases in a single sentence)
        // Group of words is a list of words that are highlighted in the same sentence and have position n and n-1
        const phrasesHighlights: Highlight[] = fulfilledWordsIndexSearchResponses
            .map(response => {
                const words: WordsIndexDocument[] = response.hits.hits.map((hit: SearchHit<WordsIndexDocument>): WordsIndexDocument => hit._source! as WordsIndexDocument);
                return utils.groupWordsByPosition(words);
            })
            .flat();

        return [...translatedSentencesHighlights, ...phrasesHighlights];
    }
}


export class TranslatedLanguageSearchStrategy extends SearchStrategy {

    async processSingleWordsResponse(wordsIndexResponse: SearchResponse<WordsIndexDocument> | undefined, esClient: Client, meetingId: string): Promise<Highlight[]> {

        if (!wordsIndexResponse || wordsIndexResponse.hits.hits.length === 0)
            return [];

        // Return matched words in the provided language (we do not search in other translations when lang is specified)
        return wordsIndexResponse.hits.hits
            .map(hit => ({
                    ids: [hit._source!.word_id],
                    rects: [],
                } as Highlight)
            );
    }

    async processPhrasesResponse(sentencesIndexResponse: SearchResponse<SentencesIndexDocument> | undefined, esClient: Client, meetingId: string): Promise<Highlight[]> {

        if (!sentencesIndexResponse || sentencesIndexResponse.hits.hits.length === 0)
            return [];

        // For each sentence that contains searched phrase, we create a query to get the words that are highlighted in the sentence
        const getSearchedWordsFromSentencesPromises: Promise<SearchResponse<WordsIndexDocument>>[] = sentencesIndexResponse.hits.hits
            .map((hit: SearchHit<SentencesIndexDocument>) => {
                const sentenceId: string = hit._source!.sentence_id;
                const sentenceWithHighlightedWords: string = hit.inner_hits!.matched_translation.hits.hits[0].highlight!["translations.text"][0];
                const positionsOfSearchedWords: number[] = utils.getEmTagIndexes(sentenceWithHighlightedWords);
                const languageOfMatchedTranslation: string = hit.inner_hits!.matched_translation.hits.hits[0]._source.lang;

                return esClient.search({
                    index: process.env.WORDS_INDEX_NAME || "words-index",
                    size: 10000,
                    track_total_hits: false,
                    body: {
                        query: wordsIndexQueryBuildersUtils.positionWordSearchQueryBuilder(sentenceId, languageOfMatchedTranslation, positionsOfSearchedWords)
                    },
                });
            });



        const wordsIndexSearchResponses: PromiseSettledResult<SearchResponse<WordsIndexDocument>>[] = await Promise.allSettled(getSearchedWordsFromSentencesPromises);
        const fulfilledWordsIndexSearchResponses: SearchResponse<WordsIndexDocument>[] = wordsIndexSearchResponses
            .filter(response => response.status === "fulfilled")
            .map(fulfilledResponse => fulfilledResponse.value as SearchResponse<WordsIndexDocument>);

        // We group words by their position in the sentence (because we have multiple phrases in a single sentence)
        // Group of words is a list of words that are highlighted in the same sentence and have position n and n-1
        const phrasesHighlights: Highlight[] = fulfilledWordsIndexSearchResponses
            .map(response => {
                return utils.groupWordsByPosition(
                    response.hits.hits.map(h => h._source! as WordsIndexDocument)
                )
            })
            .flat();

        return phrasesHighlights;
    }
}
