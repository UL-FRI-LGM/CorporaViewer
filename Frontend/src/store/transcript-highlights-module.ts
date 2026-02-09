import {Module, MutationTree} from "vuex";
import store, {RootState} from "@/store/index";
import {TranscriptHighlights} from "@/types/Highlights";

interface TranscriptHighlightsState {
    instance: TranscriptHighlights;
}

const mutations: MutationTree<TranscriptHighlightsState> = {
    /*
    async findMatches(state: TranscriptHighlightsState) {
        await state.instance.findMatches();
    },
     */
    displayHighlights(state: TranscriptHighlightsState, highlightsIds: string[][]) {
        state.instance.displayHighlights(highlightsIds);
    },
    clearMatches(state: TranscriptHighlightsState) {
        state.instance.clearMatches();
    },
    previousHighlight(state: TranscriptHighlightsState) {
        state.instance.previousHighlight();
    },
    nextHighlight(state: TranscriptHighlightsState) {
        state.instance.nextHighlight();
    },
    updateLooseSearch(state: TranscriptHighlightsState, looseSearch: boolean) {
        state.instance.looseSearch = looseSearch;
    },
    updateOriginalTranscript(state: TranscriptHighlightsState, params: { text: string, callback: () => void }) {
        state.instance.originalTranscript = params.text;
        params.callback();
    },
    updateContainer(state: TranscriptHighlightsState, container: HTMLDivElement) {
        state.instance.container = container;
    },
    setUpdateTranscriptIndex(state: TranscriptHighlightsState, updateTranscriptIndex: (index: number) => void) {
        state.instance.updateTranscriptIndex = updateTranscriptIndex;
    },
    setUpdateTranscriptTotal(state: TranscriptHighlightsState, updateTranscriptTotal: (total: number) => void) {
        state.instance.updateTranscriptTotal = updateTranscriptTotal;
    },
}

const transcriptHighlightsModule: Module<TranscriptHighlightsState, RootState> = {
    namespaced: true,
    state: {
        instance: TranscriptHighlights.create()
    },
    getters: {
        transcriptHighlightsInstance: (state) => state.instance
    },
    mutations
};

export default transcriptHighlightsModule;