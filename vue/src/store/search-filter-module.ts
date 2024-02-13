import { Module, MutationTree } from "vuex";
import { RootState } from "@/store/index";
import { Filters } from "@/types/Filters";

interface SearchFiltersState {
    instance: Filters;
}

const mutations: MutationTree<SearchFiltersState> = {
    updateSearchFilters(state: SearchFiltersState, searchFilters: Filters) {
        state.instance = searchFilters
    },
    updateDateFrom(state: SearchFiltersState, dateFrom: Date) {
        state.instance.dateFrom = dateFrom
    },
    updateDateTo(state: SearchFiltersState, dateTo: Date) {
        state.instance.dateTo = dateTo
    },
    updateLanguages(state: SearchFiltersState, languages: string[]) {
        console.log("updateLanguages", languages)
        state.instance.languages = languages
    },
    updateCorpuses(state: SearchFiltersState, corpuses: string[]) {
        state.instance.corpuses = corpuses
    },
    updateSort(state: SearchFiltersState, sort: string) {
        state.instance.sort = sort
    },
}

const searchFiltersModule: Module<SearchFiltersState, RootState> = {
    namespaced: true,
    state: {
        instance: Filters.create()
    },
    getters: {
        searchFiltersInstance: (state) => state.instance
    },
    mutations
};

export default searchFiltersModule;