import {SearchResponse} from "@elastic/elasticsearch/lib/api/types";
import esClient from "../database/elasticsearch";
import {PlacesIndexDocument} from "../../models/PlacesIndexDocument";

const getAllPlaces = async (sortPlacesBy: string) => {

    const placesIndexSearchResponse: SearchResponse<PlacesIndexDocument> = await esClient.search({
        index: process.env.PLACES_INDEX_NAME || 'places-index',
        body: {
            query: {
                match_all: {}
            },
            size: 10000,
            sort: {
                [sortPlacesBy]: {
                    order: "asc"
                }
            }
        }
    });

    return placesIndexSearchResponse.hits.hits;
}


const getMapLocations = async (meetingIds: string[]) => {
    // Step 1: aggregate unique location_entities for those meetings from sentences-index
    const sentencesResponse = await esClient.search({
        index: process.env.SENTENCES_INDEX_NAME || 'sentences-index',
        body: {
            query: { terms: { meeting_id: meetingIds } },
            size: 0,
            aggs: {
                locations: {
                    terms: { field: 'location_entities', size: 200 }
                }
            }
        }
    });

    const buckets = (sentencesResponse.aggregations?.locations as any)?.buckets ?? [];
    if (buckets.length === 0) return [];

    const counts: Record<string, number> = {};
    buckets.forEach((b: any) => { counts[b.key] = b.doc_count; });

    // Step 2: get coordinates from places-index, attach counts
    return getCoordsWithCounts(Object.keys(counts), counts);
}

const getCoordsWithCounts = async (names: string[], counts: Record<string, number> = {}) => {
    const response = await esClient.search<PlacesIndexDocument>({
        index: process.env.PLACES_INDEX_NAME || 'places-index',
        body: {
            query: { terms: { 'names.sl.keyword': names } },
            size: names.length,
            _source: ['names.sl', 'coordinates']
        }
    });

    return response.hits.hits
        .filter(hit => hit._source?.coordinates)
        .map(hit => ({
            name: hit._source!.names.sl,
            lat: hit._source!.coordinates!.lat,
            lon: hit._source!.coordinates!.lon,
            count: counts[hit._source!.names.sl] ?? 1
        }));
}

const getCoords = async (names: string[]) => getCoordsWithCounts(names);


export default {
    getAllPlaces,
    getCoords,
    getMapLocations
}
