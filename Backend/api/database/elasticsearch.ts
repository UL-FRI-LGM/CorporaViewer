import {Client} from "@elastic/elasticsearch";

const hosts: string | string[] = (process.env.ELASTICSEARCH_HOSTS || 'http://localhost:9200').split(',');
const esClient: Client = new Client({
    node: hosts,
    maxRetries: 5,
    requestTimeout: 60000,
});

export default esClient;

