import { createStore } from 'vuex'
import searchParamsModule from './search-params-module';
import searchFiltersModule from './search-filter-module';
import resultsModule from './results-module';
import transcriptHighlightsModule from './transcript-highlights-module';
import pdfHighlightsModule from './pdf-highlights-module';
import documentPaginationModule from './document-pagination-module';

export interface RootState {
}

export default createStore({
  modules: {
    searchParamsModule: searchParamsModule,
    searchFiltersModule: searchFiltersModule,
    resultsModule: resultsModule,
    transcriptHighlightsModule: transcriptHighlightsModule,
    pdfHighlightsModule: pdfHighlightsModule,
    documentPaginationModule: documentPaginationModule,
  },
  state: {} as RootState,
  getters: {},
  mutations: {
    findMatches(state: RootState) {
      this.commit("transcriptHighlightsModule/findMatches");
      this.commit("pdfHighlightsModule/findMatches");
    },
    previousHighlight(state: RootState, pdf: boolean) {
      if (!pdf) this.commit("transcriptHighlightsModule/previousHighlight");
      else this.commit("pdfHighlightsModule/previousHighlight");
    },
    nextHighlight(state: RootState, pdf: boolean) {
      if (!pdf) this.commit("transcriptHighlightsModule/nextHighlight");
      else this.commit("pdfHighlightsModule/nextHighlight");
    },
    updateSearch(state: RootState, search: () => string) {
      this.commit("transcriptHighlightsModule/updateSearch", search);
      this.commit("pdfHighlightsModule/updateSearch", search);
    },
  },
  actions: {}
})
