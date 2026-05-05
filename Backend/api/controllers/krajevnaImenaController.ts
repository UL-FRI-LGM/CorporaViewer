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


const getCoords = async (req: Request, res: Response) => {
    try {
        const raw = req.query.names;
        const namesParam = Array.isArray(raw) ? (raw[0] as string) : (raw as string | undefined);
        if (!namesParam) {
            res.status(400).json({error: "Missing names[] parameter"});
            return;
        }
        const names = namesParam.split(',').map(n => n.trim()).filter(Boolean);
        const coords = await krajevnaImenaRepository.getCoords(names);
        res.json(coords);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: "Internal server error"});
    }
}


const getMapLocations = async (req: Request, res: Response) => {
    try {
        const raw = req.query.meetingIds;
        const idsParam = Array.isArray(raw) ? (raw[0] as string) : (raw as string | undefined);
        if (!idsParam) {
            res.status(400).json({error: "Missing meetingIds[] parameter"});
            return;
        }
        const meetingIds = idsParam.split(',').map(id => id.trim()).filter(Boolean);
        const locations = await krajevnaImenaRepository.getMapLocations(meetingIds);
        res.json(locations);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: "Internal server error"});
    }
}


export default {
    getAll,
    getCoords,
    getMapLocations
}
