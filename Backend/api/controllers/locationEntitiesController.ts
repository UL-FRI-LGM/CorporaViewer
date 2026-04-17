import {Request, Response} from "express";
import locationEntitiesRepository from "../repositories/locationEntitiesRepository";
import {LocationEntitiesIndexDocument} from "../../models/LocationEntitiesIndexDocument";
import {SearchHit} from "@elastic/elasticsearch/lib/api/types";


const getAll = async (req: Request, res: Response) => {
    try {
        const allLocationEntities: SearchHit<LocationEntitiesIndexDocument>[] = await locationEntitiesRepository.getAllLocationEntities();
        res.json(allLocationEntities);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: "Internal server error"});
    }
}

export default {
    getAll
}
