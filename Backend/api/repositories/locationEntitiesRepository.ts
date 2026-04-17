import esClient from "../database/elasticsearch";
import {SearchResponse} from "@elastic/elasticsearch/lib/api/types";
import {LocationEntitiesIndexDocument} from "../../models/LocationEntitiesIndexDocument";

const getAllLocationEntities = async () => {

    const locationEntitiesIndexSearchResponse: SearchResponse<LocationEntitiesIndexDocument> = await esClient.search({
        index: process.env.LOCATION_ENTITIES_INDEX_NAME || 'location-entities-index',
        body: {
            query: {match_all: {}},
            size: 1000
        }
    });

    return locationEntitiesIndexSearchResponse.hits.hits;
}

export default {
    getAllLocationEntities
}
