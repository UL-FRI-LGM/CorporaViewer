import {Request, Response} from "express";
import capTopicsRepository from "../repositories/capTopicsRepository";
import {CapTopicsIndexDocument} from "../../models/CapTopicsIndexDocument";
import {SearchHit} from "@elastic/elasticsearch/lib/api/types";


const getAll = async (req: Request, res: Response) => {
    try {
        const allCapTopics: SearchHit<CapTopicsIndexDocument>[] = await capTopicsRepository.getAllCapTopics();
        res.json(allCapTopics);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: "Internal server error"});
    }
}

export default {
    getAll
}
