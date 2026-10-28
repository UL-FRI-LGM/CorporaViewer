import {reactive} from "vue";
import {Place} from "./Place";
import {Attendee} from "./Attendee";
import {PersonEntity} from "./PersonEntity";
import {CapTopic} from "@/types/CapTopic";
import {AdvancedSearch} from "@/types/AdvancedQuery";
import {emptyAdvanced, isAdvancedActive} from "@/data/advancedQuery";

export interface SearchParamsInterface {
    searchOccurred: boolean;
    words: string;
    speaker?: Attendee;

    personEntity?: PersonEntity;
    locationEntity?: Place;
    capTopics: CapTopic[];
    // advanced search
    advanced: AdvancedSearch;

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
    advanced: AdvancedSearch = emptyAdvanced();

    pitId?: string;
    searchAfterScore?: number;
    searchAfterDate?: Date;
    searchAfterIndex?: number;

    isMatchAll(): boolean {
        // when advanced search is open only its conditions are used
        if (this.advanced.enabled) return !isAdvancedActive(this.advanced);
        return this.words.length == 0
            && !this.speaker
            && !this.personEntity
            && !this.locationEntity
            && this.capTopics.length === 0
            && !isAdvancedActive(this.advanced);
    }

    reset(): void {
        this.searchOccurred = false;
        this.words = "";
        this.speaker = undefined;

        this.personEntity = undefined;
        this.locationEntity = undefined;
        this.capTopics = [];
        this.advanced = emptyAdvanced();

        this.pitId = undefined;
        this.searchAfterScore = undefined;
        this.searchAfterDate = undefined;
        this.searchAfterIndex = undefined;
    }
}
