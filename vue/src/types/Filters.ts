import { reactive } from "vue";

export interface FiltersInterface {
    initializing: boolean;
    dateFrom: Date;
    dateTo: Date;
    languages: string[];
    corpuses: string[];
    sort: string;
}

export class Filters implements FiltersInterface {
    initializing: boolean = true;
    dateFrom: Date = new Date();
    dateTo: Date = new Date();
    languages: string[] = [];
    corpuses: string[] = [];
    sort: string = "relevance";
    
    static create(): Filters {
        return reactive(new Filters()) as Filters;
    }
}