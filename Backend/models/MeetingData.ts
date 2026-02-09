import {Title} from "./Title";
import {Agenda} from "./Agenda";
import {SentenceData} from "./SentenceData";

export interface MeetingData {
    id: string;
    date: string;
    titles: Title[];
    agendas: Agenda[];
    corpus: string;
    sentences: SentenceData[];
    totalSentences: number;
}
