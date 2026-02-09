import {PlaceName} from "../models/PlaceName";
import {Request} from "express";
import {GetPageRequestQuery} from "../models/GetPageRequestQuery";
import {CorpusSearchFilters} from "../models/CorpusSearchFilters";
import {GetPageQueryParams} from "../models/GetPageQueryParams";
import {SortCombinations} from "@elastic/elasticsearch/lib/api/types";
import {GetPageRequestParams} from "../models/GetPageRequestParams";
import {Word} from "../models/Word";
import {HtmlElementBuilder} from "../builders/HtmlElementBuilder";
import {Highlight, Rect} from "../models/Highlight";
import {Coordinate} from "../models/UtteranceBucket";
import {WordsIndexDocument} from "../models/WordsIndexDocument";


const buildShouldMatchLemmaAndTextQuery = (word: string, filters: any) => {
    return {
        bool: {
            should: [
                {match_phrase: {"sentences.translations.words.lemma": word}},
                {match_phrase: {"sentences.translations.text": word}},
            ],
            minimum_should_match: 1,
            filter: filters
        }
    }
}

const buildShouldMatchLemmaAndTextPlaceQuery = (placeName: string, filters: any) => {
    return {
        bool: {
            should: [
                {match_phrase: {"sentences.translations.text": placeName}},
                {match_phrase: {"sentences.translations.words.lemma": placeName}},
                {term: {"sentences.translations.words.propn": {value: 1}}}
            ],
            minimum_should_match: 2,
            filter: filters
        }
    }
}

const tokenizeQuery = (query: string): string[][] => {
    const orQueries = query.split("OR");

    //extract words in quotes as 1 string, split the rest of the words on spaces (ignore empty strings)
    return orQueries.map(orQuery => {
        const wordsInQuotes = orQuery.match(/"([^"]+)"/g)?.map(word => word.replace(/"/g, ''));
        const wordsWithoutQuotes = orQuery.replace(/"([^"]+)"/g, '').split(" ").filter(word => word !== "");
        return [...(wordsInQuotes || []), ...(wordsWithoutQuotes || [])];
    });
}

const parseSpeaker = (speakerNames: string | undefined): string[] => {
    if (!speakerNames) return [];

    const speakers = speakerNames.split(",");
    const result: string[] = [];

    for (let i = 0; i < speakers.length; i++) {
        // Remove unwanted characters from speaker name
        const cleanSpeaker = speakers[i].replace(/[^a-zA-ZäöüßÄÖÜčšžČŠŽ. 0-9\-]/g, "");
        // Split name into parts
        const parts = cleanSpeaker.split(" ");
        // Get last part of name as surname
        const surname = parts[parts.length - 1]

        result.push(surname);
    }

    return result;
};

const parsePlace = (placeNames: string | undefined): PlaceName[] => {
    if (!placeNames) return [];

    // get lang and name from pattern {lang:name}
    const place_names_str: string [] = placeNames.match(/{([^}]+)}/g)?.map(place => place.replace(/[{}]/g, '')) || []
    return place_names_str.map(place => {
        const split: string[] = place.split(":")
        return {
            lang: split[0],
            name: split[1] || ""
        } as PlaceName
    })
};

const parseSort = (sort: string): SortCombinations[] => {
    switch (sort) {
        case "date_asc":
            return [{"date": {"order": "asc"}}];
        case "date_desc":
            return [{"date": {"order": "desc"}}];
        default:
            return [{"_score": {"order": "desc"}}, {"date": {"order": "asc"}}];
    }
}

const parseSearchAfterParams = (sort: string, searchAfterScore: string, searchAfterDate: string, searchAfterIndex: string): string[] => {
    switch (sort) {
        case "date_asc":
            return [searchAfterDate, searchAfterIndex]
        case "date_desc":
            return [searchAfterDate, searchAfterIndex]
        default:
            return [searchAfterScore, searchAfterDate, searchAfterIndex]
    }
}

