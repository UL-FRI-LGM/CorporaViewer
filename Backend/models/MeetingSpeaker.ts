import {AttendeesIndexDocument} from "./AttendeesIndexDocument";

export interface MeetingSpeaker {
    id: string;
    names: AttendeesIndexDocument["names"];
    count: number;
}
