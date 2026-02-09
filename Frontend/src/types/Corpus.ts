export interface Corpus {
    name: string;
    languages: string[];
    dateFrom: Date;
    dateTo: Date;
}

export default interface CorpusList extends Array<Corpus> {}