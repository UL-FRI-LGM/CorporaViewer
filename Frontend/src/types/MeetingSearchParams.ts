import {reactive} from "vue";

export interface MeetingSearchParamsInterface {
    meetingId?: string;
    query?: string;
    speaker?: string;
    lang?: string;
    looseSearch?: boolean;
}

export class MeetingSearchParams implements MeetingSearchParamsInterface {

    static create(): MeetingSearchParams {
        return reactive(new MeetingSearchParams()) as MeetingSearchParams;
    }

    meetingId?: string = "";
    query?: string = "";
    speaker?: string;
    lang?: string;
    looseSearch?: boolean = false;

    reset(): void {
        this.meetingId = undefined;
        this.query = undefined;
        this.speaker = undefined;
        this.lang = undefined;
        this.looseSearch = false;
    }
}