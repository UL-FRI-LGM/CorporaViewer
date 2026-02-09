import {Request, Response} from 'express';
import async, {QueueObject} from 'async';
import {TaskData} from "../../models/TaskData";
import sendFileStrategySelector from "../../strategies/sendFileStrategySelector";
import pdfRepository from "../repositories/pdfRepository";
import {SendFileStrategy} from "../../strategies/SendFileStrategy";
import * as fs from "fs";
import {ReadStream} from "fs";
import * as path from "path";


const queue: QueueObject<TaskData> = async.queue(async (taskData: TaskData, callback) => {
    try {
        const doesFileExist: boolean = fs.existsSync(taskData.path);
        if (!doesFileExist) {
            const error: any = new Error("File not found");
            error.status = 404;
            throw error;
        }

        // Get the data stream from the file
        const dataStream: ReadStream = pdfRepository.getDataStream(taskData.path);

        // Resolve the strategy based on file extension
        const fileExtension: string = path.extname(taskData.path);
        const strategy: SendFileStrategy = sendFileStrategySelector.getStrategy(fileExtension);

        // Set headers and send the response
        strategy.sendResponse(taskData.res, dataStream, taskData.path);

    } catch (error: any) {
        console.error(error);
        taskData.res.status(error.status || 500).json({error: error.message || "Internal server error"});
    }

    return callback();
}, 10);


const getById = async (req: Request, res: Response) => {
    try {
        const filename: string = req.params.id;
        const pdfFilePath: string = (process.env.PATH_TO_DATA || '/home/david/Data/CorporaViewer') + `/pdfs/${filename}.pdf`

        await queue.push(
            new TaskData(pdfFilePath, res)
        );

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: "Internal server error"});
    }
}


const getThumbnailById = async (req: Request, res: Response) => {
    try {
        const filename: string = req.params.id;
        const thumbnailFilePath: string = (process.env.PATH_TO_DATA || '/home/david/Data/CorporaViewer') + `/thumbnails/${filename}.png`;

        await queue.push(
            new TaskData(thumbnailFilePath, res),
        );

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: "Internal server error"});
    }
}


export default {
    getById,
    getThumbnailById
}
