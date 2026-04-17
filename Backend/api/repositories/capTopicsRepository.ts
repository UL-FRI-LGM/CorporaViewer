import esClient from "../database/elasticsearch";
import {SearchResponse} from "@elastic/elasticsearch/lib/api/types";
import {CapTopicsIndexDocument} from "../../models/CapTopicsIndexDocument";

const getAllCapTopics = async () => {

    const capTopicsIndexSearchResponse: SearchResponse<CapTopicsIndexDocument> = await esClient.search({
        index: process.env.CAP_TOPICS_INDEX_NAME || 'cap-topics-index',
        body: {
            query: {match_all: {}},
            size: 1000
        }
    });

    return capTopicsIndexSearchResponse.hits.hits;
}

export default {
    getAllCapTopics
}
