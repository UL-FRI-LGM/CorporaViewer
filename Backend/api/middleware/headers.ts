import {NextFunction, Request, Response} from "express";

const setHtmlChunkedHeaders = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    next();
}

export default {
    setHtmlChunkedHeaders
}
