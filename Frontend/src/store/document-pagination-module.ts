import {Module, MutationTree} from "vuex";
import {RootState} from "@/store/index";
import {Pagination} from "@/types/Pagination";

interface DocumentPaginationState {
    instance: Pagination;
}

const mutations: MutationTree<DocumentPaginationState> = {
    updatePageFunctions(state: DocumentPaginationState, pageFunctions: {
        getPage: () => number,
        setPage: (page: number) => void,
        total: () => number,
    }) {
        state.instance.getPage = pageFunctions.getPage;
        state.instance.setPage = pageFunctions.setPage;
        state.instance.total = pageFunctions.total;
    },
    updatePageInputFunctions(state: DocumentPaginationState, pageInputFunctions: {
        getPageInput: () => number,
        setPageInput: (pageInput: number) => void,
    }) {
        state.instance.getPageInput = pageInputFunctions.getPageInput;
        state.instance.setPageInput = pageInputFunctions.setPageInput;
    },
    setPage(state: DocumentPaginationState, page: number) {
        if (state.instance.setPage) state.instance.setPage(page);
    },
    syncPageInput(state: DocumentPaginationState) {
        if (state.instance.setPageInput) {
            state.instance.setPageInput(state.instance.getPage());
        }
    },
    resetPagination(state: DocumentPaginationState) {
        state.instance.reset();
    },
    updateScrollPdfToPercent(state: DocumentPaginationState, scrollPdfToPercent: (percent: number) => void) {
        state.instance.scrollPdfToPercent = scrollPdfToPercent;
    }
}

const documentPaginationModule: Module<DocumentPaginationState, RootState> = {
    namespaced: true,
    state: {
        instance: Pagination.create()
    },
    getters: {
        documentPaginationInstance: (state) => state.instance
    },
    mutations
};

export default documentPaginationModule;