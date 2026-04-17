import {Request, Response} from "express";
import personEntitiesRepository from "../repositories/personEntitiesRepository";
import {PersonEntitiesIndexDocument} from "../../models/PersonEntitiesIndexDocument";
import {SearchHit} from "@elastic/elasticsearch/lib/api/types";


const getAll = async (req: Request, res: Response) => {
    try {
        const allPersonEntities: SearchHit<PersonEntitiesIndexDocument>[] = await personEntitiesRepository.getAllPersonEntities();
        res.json(allPersonEntities);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: "Internal server error"});
    }
}

export default {
    getAll
}
