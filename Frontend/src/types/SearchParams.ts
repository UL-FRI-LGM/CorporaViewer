import {reactive} from "vue";
import {Place} from "./Place";
import {Attendee} from "./Attendee";
import {PersonEntity} from "./PersonEntity";
import {LocationEntity} from "./LocationEntity";
import {CapTopic} from "@/types/CapTopic";

export interface SearchParamsInterface {
    searchOccurred: boolean;
    words: string;
    speaker?: Attendee;
    place?: Place;

    personEntity?: PersonEntity;
    locationEntity?: LocationEntity;
    capTopic?: CapTopic;

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

    personEntity?: PersonEntity;
    locationEntity?: LocationEntity;
    capTopic?: CapTopic;

    pitId?: string;
    searchAfterScore?: number;
    searchAfterDate?: Date;
    searchAfterIndex?: number;

    isMatchAll(): boolean {
        return this.words.length == 0
            && !this.speaker
            && !this.place
            && !this.personEntity
            && !this.locationEntity
            && !this.capTopic;
    }

    reset(): void {
        this.searchOccurred = false;
        this.words = "";
        this.speaker = undefined;
        this.place = undefined;

        this.personEntity = undefined;
        this.locationEntity = undefined;
        this.capTopic = undefined;

        this.pitId = undefined;
        this.searchAfterScore = undefined;
        this.searchAfterDate = undefined;
        this.searchAfterIndex = undefined;
    }
}
