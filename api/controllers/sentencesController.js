require('dotenv').config();
const { populate } = require('dotenv');
const esClient = require('../../services/elasticsearch');

var getAll = async (req, res) => {
    try {
        const response = await esClient.search({
            index: process.env.SENTENCES_INDEX_NAME || 'sentences-index',
            body: {
                query: {
                    match_all: {}
                }
            }
        });
        res.json(response.hits.hits);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

function formatDate(date, format) {
    var dd = date.getDate();
    var MM = date.getMonth() + 1;
    var yyyy = date.getFullYear();

    if (dd < 10) dd = '0' + dd;
    if (MM < 10) MM = '0' + MM;

    return format.replace('dd', dd).replace('MM', MM).replace('yyyy', yyyy);
}

var shouldMatchLemmaAndText = (word) => {
    return {
        bool: {
            should: [
                { match_phrase: { "translations.text": word } },
                { match_phrase: { "translations.words.lemma": word } }
            ],
            minimum_should_match: 1
        }
    }
}

/**
 * Tokenizes the words
 * @param {*} query
 * @returns {string[][]} - The tokenized words
 */
function tokenizeQuery(query) {
    var orQueries = query.split("OR");

    //extract words in quotes as 1 string, split the rest of the words on spaces (ignore empty strings)
    var tokenizedWordsQuery = orQueries.map(orQuery => {
        var wordsInQuotes = orQuery.match(/"([^"]+)"/g)?.map(word => word.replace(/"/g, ''));
        var wordsWithoutQuotes = orQuery.replace(/"([^"]+)"/g, '').split(" ").filter(word => word !== "");
        return [...(wordsInQuotes || []), ...(wordsWithoutQuotes || [])];
    });

    return tokenizedWordsQuery;
}

// /**
//  * Retrieves sentences from the Elasticsearch index based on the provided filters.
//  * @async
//  * @function
//  * @param {Object} meeting - The meeting object to filter by.
//  * @param {string} words - The words to search for in the sentence translations.
//  * @param {string[]} speaker - The speaker to filter by.
//  * @param {Object} placeNames - The place names to filter by.
//  * @returns {Promise<Object[]>} - An array of Elasticsearch hits containing the retrieved sentences.
//  */
// async function getSentences(meeting, words, speaker, placeNames) {
//     mustQueries = []
//     shouldQueries = []

//     // parse words into Elasticsearch queries
//     if (words) {
//         words.split("OR").flatMap(orQuery => {
//             var wordsInQuotes = orQuery.match(/"([^"]+)"/g)?.map(word => word.replace(/"/g, ''));
//             var wordsWithoutQuotes = orQuery.replace(/"([^"]+)"/g, '').split(" ").filter(word => word !== "");
//             return [...(wordsInQuotes || []), ...(wordsWithoutQuotes || [])];
//         }).forEach(word => {
//             shouldQueries.push(shouldMatchLemmaAndText(word));
//         });
//     }

//     // add placeNames to shouldQueries and only search for propn
//     placeNames?.forEach(place => {
//         shouldQueries.push({ match_phrase: { "translations.words.lemma": place.name } })
//     })

//     // create filter for speaker if needed
//     const speakerFilter = speaker ? {
//         bool: {
//             should: speaker.map(speaker_name => { return { match: { "speaker": speaker_name } } }),
//             minimum_should_match: 1
//         }
//     } : null;

//     // add shouldQueries to mustQueries if there are any
//     if (shouldQueries.length > 0) mustQueries.push({ bool: { should: shouldQueries, minimum_should_match: 1 } } );
    
//     // get id of meeting and add it to mustQueries
//     const id = meeting._source.id;
//     mustQueries.push({ match: { "meeting_id": id } } );
    
//     // search for sentences
//     try {
//         const sentences = await esClient.search({
//             index: process.env.SENTENCES_INDEX_NAME || 'sentences-index',
//             body: {
//                 query: {
//                     bool: {
//                         must: mustQueries,
//                         filter: speakerFilter
//                     }
//                 },
//                 size: 10,
//                 sort: {
//                     "_score": {
//                         "order": "desc"
//                     }
//                 },
//                 highlight: {
//                     fields: {
//                         "translations.text": {},
//                         "translations.words.lemma": {},
//                     }
//                 }
//             }
//         });

//         return {
//             total: sentences.hits.total.value,
//             sentences: sentences.hits.hits
//         };
//     }
//     catch (error) {
//         console.error(error);
//     }
// }

async function getAsText(meeting_id, language) {
    const languageMatch = ( language == "" ?
        { match: { "translations.original": 1 } } :
        { match: { "translations.lang": language } }
    )
    try {
        // return sentences in meeting aggregated by segment_id
        const segments = await esClient.search({
            index: process.env.SENTENCES_INDEX_NAME || 'sentences-index',
            _source: ["translations.text", "translations.lang", "translations.original", "id", "segment_id"],
            body: {
                query: {
                    bool: {
                        must: [
                            { match: { "meeting_id": meeting_id } },
                            languageMatch
                        ]
                    }
                },
                size: 10000
            },
            aggregations: {
                segments: {
                    terms: {
                        field: "segment_id",
                        size: 1000
                    },
                    aggs: {
                        sentences: {
                            top_hits: {
                                size: 1000,
                                _source: ["translations.text", "translations.lang", "translations.original", "id", "segment_id", "speaker"]
                            }
                        }
                    }
                }
            }
        });

        const aggregatedSegments = segments.aggregations.segments.buckets;

        // sort segment by the last number after seg (DZK_1896-01-03_37_02_seg34 => sort by 34)
        aggregatedSegments.sort((a, b) => {
            const seg_a = parseInt(a.key.split("seg")[1]);
            const seg_b = parseInt(b.key.split("seg")[1]);
            return seg_a - seg_b;
        })

        return aggregatedSegments
    } catch (error) {
        console.error(error);
    }
}

module.exports = {
    getAll,
    // getSentences,
    formatDate,
    getAsText
};