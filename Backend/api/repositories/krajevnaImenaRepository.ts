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


export default {
    getAllPlaces
}
