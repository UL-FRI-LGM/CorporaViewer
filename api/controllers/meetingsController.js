require('dotenv').config();
const esClient = require('../../services/elasticsearch');
const sentencesController = require('./sentencesController');
const async = require('async');

function parseSort(sort) {
    switch (sort) {
        case "date_asc":
            return [ { "date": { "order": "asc" } } ];
        case "date_desc":
            return [ { "date": { "order": "desc" } } ];
        default:
            return [ { "_score": { "order": "desc" } }, { "date": { "order": "asc" } } ];
    }
}

/**
 * Retrieves all meetings based on the provided filters and pagination. Does not use pit.
 * @param {Object} filters - The filters to apply to the meetings.
 * @param {number} page - The page number for pagination.
 * @returns {Promise<Object>} - The result of the getAll operation.
 */
async function getAll(filters, page) {
    var searchFilters = []
    searchFilters.push({ range: { "date": { gte: sentencesController.formatDate(new Date(filters.dateFrom), "dd.MM.yyyy") } } })
    searchFilters.push({ range: { "date": { lte: sentencesController.formatDate(new Date(filters.dateTo), "dd.MM.yyyy") } } })
    searchFilters.push({ terms: { "corpus": filters.corpuses.split(",") } })

    try {
        const response = await esClient.search({
            index: process.env.MEETINGS_INDEX_NAME || 'meetings-index',
            body: {
                _source: ["id", "date", "titles", "agendas"],
                query: {
                    bool: {
                        must: [],
                        filter: searchFilters
                    }
                },
                size: 10,
                from: (page - 1) * 10,
                sort: parseSort(filters.sort)
            }
        });

        let meetingPromises = response.hits.hits.map(async meeting => {
            return {
                id: meeting._source.id,
                date: meeting._source.date,
                titles: meeting._source.titles,
                agendas: meeting._source.agendas,
                sentences: []
            };
        });
        
        // wait for all promises to resolve
        const meetings = await Promise.all(meetingPromises);
        
        return {
            meetings: meetings,
            total: response.hits.total.value
        };
        
    } catch (error) {
        console.error(error);
        return { error: "Internal server error" };
    }
};

//this is inside nested query
var shouldMatchLemmaAndText = (word, filters, speaker) => {
    return {
        bool: {
            should: [
                { match_phrase: { "sentences.translations.words.lemma": word } },
                { match_phrase: { "sentences.translations.text": word } }
            ],
            minimum_should_match: 1,
            filter: filters
        }
    }
}

/**
 * Builds the query body for searching meetings based on words and place names.
 * 
 * @param {string[]} words - The words to search for in the meetings.
 * @param {Object[]} placeNames - The place names to search for in the meetings.
 * @returns {Object|null} - The query body for searching meetings or null if there are no word queries or place names.
 */
