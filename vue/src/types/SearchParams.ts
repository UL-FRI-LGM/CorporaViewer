import { reactive } from "vue";
import { Place } from "../types/Place";
import { Attendee } from "./Attendee";

export interface SearchParamsInterface {
    searchOccurred: boolean;
    words: string;
    speaker?: Attendee;
    place?: Place;

    pitId?: string;
    searchAfterScore?: number;
    searchAfterDate?: Date;
    searchAfterIndex?: number;
}

export class SearchParams implements SearchParamsInterface {

    static create(): SearchParams {
        return reactive(new SearchParams()) as SearchParams;
    }

    searchOccurred: boolean = false;
    words: string = "";
    speaker?: Attendee;
    place?: Place;

    pitId?: string;
    searchAfterScore?: number;
    searchAfterDate?: Date;
    searchAfterIndex?: number;

    isMatchAll(): boolean {
        return this.words.length == 0 && !this.speaker && !this.place;
    }

    reset(): void {
        this.searchOccurred = false;
        this.words = "";
        this.speaker = undefined;
        this.place = undefined;

        this.pitId = undefined;
        this.searchAfterScore = undefined;
        this.searchAfterDate = undefined;
        this.searchAfterIndex = undefined;
    }
}