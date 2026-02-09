import {Response} from "express";
import {ReadStream} from "fs";

export class TaskData {
    path: string;
    res: Response;

    constructor(path: string, res: Response) {
        this.path = path;
        this.res = res;
    }
}
