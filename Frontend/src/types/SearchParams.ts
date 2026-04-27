import {reactive} from "vue";
import {Place} from "./Place";
import {Attendee} from "./Attendee";
import {PersonEntity} from "./PersonEntity";
import {CapTopic} from "@/types/CapTopic";

export interface SearchParamsInterface {
    searchOccurred: boolean;
    words: string;
    speaker?: Attendee;

    personEntity?: PersonEntity;
    locationEntity?: Place;
    capTopics: CapTopic[];

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

    personEntity?: PersonEntity;
    locationEntity?: Place;
    capTopics: CapTopic[] = [];

    pitId?: string;
    searchAfterScore?: number;
    searchAfterDate?: Date;
    searchAfterIndex?: number;

    isMatchAll(): boolean {
        return this.words.length == 0
            && !this.speaker
            && !this.personEntity
            && !this.locationEntity
            && this.capTopics.length === 0;
    }

    reset(): void {
        this.searchOccurred = false;
        this.words = "";
        this.speaker = undefined;

        this.personEntity = undefined;
        this.locationEntity = undefined;
        this.capTopics = [];

        this.pitId = undefined;
        this.searchAfterScore = undefined;
        this.searchAfterDate = undefined;
        this.searchAfterIndex = undefined;
    }
}
