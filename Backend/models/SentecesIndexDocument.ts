interface Coordinate {
    page: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

interface Translation {
    text: string;
    lang: string;
    original: number;
}

export interface SentencesIndexDocument {
    meeting_id: string;
    sentence_id: string;
    segment_id: string;
    speaker: string;
    coordinates: Coordinate[];
    translations: Translation[];
}