const getNoTitleMessage = (lang: string): string => {
    switch (lang) {
        case "sl":
            return "Zapisnik ne vsebuje naslova v slovenščini";
        case "de":
            return "Das Protokoll enthält keinen Titel in deutscher Sprache";
        case "hr":
            return "Zapisnik ne sadrži naslov na hrvatskom jeziku";
        case "sr":
            return "Записник не садржи наслов на српском језику";
        default:
            return "The minutes do not contain a title in English";
    }
}

const getNoAgendaMessage = (lang: string): string[] => {
    switch (lang) {
        case "sl":
            return ["Zapisnik ne vsebuje dnevnega reda"];
        case "de":
            return ["Das Protokoll enthält nicht die Tagesordnung"];
        case "hr":
            return ["Zapisnik ne sadrži dnevni red"];
        case "sr":
            return ["Записник не садржи дневни ред"];
        default:
            return ["The minutes do not contain an agenda"];
    }
}

const getAgendaTitle = (lang: string): string => {
    switch (lang) {
        case "sl":
            return "Dnevni red";
        case "de":
            return "Tagesordnung";
        case "hr":
            return "Dnevni red";
        case "sr":
            return "Дневни ред";
        default:
            return "Agenda";
    }
}

const joinWords = (words: Word[]): string => {
    let joined = [];
    for (let i = 0; i < words.length; i++) {

        let wordHtmlElement: string = new HtmlElementBuilder('span')
            .withAttribute('id', words[i].id)
            .withText(words[i].text)
            .buildString();

        joined.push(wordHtmlElement);

        if (words[i].join === "natural") {
            joined.push(' ');
        }

    }
    return joined.join('');
}

const parseMeetingsRequestQuery = (req: Request<GetPageRequestParams, {}, {}, GetPageRequestQuery>): GetPageQueryParams => {
    const words: string = req.query.words || "";
    const speaker: string[] = parseSpeaker(req.query.speaker);
    const placeNames: PlaceName[] = parsePlace(req.query.place);
    const filters: CorpusSearchFilters = {
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        languages: req.query.languages,
        corpora: req.query.corpora,
        sort: req.query.sort,
    };
    const page: number = req.params.page ? parseInt(req.params.page) : 1;
    const pitId: string | undefined = req.query.pitId;
    const searchAfterScore: string | undefined = req.query.searchAfterScore;
    const searchAfterDate: string | undefined = req.query.searchAfterDate;
    const searchAfterIndex: string | undefined = req.query.searchAfterIndex;

    return {
        words,
        speaker,
        placeNames,
        filters,
        page,
        pitId,
        searchAfterScore,
        searchAfterDate,
        searchAfterIndex,
    } as GetPageQueryParams;
}

const groupCoordinates = (coordinates: Coordinate[]): Rect[] => {
    return coordinates.reduce((acc: Rect[], coord: Coordinate) => {
        // Find or create an entry for the current page
        let pageGroup = acc.find(item => item.page === coord.page);

        if (!pageGroup) {
            pageGroup = {page: coord.page, coordinates: []};
            acc.push(pageGroup);
        }

        // Find if there's an existing coordinate with the same y0 value
        const existing = pageGroup.coordinates.find(
            c => c.y0 === coord.y0
        );

        if (existing) {
            // Update x0 to be the minimum, and x1 to be the maximum
            existing.x0 = Math.min(existing.x0, coord.x0);
            existing.x1 = Math.max(existing.x1, coord.x1);
        } else {
            // If no match is found for y0, add the new coordinate to the coordinates array
            pageGroup.coordinates.push({x0: coord.x0, y0: coord.y0, x1: coord.x1, y1: coord.y1});
        }

        return acc;
    }, []);
}

const tokenizeQueryDocumentSearch = (query: string) => {
    // Match quoted strings and non-quoted parts
    const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
    let groupedTokens = [];
    let match;

    while ((match = regex.exec(query)) !== null) {
        if (match[1]) {
            // Double-quoted text, split into tokens
            groupedTokens.push(match[1].split(/\s+/));
        } else if (match[2]) {
            // Single-quoted text, split into tokens
            groupedTokens.push(match[2].split(/\s+/));
        } else if (match[3]) {
            // Non-quoted part
            groupedTokens.push([match[3]]);
        }
    }

    return groupedTokens;
}