var buildQueryBody = (words, placeNames, speaker, filters) => {
    var shouldQueries = [];
    const tokenizedQuery = tokenizeQuery(words);

    const queryFilters = [
        { terms: { "sentences.translations.lang": filters.languages.split(",") } },
    ]

    if (speaker) queryFilters.push({
        bool: {
            should: speaker.map(speaker => { return { match: { "sentences.translations.speaker": speaker } } }),
            minimum_should_match: 1
        }
    })
            

    // each list inside tokenized query contains a list of words and phrases
    // valid meeting has a least one valid outer list, of which all elements are present
    // element is present if meeting has the actual word as it is provided or a lemma matches the words
    shouldQueries = tokenizedQuery.map(wordsAndPhrases => {
        // if there are no words or phrases in the list, return null
        if (!wordsAndPhrases || wordsAndPhrases.length == 0) return null;

        // if there is only one word or phrase in the list, return a match_phrase query for text and lemmas
        if (wordsAndPhrases.length == 1) {
            return shouldMatchLemmaAndText(wordsAndPhrases[0], queryFilters)
        }

        // if there are multiple words or phrases in the list, return a bool query with should match_phrase queries for text and lemmas
        return {
            bool: {
                must: wordsAndPhrases.map(word => {
                    return shouldMatchLemmaAndText(word, queryFilters, speaker)
                })
            },
        }
    }).filter(query => query != null)

    // console.log(filters.languages)

    var placeNamesQuery = placeNames ? [{
        bool: {
            should: placeNames.map(place => {
                return { match_phrase: { "sentences.translations.words.lemma": place.name } }
            }),
            minimum_should_match: 1,
            filter: queryFilters
        }
    }] : []

    // if there are no word queries, place names or speaker, return null
    if (shouldQueries.length < 1 && placeNamesQuery.length < 1 && !speaker) return null;

    // if there is only speaker, return all translations where speaker speaks, language is correct and is original
    if (shouldQueries.length < 1 && placeNamesQuery.length < 1 && speaker) {
        // create speaker query
        let speakerQuery = {
            bool: {
                must: [
                    { terms: { "sentences.translations.lang": filters.languages.split(",") } },
                    {
                        bool: {
                            should: speaker.map(speaker => { return { match: { "sentences.translations.speaker": speaker } } }),
                            minimum_should_match: 1
                        }
                    }
                ]
            }
        }

        // add original filter if there are multiple languages
        if (filters.languages.split(",").length > 1) speakerQuery.bool.must.push({ match: { "sentences.translations.original": 1 } })

        // return nested query
        return {
            nested: {
                path: "sentences.translations",
                query: speakerQuery,
                inner_hits: {
                    size: 10,
                    highlight: {
                        fields: {
                            "sentences.translations.text": {},
                            "sentences.translations.words.lemma": {},
                        }
                    }
                }
            }
        }
    }

    // else return all translations which match at least one word query and place name query
    bodyQuery = {
        nested: {
            path: "sentences.translations",
            query: {
                bool: {
                    must: [
                    ]
                }
            },
            inner_hits: {
                size: 10,
                highlight: {
                    fields: {
                        "sentences.translations.text": {},
                        "sentences.translations.words.lemma": {},
                    }
                }
            }
        }
    }

    if (shouldQueries.length > 0) bodyQuery.nested.query.bool.must.push({ bool: { should: shouldQueries, minimum_should_match: 1 } })
    if (placeNamesQuery.length > 0) bodyQuery.nested.query.bool.must.push(...placeNamesQuery)  

    // must match place name query if there are place names and must match all word queries
    // return null if there are no word queries or place names
    return bodyQuery
}

var parseSpeaker = (speaker_list) => {
    if (!speaker_list) return null;
    
    // use the last surname of the speaker since there is no way to know which is the first name and which is the surname
    return speaker_list.split(",").map(speaker => speaker.replace(/[^a-zA-ZäöüßÄÖÜčšžČŠŽ. 0-9\-]/g,"").split(" ").at(-1))
}

