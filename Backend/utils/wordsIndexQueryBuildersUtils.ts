const wordsSearchQueryBuilder = (meetingId: string, words: string[], speaker: string | undefined, lang: string | undefined, looseSearch: boolean): any => {

    if (!meetingId || !words || words.length === 0)
        return {};

    // A Single word is a match if it matches either lemma or text, we also allow some fuzziness
    let wordsMultiMatch = words.map(word => {
        return {
            multi_match: {
                query: word,
                type: "best_fields",
                fields: ["text", "lemma"],
                minimum_should_match: 1,
                fuzziness: (looseSearch) ? "AUTO:3,6" : "0"
            }
        }
    });

    // Build the query body
    return {
        bool: {
            filter: [
                {
                    term: {
                        "meeting_id": meetingId
                    }
                },
                ...(lang ? [{term: {"lang": lang}}] : [])
            ],
            must: [
                ...(speaker ? [{
                    match: {
                        "speaker": {
                            query: speaker,
                            operator: "and"
                        }
                    }
                }] : []),
                {
                    bool: {
                        should: wordsMultiMatch,
                        minimum_should_match: 1
                    }
                }
            ]
        }
    };
}


const positionWordSearchQueryBuilder = (sentenceId: string, lang: string | undefined, wordsIndexes: number[]): any => {
    return {
        bool: {
            filter: [
                {
                    term: {
                        "sentence_id": sentenceId
                    }
                },
                {
                    term: (lang ? {"lang": lang} : {"original": 1})
                },
                {
                    terms: {
                        wpos: wordsIndexes
                    }
                }
            ]
        }
    }
}
export default {
    wordsSearchQueryBuilder,
    positionWordSearchQueryBuilder
}
