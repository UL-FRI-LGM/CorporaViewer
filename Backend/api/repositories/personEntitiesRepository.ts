import esClient from "../database/elasticsearch";
import {SearchResponse} from "@elastic/elasticsearch/lib/api/types";
import {PersonEntitiesIndexDocument} from "../../models/PersonEntitiesIndexDocument";

const getAllPersonEntities = async () => {

    const personEntitiesIndexSearchResponse: SearchResponse<PersonEntitiesIndexDocument> = await esClient.search({
        index: process.env.PERSON_ENTITIES_INDEX_NAME || 'person-entities-index',
        body: {
            query: {match_all: {}},
            size: 1000
        }
    });

    return personEntitiesIndexSearchResponse.hits.hits;
}

export default {
    getAllPersonEntities
}
