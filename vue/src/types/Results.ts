import { reactive } from "vue";
import { Meeting } from "./Meeting";

export class Results {
    total: number = 0;
    results: (Meeting[] | undefined)[] = [];

    // values for storing results in searchView while it is unmounted
    page: number = 0;
    pageSize: number = 10;

    public static create(): Results {
        return reactive(new Results()) as Results;
    }

    constructor() {
        this.total = 0;
        this.results = []
    }

    private initList(total: number, pageSize: number): undefined[] {
        if (total === 0) {
            return [];
        }
        
        let list = [];
        for (let i = 0; i < Math.ceil(total / pageSize); i++) {
            list.push(undefined);
        }
        return list;
    }

    public setResults(results: Meeting[], page: number): void {
        this.results[page] = results;
    }

    public getResultsPage(page: number): Meeting[] | undefined {
        return this.results[page];
    }

    public getMeetingOn(page: number, index: number): Meeting | undefined {
        return this.results[page] ? this.results[page]![index] : undefined
    }

    public reset(): void {
        this.total = 0;
        this.results = [];

        this.page = 0;
        this.pageSize = 10;
    }

    public init(total: number, pageSize: number): void {
        this.total = total;
        this.results = this.initList(total, pageSize);
    }

    public isPageLoaded(page: number): boolean {
        return this.results[page] !== undefined;
    }

    public allPagesLoaded(): boolean {
        return this.results.every((page) => page !== undefined);
    }
}