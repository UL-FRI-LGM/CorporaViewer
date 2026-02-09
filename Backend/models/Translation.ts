import {Word} from "./Word";

export interface Translation {
    lang: string;
    original: number;
    text: string;
    words: Word[];
    speaker: string;
}
