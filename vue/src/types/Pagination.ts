import { reactive } from "vue";

export interface Pagination {
    // variables
    transcriptScrollPercent: number;
    pdfScrollPercent: number;
    nonScrollPageChange: boolean;

    // functions
    nextPage: () => void;
    previousPage: () => void;
    limit: (page: number) => number;
    hasNextPage: () => boolean;
    hasPreviousPage: () => boolean;
    reset: () => void;

    // callbacks
    getPageInput: () => number;
    setPageInput: (pageInput: number) => void;
    getPage: () => number;
    setPage: (page: number) => void;
    total: () => number;
    scrollPdfToPercent: (percent: number) => void;
}

export class Pagination implements Pagination {

    static create(): Pagination {
        return reactive(new Pagination()) as Pagination;
    }

    getPageInput: () => number = () => 1;
    getPage: () => number = () => 1;
    total: () => number = () => 1;
    setPageInput: (pageInput: number) => void = (pageInput: number) => { };
    setPage: (page: number) => void = (page: number) => { };

    transcriptScrollPercent: number = 0;
    pdfScrollPercent: number = 0;

    private updatePageInput = (pageInput: number) => {
        if (this.setPageInput) this.setPageInput(this.limit(pageInput));
    }

    private updatePage = (page: number) => {
        if (this.setPage) this.setPage(this.limit(page));
    }

    nextPage = () => {
        const nextPageNum = Math.min(this.getPage() + 1, this.total());
        this.updatePageInput(nextPageNum);
        this.updatePage(nextPageNum);
    }

    previousPage = () => {
        const previousPageNum = Math.max(this.getPage() - 1, 1);
        this.updatePageInput(previousPageNum);
        this.updatePage(previousPageNum);
    }

    limit = (page: number) => {
        return Math.min(Math.max(page, 1), this.total());
    }

    hasNextPage = () => {
        return this.getPage() < this.total();
    }

    hasPreviousPage = () => {
        return this.getPage() > 1;
    }

    reset: () => void = () => {
        this.transcriptScrollPercent = 0;
        this.pdfScrollPercent = 0;
        this.nonScrollPageChange = false;
        if (this.setPageInput) this.setPageInput(1);
        if (this.setPage) this.setPage(1);
    }

    syncPdfToTranscriptScroll = () => {
        this.scrollPdfToPercent(this.transcriptScrollPercent);
    }

    scrollPdfToPercent: (percent: number) => void = (percent: number) => {
        console.log("scrollPdfToPercent not implemented");
    };
}