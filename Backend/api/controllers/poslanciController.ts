import {Request, Response} from "express";
import poslanciRepository from "../repositories/poslanciRepository";
import {AttendeesIndexDocument} from "../../models/AttendeesIndexDocument";
import {SearchHit} from "@elastic/elasticsearch/lib/api/types";


const getAll = async (req: Request, res: Response) => {
    try {
        const allAttendees: SearchHit<AttendeesIndexDocument>[] = await poslanciRepository.getAllAttendees();
        res.json(allAttendees);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: "Internal server error"});
    }
}

export default {
    getAll
}
