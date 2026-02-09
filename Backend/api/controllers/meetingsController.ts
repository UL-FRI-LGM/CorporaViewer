import {NextFunction, Request, Response} from 'express';
import {GetPageRequestQuery} from "../../models/GetPageRequestQuery";
import utils from "../../utils/utils";
import meetingsRepository from "../repositories/meetingsRepository";
import {GetPageQueryParams} from "../../models/GetPageQueryParams";
import {GetPageRequestParams} from "../../models/GetPageRequestParams";
import {GetMeetingAsTextRequestParams} from "../../models/GetMeetingAsTextrRequestParams";
import {GetMeetingAsTextRequestQuery} from "../../models/GetMeetingAsTextRequestQuery";
import {GetSpeakersRequestParams} from "../../models/GetSpeakersRequestParams";
import {GetHighlightsRequestParams} from "../../models/GetHighlightsRequestParams";
import {GetHighlightsRequestQuery} from "../../models/GetHighlightsRequestQuery";

const getPage = async (req: Request<GetPageRequestParams, {}, {}, GetPageRequestQuery>, res: Response) => {

    let queryParams: GetPageQueryParams;
    try {
        queryParams = utils.parseMeetingsRequestQuery(req);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: `Internal server error`});
        return;
    }
    const {filters, words, speaker, placeNames, page, pitId, searchAfterScore, searchAfterDate} = queryParams;


    const areAllRequiredFiltersProvided: boolean = Boolean(filters.dateFrom && filters.dateTo && filters.languages && filters.corpora && page);
    if (!areAllRequiredFiltersProvided) {
        res.status(400).json({
            error: `Bad request, missing:` +
                `${!filters.dateFrom ? " dateFrom" : ""}` +
                `${!filters.dateTo ? " dateTo" : ""}` +
                `${!filters.languages ? " languages" : ""}` +
                `${!filters.corpora ? " corpora" : ""}` +
                `${!page ? " page" : ""}`,
            meetings: [],
            total: 0,
            page: page,
            pitId: null,
            searchAfterScore: null,
            searchAfterDate: null,
            searchAfterIndex: null
        });
        return;
    }

    // check if search has at least one language and corpus selected
    if (filters.languages === "" || filters.corpora === "") {
        res.json({
            meetings: [],
            total: 0,
            page: page,
            pitId: null,
            searchAfterScore: null,
            searchAfterDate: null,
            searchAfterIndex: null
        });
        return;
    }


    const noSearchParamsProvided: boolean = Boolean(!words && speaker.length === 0 && placeNames.length === 0);
    if (noSearchParamsProvided) {
        try {
            const allMeetingsData = await meetingsRepository.getAllMeetings(filters, page);
            res.json(allMeetingsData);
            return;

        } catch (error: any) {
            console.error(error);
            res.status(500).json({error: `Internal server error`});
            return;
        }
    }


    // check if the page is valid
    if (page < 1) {
        res.status(400).json({error: `Bad request, invalid page`});
        return;
    } else if (page > 1 && (!pitId || (!searchAfterScore && filters.sort === "relevance") || !searchAfterDate)) {
        res.status(400).json({
            error: `Bad request, missing:` +
                `${!pitId ? " pitId" : ""}` +
                `${!searchAfterScore && filters.sort === "relevance" ? " searchAfterScore" : ""}` +
                `${!searchAfterDate ? " searchAfterDate" : ""}`
        });
        return;
    }


    try {
        const pageOfMeetings = await meetingsRepository.getPage(queryParams);
        res.json(pageOfMeetings);
        return;

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: `Internal server error`});
        return;
    }
}


const getMeetingAsText = async (req: Request<GetMeetingAsTextRequestParams, {}, {}, GetMeetingAsTextRequestQuery>, res: Response) => {

    const meetingId: string | undefined = req.params.meetingId;
    const pageLang: string | undefined = req.query.pageLang;
    const translationLang: string | undefined = req.query.lang;


    if (!meetingId) {
        res.status(400).json({
            error: "Bad request, missing: meetingId"
        });
        return;
    }

    try {
        const textContents: string = await meetingsRepository.getMeetingAsText(meetingId, pageLang!, translationLang!);
        res.json({
            text: textContents
        });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: `Internal server error`});
    }
}


const getSpeakers = async (req: Request<GetSpeakersRequestParams, {}, {}, {}>, res: Response) => {

    const meetingId: string | undefined = req.params.meetingId;

    if (!meetingId) {
        res.status(400).json({
            error: "Bad request, missing: meetingId"
        });
        return;
    }

    try {
        const speakers: string[] = await meetingsRepository.getSpeakers(meetingId);
        res.json({
            speakers: speakers
        });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({error: `Internal server error`});
    }
}


const getHighlights = async (req: Request<GetHighlightsRequestParams, {}, {}, GetHighlightsRequestQuery>, res: Response, next: NextFunction) => {

    const meetingId: string | undefined = req.params.meetingId;
    const query: string | undefined = req.query.words;
    const speaker: string | undefined = req.query.speaker;
    const lang: string | undefined = req.query.lang;
    const looseSearch: boolean = req.query.looseSearch === true;

    const areAllRequiredParamsProvided: boolean = Boolean(meetingId && (query || speaker));
    if (!areAllRequiredParamsProvided) {
        res.status(400).json({
            error: `Bad request, missing:` +
                `${!meetingId ? " meetingId" : ""}` +
                `${!query && !speaker ? " query or speaker" : ""}`,
        });
        return;
    }

    const doWeSearchForSpeakersUtterances: boolean = Boolean(!query && speaker);
    if (doWeSearchForSpeakersUtterances) {

        try {
            const speakerUtterancesHighlights = meetingsRepository.getSpeakerUtterancesHighlights(meetingId!, speaker!);
            for await (const speakerUtteranceHighlights of speakerUtterancesHighlights) {
                // Send the partial response to the client
                res.write(JSON.stringify({
                    highlights: speakerUtteranceHighlights
                }) + "\n");
            }
        } catch (error: any) {
            console.error(error);
            res.status(500).json({error: "Internal server error"});
        }

    } else {

        try {
            const highlights = meetingsRepository.getHighlights(meetingId!, query!, speaker, lang, looseSearch);
            for await (const highlight of highlights) {
                // Send the partial response to the client
                res.write(JSON.stringify({
                    highlights: highlight
                }) + "\n");
            }

        } catch (error: any) {
            console.error(error);
            res.status(500).json({error: "Internal server error"});
        }
    }

    res.end();
}


export default {
    getPage,
    getMeetingAsText,
    getSpeakers,
    getHighlights
};
