require('dotenv').config();
const esClient = require('../../services/elasticsearch');

var getAll = async (req, res) => {
    const sort = req.query.sort ? req.query.sort : "names.sl.keyword";
    try {
        const response = await esClient.search({
            index: process.env.PLACES_INDEX_NAME || 'places-index',
            body: {
                query: {
                    match_all: {}
                },
                size: 10000,
                sort: {
                    [sort]: {
                        order: "asc"
                    }
                }
            }
        });
        res.json(response.hits.hits);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// implement scroll funciton(s) here

module.exports = {
    getAll
};