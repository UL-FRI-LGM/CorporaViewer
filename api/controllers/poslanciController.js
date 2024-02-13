require('dotenv').config();
const esClient = require('../../services/elasticsearch');

var getAll = async (req, res) => {
    try {
        const response = await esClient.search({
            index: process.env.ATTENDES_INDEX_NAME || 'attendees-index',
            body: {
                query: {
                    match_all: {}
                },
                size: 1000
            }
        });
        res.json(response.hits.hits);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getAll
};