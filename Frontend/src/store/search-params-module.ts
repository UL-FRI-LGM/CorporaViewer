import { Module, MutationTree } from "vuex";
import { RootState } from "@/store/index";
import { SearchParams } from "@/types/SearchParams";
import { Attendee } from "@/types/Attendee";
import { Place } from "@/types/Place";

interface SearchParamsState {
    instance: SearchParams;
}

const mutations: MutationTree<SearchParamsState> = {
    // Search params
    resetSearchParams(state: SearchParamsState) {
        state.instance.reset()
    },
    updateSearchWords(state: SearchParamsState, words: string) {
        state.instance.words = words
    },
    updateSearchSpeaker(state: SearchParamsState, speaker: Attendee | undefined) {
        state.instance.speaker = speaker
    },
    updateSearchPlace(state: SearchParamsState, place: Place | undefined) {
        state.instance.place = place
    },
}

const searchParamsModule: Module<SearchParamsState, RootState> = {
    namespaced: true,
    state: {
        instance: SearchParams.create()
    },
    getters: {
        searchParamsInstance: (state) => state.instance
    },
    mutations
};

export default searchParamsModule;