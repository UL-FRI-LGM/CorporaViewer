export interface WordsIndexDocument {
    meeting_id: string;
    sentence_id: string;
    segment_id: string;
    word_id: string;
    text: string;
    lemma: string;
    speaker: string;
    pos: number;
    wpos: number;
    coordinates: Coordinate[];
    lang: string;
    original: number;
    propn: number;
}


interface Coordinate {
    page: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
