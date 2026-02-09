import { Module, MutationTree } from "vuex";
import { RootState } from "@/store/index";
import { MeetingSearchParams } from "@/types/MeetingSearchParams";
import { Attendee } from "@/types/Attendee";

interface MeetingSearchParamsState {
    instance: MeetingSearchParams;
}

const mutations: MutationTree<MeetingSearchParamsState> = {
    // Meeting search params
    resetMeetingSearchParams(state: MeetingSearchParamsState) {
        state.instance.reset()
    },
    updateMeetingId(state: MeetingSearchParamsState, meetingId: string) {
        state.instance.meetingId = meetingId
    },
    updateSearchQuery(state: MeetingSearchParamsState, query: string) {
        state.instance.query = query
    },
    updateSpeaker(state: MeetingSearchParamsState, speaker: string) {
        state.instance.speaker = speaker
    },
    updateLanguage(state: MeetingSearchParamsState, lang: string) {
        state.instance.lang = lang
    },
    updateLooseSearch(state: MeetingSearchParamsState, looseSearch: boolean) {
        state.instance.looseSearch = looseSearch
    }
}

const meetingSearchParamsModule: Module<MeetingSearchParamsState, RootState> = {
    namespaced: true,
    state: {
        instance: MeetingSearchParams.create()
    },
    getters: {
        meetingSearchParamsInstance: (state) => state.instance
    },
    mutations
};

export default meetingSearchParamsModule;