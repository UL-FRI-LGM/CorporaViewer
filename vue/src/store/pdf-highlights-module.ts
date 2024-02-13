import { Module, MutationTree } from "vuex";
import { RootState } from "@/store/index";
import { PdfHighlights, PdfPageMatch } from "@/types/Highlights";
import * as PdfJsViewer from 'pdfjs-dist/web/pdf_viewer';

interface PdfHighlightsState {
    instance: PdfHighlights;
}

const mutations: MutationTree<PdfHighlightsState> = {
    findMatches(state: PdfHighlightsState) {
        state.instance.findMatches();
    },
    previousHighlight(state: PdfHighlightsState) {
        state.instance.previousHighlight();
    },
    nextHighlight(state: PdfHighlightsState) {
        state.instance.nextHighlight();
    },
    updateSearch(state: PdfHighlightsState, search: () => string) {
        state.instance.search = search;
    },
    updateMatchesCount(state: PdfHighlightsState, event: any) {
        state.instance.onMatchesFound(event);
    },
    noMatches(state: PdfHighlightsState) {
        state.instance.onNoMatchesFound();
    },
    updateEventBus(state: PdfHighlightsState, eventBus: PdfJsViewer.EventBus) {
        state.instance.eventBus = eventBus;
    },
    updateSource(state: PdfHighlightsState, source: any) {
        state.instance.source = source;
    },
    updateNextHighlight(state: PdfHighlightsState, nextHighlight: () => void) {
        state.instance._nextHighlight = nextHighlight;
    },
    updatePreviousHighlight(state: PdfHighlightsState, previousHighlight: () => void) {
        state.instance._previousHighlight = previousHighlight;
    },
    updateScrollToHighlight(state: PdfHighlightsState, scrollToHighlight: () => void) {
        state.instance.scrollToHighlight = scrollToHighlight;
    },
    updatePrepHighlightBeforeScrolling(state: PdfHighlightsState, prepHighlightBeforeScrolling: (performedAction: 'find' | 'resize' | 'next' | 'prev') => void) {
        state.instance.prepHighlightBeforeScrolling = prepHighlightBeforeScrolling;
    },
}

const pdfHighlightsModule: Module<PdfHighlightsState, RootState> = {
    namespaced: true,
    state: {
        instance: PdfHighlights.create()
    },
    getters: {
        pdfHighlightsInstance: (state) => state.instance
    },
    mutations
};

export default pdfHighlightsModule;