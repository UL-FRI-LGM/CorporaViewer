const phrasesSearchQueryBuilder = (meetingId: string, phrases: string[][], speaker: string | undefined, lang: string | undefined, looseSearch: boolean) => {

    if (!meetingId || !phrases || phrases.length === 0)
        return {};

    const phrasesFilters = phrases.map(phrase => {
        // All words in the phrase must be present in the sentence one after the other in the given order
        return {
            span_near: {
                // We add clauses for each word in the phrase, we allow some fuzziness
                clauses: phrase.map(word => {
                    return {
                        span_multi: {
                            match: {
                                fuzzy: {
                                    "translations.text": {
                                        value: word,
                                        fuzziness: (looseSearch) ? "AUTO:3,6" : "0"
                                    }
                                }
                            }
                        }
                    }
                }),
                slop: 0,
                in_order: true,
            },
        }
    });

    // Remove null and undefined values from the query body
    return {
        bool: {
            filter: [
                {
                    term: {
                        "meeting_id": meetingId
                    }
                }
            ],
            must: [
                ...(speaker ? [{
                    match: {
                        "speaker": {
                            query: speaker,
                        }
                    }
                }] : []),
                {
                    nested: {
                        path: "translations",
                        query: {
                            bool: {
                                ...(lang ? {filter: [{term: {"translations.lang": lang}}]} : {}),
                                should: phrasesFilters,
                                minimum_should_match: 1
                            }
                        },
                        // This tells us in which translation the phrase was found (could be in multiple translations)
                        inner_hits: {
                            name: "matched_translation",
                            // Highlight the matched words in the sentence
                            highlight: {
                                number_of_fragments: 0,
                                fields: {
                                    "translations.text": {}
                                }
                            },
                            // Sort the inner hits by the original translation (in case there are matches in multiple translations, we want to show the original one first)
                            sort: [
                                {
                                    "translations.original": {
                                        order: "desc"
                                    }
                                }
                            ]
                        }
                    }
                }
            ]
        }
    };
}


const sentencesIdQueryBuilder = (meetingId: string, sentencesIds: string[]): any => {
    return {
        bool: {
            filter: [
                {
                    term: {
                        "meeting_id": meetingId
                    }
                },
                {
                    terms: {
                        "sentence_id": sentencesIds
                    }
                }
            ]
        }
    };
}

export default {
    phrasesSearchQueryBuilder,
    sentencesIdQueryBuilder
}
