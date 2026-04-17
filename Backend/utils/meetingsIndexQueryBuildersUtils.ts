import {CorpusSearchFilters} from "../models/CorpusSearchFilters";
import {format} from "date-fns";
import {GetPageQueryParams} from "../models/GetPageQueryParams";
import utils from "../utils/utils";


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


const buildMeetingsPageQuery = (queryParams: GetPageQueryParams): any => {

    let innerQuery: any;

    /* IF THERE IS ONLY SPEAKER PROVIDED, IT'S A SPECIAL CASE */
    const isOnlySpeakerProvided: boolean = queryParams.speaker && queryParams.speaker.length > 0 && queryParams.words.length === 0 && queryParams.placeNames.length === 0 && queryParams.personEntities.length === 0 && queryParams.locationEntities.length === 0;
    let areContentQueriesPresent;
    let arePlacesQueriesPresent;
    if (isOnlySpeakerProvided) {
        /* BUILD INNER QUERY THAT GETS MEETINGS THAT CONTAIN UTTERANCE OF SELECTED SPEAKER */

        // 1. Build a speaker query
        const speakerQuery: any = {
            bool: {
                must: [
                    {terms: {"sentences.translations.lang.keyword": queryParams.filters!.languages!.split(",")}},
                    {
                        bool: {
                            should: queryParams.speaker!.map(speaker => {
                                return {match: {"sentences.translations.speaker": speaker}}
                            }),
                            minimum_should_match: 1
                        }
                    }
                ]
            }
        }

        // 2. Add filter for the original language if multiple languages are selected
        const areMultipleLanguagesSelected: boolean = queryParams.filters!.languages!.split(",").length > 1;
        if (areMultipleLanguagesSelected) {
            speakerQuery.bool.must.push({match: {"sentences.translations.original": 1}})
        }

        innerQuery = {
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

    } else {
        /* BUILD INNER QUERY THAT FILTERS MEETINGS BASED ON SEARCHED CONTENTS */

        // 1. Save filters that are used in a content query
        const contentsQueryFilters: any = [];
        // Add language filters
        contentsQueryFilters.push({terms: {"sentences.translations.lang.keyword": queryParams.filters!.languages!.split(",")}});
        // Add speaker filters
        if (queryParams.speaker && queryParams.speaker.length > 0) {
            contentsQueryFilters.push({
                bool: {
                    should: queryParams.speaker.map(speaker => {
                        return {match: {"sentences.translations.speaker": speaker}}
                    }),
                    minimum_should_match: 1
                }
            });
        }


        // 2. Build contents query
        const tokenizedQuery: string[][] = utils.tokenizeQuery(queryParams.words);

        const contentsQueries: any = []
        for (const tokenGroup of tokenizedQuery) {

            const isTokenGroupEmpty: boolean = !tokenizedQuery || tokenGroup.length === 0;
            if (isTokenGroupEmpty) {
                continue;
            }

            const isTokenGroupSingle: boolean = tokenGroup.length === 1;
            if (isTokenGroupSingle) {
                contentsQueries.push(utils.buildShouldMatchLemmaAndTextQuery(tokenGroup[0], contentsQueryFilters));
            } else {
                contentsQueries.push({
                    bool: {
                        must: tokenGroup.map(token => {
                            return utils.buildShouldMatchLemmaAndTextQuery(token, contentsQueryFilters)
                        })
                    },
                });
            }
        }

        // 3. Build a place query
        const placesQueries: any = [];
        for (const place of queryParams.placeNames!) {

            const isPlaceNameEmpty: boolean = !place || !place.name || place.name === "";
            if (isPlaceNameEmpty) {
                continue;
            }

            const isPlaceNameOneWord: boolean = place.name.split(" ").length === 1;
            if (isPlaceNameOneWord) {
                placesQueries.push(utils.buildShouldMatchLemmaAndTextPlaceQuery(place!.name, contentsQueryFilters));
            } else {
                placesQueries.push({
                    bool: {
                        must: place.name.split(" ").map(word => {
                            return utils.buildShouldMatchLemmaAndTextPlaceQuery(word, contentsQueryFilters)
                        })
                    },
                });
            }
        }

        // 4. Build inner query
        innerQuery = {
            nested: {
                path: "sentences.translations",
                query: {
                    bool: {
                        must: []
                    }
                },
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
        }

        areContentQueriesPresent = contentsQueries.length > 0;
        if (areContentQueriesPresent) {
            innerQuery.nested.query.bool.must.push({
                bool: {
                    should: contentsQueries,
                    minimum_should_match: 1
                }
            });
        }

        arePlacesQueriesPresent = placesQueries.length > 0;
        if (arePlacesQueriesPresent) {
            innerQuery.nested.query.bool.must.push({
                bool: {
                    should: placesQueries,
                    minimum_should_match: 1
                }
            });
        }

        // Add person entity filters (directly to nested query, same level as lang/speaker)
        if (queryParams.personEntities) {
            const entitiesArray = queryParams.personEntities
                .split(',')
                .map(e => e.trim())
                .filter(e => e.length > 0);

            innerQuery.nested.query.bool.must.push({
                terms: {"sentences.translations.person_entities": entitiesArray}
            });
        }

        // Add location entity filters
        if (queryParams.locationEntities) {
            const entitiesArray = queryParams.locationEntities
                .split(',')
                .map(e => e.trim())
                .filter(e => e.length > 0);

            innerQuery.nested.query.bool.must.push({
                terms: {"sentences.translations.location_entities": entitiesArray}
            });
        }
    }

    /* BUILD OUTER QUERY THAT FILTERS MEETINGS BASED ON DATE */
    const outerQuery: any = {
        bool:
            {
                filter: [],
                must: []
            }
    };

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
        outerQuery.bool.filter.push({
            terms: {
                "cap_topics_aggregated": queryParams.capTopics
                    .split(",")
                    .map(t => decodeURIComponent(t.trim()))
            }
        })
    }

    // 2. Add inner query to outer query
    const arePersonEntitiesPresent = !!queryParams.personEntities && queryParams.personEntities.length > 0;
    const areLocationEntitiesPresent = !!queryParams.locationEntities && queryParams.locationEntities.length > 0;
    const isInnerQueryNeeded = isOnlySpeakerProvided || areContentQueriesPresent || arePlacesQueriesPresent || arePersonEntitiesPresent || areLocationEntitiesPresent;
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


const buildSpeakerUtterancesQuery = (meetingId: string, speaker: string): any => {
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
                    match_phrase: {
                        speaker: {
                            query: speaker
                        }
                    }
                }
            ]
        }
    };
}


export default {
    buildAllMeetingsQuery,
    buildMeetingsPageQuery,
    buildSpeakerUtterancesQuery
}
