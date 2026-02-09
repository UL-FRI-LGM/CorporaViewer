import * as fs from "fs";


const getDataStream = (path: string) => {
    return fs.createReadStream(path);
}

export default {getDataStream}
