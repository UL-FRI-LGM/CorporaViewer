import {Translation} from "./Translation";

export interface Sentence {
    id: string;
    translations: Translation[];
    segment_page: string;
    segment_id: string;
    speaker: string;
    original_language: string;
}
