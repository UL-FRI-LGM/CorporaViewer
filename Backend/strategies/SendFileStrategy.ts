import * as fs from 'fs'
import {ReadStream} from 'fs'
import {Response} from "express";
import Path from 'path'

export interface SendFileStrategy {
    sendResponse(res: Response, dataStream: ReadStream, path: string): void;
}


export class SendPngImageStrategy implements SendFileStrategy {

    sendResponse(res: Response, dataStream: ReadStream, path: string) {
        const filename: string = Path.basename(path);

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        dataStream.pipe(res);
    }

}

export class SendPDFStrategy implements SendFileStrategy {

    async sendResponse(res: Response, dataStream: ReadStream, path: string) {
        const stat: fs.Stats = fs.statSync(path);
        const filename: string = Path.basename(path);

        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        dataStream.pipe(res);
    }

}





