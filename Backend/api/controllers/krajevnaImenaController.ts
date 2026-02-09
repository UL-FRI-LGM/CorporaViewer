import {Request, Response} from 'express';
import krajevnaImenaRepository from "../repositories/krajevnaImenaRepository";
import {KrajevnaImenaRequestQuery} from "../../models/KrajevnaImenaRequestQuery";
import {PlacesIndexDocument} from "../../models/PlacesIndexDocument";
import {SearchHit} from "@elastic/elasticsearch/lib/api/types";

const getAll = async (req: Request<{}, {}, {}, KrajevnaImenaRequestQuery>, res: Response) => {
    try {
        const sortPlacesBy: string = req.query.sort || "names.sl.keyword";
        const allPlaces: SearchHit<PlacesIndexDocument>[] = await krajevnaImenaRepository.getAllPlaces(sortPlacesBy);
        res.json(allPlaces);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: "Internal server error"});
    }
}


export default {
    getAll
}
