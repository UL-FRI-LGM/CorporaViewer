require('dotenv').config();
const fs = require('fs');
const async = require('async');

// Create a queue with a concurrency limit of 10
const queue = async.queue(async (taskData) => {
    try {
        const path = taskData.path;
        var file = fs.createReadStream(path);
        const res = taskData.res;

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename=${taskData.filename}`);
        file.pipe(res);
    } catch (error) {
        console.error("Error processing thumbnail request:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}, 1); // Concurrency limit set to 10

function reformatId(id) {
    const reformattedId = id.split("_").map((item, index) => {
        if (index > 1) {
            return item.replace(/-/g, "p");
        }
        else {
            return item;
        }
    }).join("_");
    return reformattedId;
}

var getById = async (req, res) => {
    const filename = reformatId(req.params.id);

    const path = (process.env.PATH_TO_DATA || '/home/martin/Data/CorporaViewer') + `/DZK/Kranjska-pdf/${filename}.pdf`

    var file = fs.createReadStream(path);
    var stat = fs.statSync(path);
    
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
    file.pipe(res);
}

var getThumbnailById = async (req, res) => {
    const filename = reformatId(req.params.id);

    const path = (process.env.PATH_TO_DATA || '/home/martin/Data/CorporaViewer') + `/DZK/thumbnails/${filename}.png`

    if (!fs.existsSync(path)) {
        return res.status(404).json({ error: "Thumbnail not found" });
    }

    // Enqueue the thumbnail request
    queue.push(
        { path, filename, res }
    );
};

module.exports = {
    getById,
    getThumbnailById
};