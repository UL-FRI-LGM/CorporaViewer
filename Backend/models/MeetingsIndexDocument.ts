export interface MeetingsIndexDocument {
    id: string;
    date: string;
    titles: Title[];
    agendas: Agenda[];
    sentences: Sentence[];
    notes: Note[];
    corpus: string;
}

interface Title {
    title: string;
    lang: string;
}


interface Agenda {
    lang: string;
    items: AgendaItem[];
}

export interface AgendaItem {
    n: number;
    text: string;
}


interface Sentence {
    id: string;
    translations: Translation[];
    segment_page: string;
    segment_id: string;
    speaker: string;
    original_language: string;
}

export interface Translation {
    lang: string;
    original: number;
    text: string;
    words: Word[];
    speaker: string;
}

export interface Word {
    id: string;
    type: string;
    lemma: string;
    text: string;
    join: string;
    propn: number;
}


interface Note {
    type: string;
    text: string;
    page: number;
    segment_id: string;
    speaker: string;
}
