import esClient from "../database/elasticsearch";
import {SearchResponse} from "@elastic/elasticsearch/lib/api/types";
import {AttendeesIndexDocument} from "../../models/AttendeesIndexDocument";

const getAllAttendees = async () => {

    const attendeesIndexSearchResponse: SearchResponse<AttendeesIndexDocument> = await esClient.search({
        index: process.env.ATTENDEES_INDEX_NAME || 'attendees-index',
        body: {
            query: {match_all: {}},
            size: 1000
        }
    });

    return attendeesIndexSearchResponse.hits.hits;
}

export default {
    getAllAttendees
}
