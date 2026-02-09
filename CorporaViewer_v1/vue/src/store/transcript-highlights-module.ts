import { Module, MutationTree } from "vuex";
import { RootState } from "@/store/index";
import { TranscriptHighlights } from "@/types/Highlights";

interface TranscriptHighlightsState {
    instance: TranscriptHighlights;
}

const mutations: MutationTree<TranscriptHighlightsState> = {
    findMatches(state: TranscriptHighlightsState) {
        state.instance.findMatches();
    },
    previousHighlight(state: TranscriptHighlightsState) {
        state.instance.previousHighlight();
    },
    nextHighlight(state: TranscriptHighlightsState) {
        state.instance.nextHighlight();
    },
    updateSearch(state: TranscriptHighlightsState, search: () => string) {
        state.instance.search = search;
    },
    updateOriginalTranscript(state: TranscriptHighlightsState, params: {text: string, callback: () => void}) {
        state.instance.originalTranscript = params.text;
        params.callback();
        state.instance.findMatches();
    },
    updateContainer(state: TranscriptHighlightsState, container: HTMLDivElement) {
        state.instance.container = container;
    },
    setUpdateTranscriptIndex(state: TranscriptHighlightsState, updateTranscriptIndex: (index: number) => void) {
        state.instance.updateTranscriptIndex = updateTranscriptIndex;
    },
    setUpdateTranscriptTotal(state: TranscriptHighlightsState, updateTranscriptTotal: (total: number) => void) {
        state.instance.updateTranscriptTotal = updateTranscriptTotal;
    }
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