var parseSearchAfterParams = (sort, searchAfterScore, searchAfterDate, searchAfterIndex) => {
    switch (sort) {
        case "date_asc":
            return [searchAfterDate, searchAfterIndex]
        case "date_desc":
            return [searchAfterDate, searchAfterIndex]
        default:
            return [searchAfterScore, searchAfterDate, searchAfterIndex]
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

var parsePlace = (place_list) => {
    if (!place_list) return null;

    // get lang and name from pattern {lang:name}
    const place_names_str = place_list.match(/{([^}]+)}/g)?.map(place => place.replace(/[{}]/g, '')) || []
    const place_names_obj = place_names_str.map(place => {
        const split = place.split(":")
        return {
            lang: split[0],
            name: split[1] || ""
        }
    })
    return place_names_obj
}

// this function will replace search, since its ineficient. search function calls getAllValidMeetings which takes too long, since it has to go through all meetings
// this function will make use of elasticsearch point in time to get meeting data just for the page in the request parameter
var getPage = async (req, res) => {
    // initialize variables
    const words = req.query.words || ""
    const speaker = parseSpeaker(req.query.speaker)
    const placeNames = parsePlace(req.query.place)
    const filters = {
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        languages: req.query.languages,
        corpuses: req.query.corpuses,
        sort: req.query.sort
    }
    const page = req.params.page
    const pitId = req.query.pitId
    const searchAfterScore = req.query.searchAfterScore
    const searchAfterDate = req.query.searchAfterDate
    const searchAfterIndex = req.query.searchAfterIndex

    // check if all required query parameters are provided
    if (!filters.dateFrom || !filters.dateTo || !filters.languages || !filters.corpuses || !page) {
        res.json({ error: `Bad request, missing:` +
            `${!filters.dateFrom ? " dateFrom" : ""}` +
            `${!filters.dateTo ? " dateTo" : ""}` +
            `${!filters.languages ? " languages" : ""}` +
            `${!filters.corpuses ? " corpuses" : ""}` +
            `${!page ? " page" : ""}`,
            meetings: [],
            total: 0,
            page: page,
            pitId: null,
            searchAfterScore: null,
            searchAfterDate: null,
            searchAfterIndex: null
        });
        return;
    }

    // check if search has at least one language and corpus selected
    if (filters.languages == "" || filters.corpuses == "") {
        res.json({
            meetings: [],
            total: 0,
            page: page,
            pitId: null,
            searchAfterScore: null,
            searchAfterDate: null,
            searchAfterIndex: null
        });
        return;
    }

    if (!req.query.words && !speaker && !placeNames) {
        const response = await getAll(filters, page)
        return res.json(response);
    }

    // check if page is valid
    if (page < 1) {
        res.status(400).json({ error: `Bad request, invalid page` });
        return;
    } else if (page > 1 && (!pitId || (!searchAfterScore && filters.sort == "relevance") || !searchAfterDate)) {
        res.status(400).json({ error: `Bad request, missing:` +
            `${!pitId ? " pitId" : ""}` +
            `${!searchAfterScore && filters.sort == "relevance" ? " searchAfterScore" : ""}` +
            `${!searchAfterDate ? " searchAfterDate" : ""}`
        });
        return;
    }

    const queryBody = buildQueryBody(words, placeNames, speaker, filters)

    // console.log(JSON.stringify(queryBody, null, 2))

    try {
        // query which is scored by number of translations found in the nested query
        const query = {
            _source: ["id", "date", "titles", "agendas", "corpus"],
            body: {
                query: {
                    function_score: {
                        query: queryBody,
                        score_mode: "sum",
                    }
                }
            },
            size: 10,
            sort: parseSort(filters.sort),
        }

        // close pit if page is 1 and pitId is provided
        if (page == 1 && pitId) {
            esClient.closePointInTime({
                body: {
                    id: pitId
                }
            })
        } else if (page > 1 && searchAfterScore && searchAfterDate) {
            query.body.search_after = parseSearchAfterParams(filters.sort, searchAfterScore, searchAfterDate, searchAfterIndex)
        }

        // open pit if page is 1
        const pit = page == 1 ? await esClient.openPointInTime({
            index: process.env.MEETINGS_INDEX_NAME || 'meetings-index',
            keep_alive: '30m'
        }) : { id: pitId }

        query.pit = pit

        // console.log(JSON.stringify(query, null, 2))

        const response = await esClient.search(query);

        const meetings = response.hits.hits.map(meeting => {
            return {
                id: meeting._source.id,
                date: meeting._source.date,
                titles: meeting._source.titles,
                agendas: meeting._source.agendas,
                corpus: meeting._source.corpus,
                sentences: meeting.inner_hits["sentences.translations"].hits.hits.map(sentence => {
                    return {
                        lang: sentence._source.lang,
                        original: sentence._source.original,
                        text: sentence._source.text,
                        speaker: sentence._source.speaker,
                        words: sentence._source.words,
                        highlights: sentence.highlight   
                    }
                }),
                totalSentences: meeting.inner_hits["sentences.translations"].hits.total.value
            };
        })

        res.json({
            meetings: meetings,
            searchAfterScore: response.hits.hits[response.hits.hits.length - 1]?._score ?? null,
            searchAfterDate: response.hits.hits[response.hits.hits.length - 1]?._source.date ?? null,
            searchAfterIndex: response.hits.hits[response.hits.hits.length - 1]?.sort[response.hits.hits[response.hits.hits.length - 1].sort.length - 1] ?? null,
            pitId: pit.id,
            page: page,
            total: response.hits.total.value,
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * Retrieves a meeting as text. Sentences are sorted by their IDs and then aggregated into segments, which are sorted by their IDs.
 * @async
 * @function
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the meeting is retrieved.
 */
var getMeetingAsText = async (req, res) => {
    const meetingId = req.query.meetingId
    const lang = req.query.lang

    // TODO: getAsText verjetno ne naredi nic, lahko uporabim kar podatke iz meetinga ki jih potem prefiltriram na backendu (inner hits je prevelik size, bi moral biti najvec 100)
    // get all segments in a meeting
    const segments = await sentencesController.getAsText(meetingId, lang)
    const meeting = await esClient.search({
        index: process.env.MEETINGS_INDEX_NAME || 'meetings-index',
        _source: ["id", "date", "titles", "agendas"],
        body: {
            query: {
                term: {
                    "id": meetingId
                }
            },
            size: 1
        }
    });

    const searchedForMeeting = meeting.hits.hits[0]._source

    let title = "";
    let agendas = "";
    let content = "";
    let text = "";

    // console.log(req.query);

    if (lang === "") {
        const pageLang = req.query.pageLang;
        title = buildHtmlElement("<h2 class='title-text'>", searchedForMeeting.titles.find(title => title.lang == pageLang)?.title, `${pageLang === 'sl' ? "Zapisnik ne vsebuje naslova v slovenščini" : "Das Protokoll enthält keinen Titel in deutscher Sprache"}.<br><br>`, "</h2>");
        agendas = buildHtmlElement("<div class='agenda-text'>", searchedForMeeting.agendas.find(agenda => agenda.lang == pageLang)?.items.map(item => item.text).join("</div><div class='agenda-text'>"), `${pageLang === 'sl' ? "Zapisnik ne vsebuje dnevnega reda" : "Das Protokoll enthält nicht die Tagesordnung"}.<br><br>`, "</div>");
        content = segments.map(segment => {
            const speaker = buildHtmlElement("<br><h5 class='speaker-text'>", segment.sentences.hits.hits[0]._source.speaker, `${pageLang === 'sl' ? "Neimenovani govorec" : "Ungenannter Sprecher"}:<br><br>`, "</h5>");
            const sentences = buildHtmlElement("<div class='segment-text'>", segment.sentences.hits.hits.map(sentence => sentence._source.translations.find(translation => translation.original == 1)?.text).join(""), "", "</div>");
            return speaker + sentences;
        })

        text = title
            + "<h3 class='agendas-title'>" + getAgendaTitle(pageLang) + "</h3><div class='agendas'>"
            + agendas
            + "</div>" 
            + "<div class='segment'>" 
            + content.join("<div class='segment'></div>") 
            + "</div>";
    } else {
        title = buildHtmlElement("<h2 class='title-text'>", searchedForMeeting.titles.find(title => title.lang == lang)?.title, `${lang === 'sl' ? "Zapisnik ne vsebuje naslova v slovenščini" : "Das Protokoll enthält keinen Titel in deutscher Sprache"}.<br><br>`, "</h2>");
        agendas = buildHtmlElement("<div class='agenda-text'>", searchedForMeeting.agendas.find(agenda => agenda.lang == lang)?.items.map(item => item.text).join("</div><div class='agenda-text'>"), `${lang === 'sl' ? "Zapisnik ne vsebuje dnevnega reda" : "Das Protokoll enthält nicht die Tagesordnung"}.<br><br>`, "</div>");
        content = segments.map(segment => {
            const speaker = buildHtmlElement("<br><h5 class='speaker-text'>", segment.sentences.hits.hits[0]._source.speaker, `${lang === 'sl' ? "Neimenovani govorec" : "Ungenannter Sprecher"}:<br><br>`, "</h5>");
            const sentences = buildHtmlElement("<div class='segment-text'>", segment.sentences.hits.hits.map(sentence => sentence._source.translations.find(translation => translation.lang == lang)?.text).join(""), "", "</div>");
            return speaker + sentences;
        })

        text = title
            + "<h3 class='agendas-title'>" + getAgendaTitle(lang) + "</h3><div class='agendas'>"
            + agendas
            + "</div>" 
            + "<div class='segment'>" 
            + content.join("<div class='segment'></div>") 
            + "</div>";
    }

    res.json({
        text: text,
        segments: segments
    });
} 

function buildHtmlElement(start, text, alternativeText, end) {
    let htmlElement = start;
    htmlElement += text ?? alternativeText;
    htmlElement += end;
    return htmlElement;
}

function getAgendaTitle(lang) {
    switch (lang) {
        case "sl":
            return "Dnevni red";
        case "de":
            return "Tagesordnung";
        case "en":
            return "Agenda";
        default:
            return "Agenda";
    }
}

module.exports = {
    getMeetingAsText,
    getPage
};