const getEmTagIndexes = (text: string) => {

    // Remove all non-alphanumeric characters except <em> and </em> tags
    let sanitizedText = text.replace(/(?![<\/?em>])[^\p{L}\p{N}\s]/gu, "");

    const emTagPattern = /<em>.*?<\/em>/gu; // Pattern to match <em> tags
    const punctuationRegex = /[\p{P}]/gu; // Regex to match punctuation characters except .
    let indexes = [];
    let wordIndex = -1;
    let match;

    while ((match = emTagPattern.exec(sanitizedText)) !== null) {

        // Count the words before the match and add it to the indexes
        let wordsBefore = sanitizedText.substring(0, match.index).split(/\s+/).filter(word => word.length > 0);
        wordsBefore = wordsBefore.filter(word => !word.match(punctuationRegex));

        wordIndex += Math.max(0, wordsBefore.length) + 1;
        indexes.push(wordIndex);

        // Remove the matched part from the text to continue search and reset the regex index
        sanitizedText = sanitizedText.slice(match.index + match[0].length);
        emTagPattern.lastIndex = 0;
    }

    return indexes;
}

const groupWordsByPosition = (words: WordsIndexDocument[]): Highlight[] => {

    const groups: any = [];

    for (let i = 0; i < words.length; i++) {

        const word = words[i];

        // Start a new group
        if (i === 0 || (word.wpos - words[i - 1].wpos) > 1) {

            // Group the coordinates of the previous group
            if (i > 0) {
                const currentGroup = groups[groups.length - 1];
                currentGroup.rects = groupCoordinates(currentGroup.rects);
            }

            groups.push({
                ids: [],
                rects: [],
            });
        }

        const currentGroup = groups[groups.length - 1];
        currentGroup.ids.push(word.word_id);
        currentGroup.rects.push(...word.coordinates);

        if (i === words.length - 1) {
            currentGroup.rects = groupCoordinates(currentGroup.rects);
        }
    }

    return groups.map((highlight: any) => highlight as Highlight);
}

const filterHighlights = (highlights: Highlight[]): Highlight[] => {
    const sentencesIds = new Set(highlights
        .filter((highlight: Highlight): boolean => highlight.ids.length === 1)
        .flatMap((highlight: Highlight): string[] => highlight.ids)
        .filter((id: string): boolean => id.includes(".s") && !id.includes(".w") && !id.includes(".("))
    );
    const phrasesIds = new Set(highlights
        .filter((highlight: Highlight): boolean => highlight.ids.length > 1)
        .flatMap((highlight: Highlight): string[] => highlight.ids)
    );

    const filteredHighlights: Highlight[] = highlights.filter((highlight: Highlight): boolean => {
        // Just a safety check
        if (highlight.ids.length === 0)
            return false;
        // Always include sentences
        if (highlight.ids.length === 1 && sentencesIds.has(highlight.ids[0])) {
            return true;
        }

        // For phrases, check if they are already included in the sentences
        if (highlight.ids.length > 1 && highlight.ids.every((id: string): boolean => phrasesIds.has(id))) {
            return !highlight.ids.some((id: string): boolean => sentencesIds.has(id.split(".").slice(0, 2).join(".")));
        }

        // For single words, check if they are already included in the sentences or phrases
        return !highlight.ids.some((id: string): boolean => sentencesIds.has(id.split(".").slice(0, 2).join("."))) &&
            !highlight.ids.some((id: string): boolean => phrasesIds.has(id));
    });

    return filteredHighlights;
}




export default {
    parseSpeaker,
    parsePlace,
    parseSort,
    parseSearchAfterParams,
    parseMeetingsRequestQuery,
    tokenizeQuery,
    buildShouldMatchLemmaAndTextQuery,
    buildShouldMatchLemmaAndTextPlaceQuery,
    getNoTitleMessage,
    getNoAgendaMessage,
    joinWords,
    getAgendaTitle,
    groupCoordinates,
    tokenizeQueryDocumentSearch,
    getEmTagIndexes,
    groupWordsByPosition,
    filterHighlights
}
