import {Word} from "./Word";

export interface SentenceData {
    lang: string;
    original: number;
    text: string;
    speaker: string;
    words: Word[];
    highlights?: {
        "sentences.translations.text"?: string[];
        "sentences.translations.words.lemma"?: string[];
    };
}
