import { Module, MutationTree } from "vuex";
import { RootState } from "@/store/index";
import { Results } from "@/types/Results";
import { Meeting } from "@/types/Meeting";

interface ResultsState {
  instance: Results;
}

const mutations: MutationTree<ResultsState> = {
  resetResults(state: ResultsState) {
    state.instance.reset()
  },
  initResults(state: ResultsState, params: { total: number, pageSize: number }) {
    state.instance.init(params.total, params.pageSize)
  },
  setResults(state: ResultsState, params: { results: Meeting[], page: number }) {
    state.instance.setResults(params.results, params.page)
  },

}

const resultsModule: Module<ResultsState, RootState> = {
  namespaced: true,
  state: {
    instance: Results.create()
  },
  getters: {
    resultsInstance: (state) => state.instance
  },
  mutations
};

export default resultsModule;