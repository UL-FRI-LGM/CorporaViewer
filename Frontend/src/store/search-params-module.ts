import {Module, MutationTree} from "vuex";
import {RootState} from "@/store/index";
import {SearchParams} from "@/types/SearchParams";
import {Attendee} from "@/types/Attendee";
import {Place} from "@/types/Place";
import {PersonEntity} from "@/types/PersonEntity";
import {LocationEntity} from "@/types/LocationEntity";
import {CapTopic} from "@/types/CapTopic";

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
    updatePersonEntity(state: SearchParamsState, entity: PersonEntity | undefined) {
        state.instance.personEntity = entity
    },
    updateLocationEntity(state: SearchParamsState, entity: LocationEntity | undefined) {
        state.instance.locationEntity = entity
    },
    addCapTopic(state: SearchParamsState, topic: CapTopic) {
        if (!state.instance.capTopics.find(t => t.id === topic.id))
            state.instance.capTopics.push(topic)
    },
    removeCapTopic(state: SearchParamsState, topic: CapTopic) {
        state.instance.capTopics = state.instance.capTopics.filter(t => t.id !== topic.id)
    },
    resetCapTopics(state: SearchParamsState) {
        state.instance.capTopics = []
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