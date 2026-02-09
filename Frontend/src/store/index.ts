import {createStore} from 'vuex'
import searchParamsModule from './search-params-module';
import searchFiltersModule from './search-filter-module';
import resultsModule from './results-module';
import transcriptHighlightsModule from './transcript-highlights-module';
import pdfHighlightsModule from './pdf-highlights-module';
import documentPaginationModule from './document-pagination-module';
import {Highlight} from "@/types/Highlight";
import meetingSearchParamsModule from "@/store/meeting-search-params-module";
import {Rect} from "@/types/Rect";

export interface RootState {
}

export default createStore({
    modules: {
        searchParamsModule: searchParamsModule,
        meetingSearchParamsModule: meetingSearchParamsModule,
        searchFiltersModule: searchFiltersModule,
        resultsModule: resultsModule,
        transcriptHighlightsModule: transcriptHighlightsModule,
        pdfHighlightsModule: pdfHighlightsModule,
        documentPaginationModule: documentPaginationModule,
    },
    state: {} as RootState,
    getters: {},
    mutations: {
        displayPdfHighlights(state, highlightsRects: Rect[][]) {
            this.commit("pdfHighlightsModule/displayHighlights", highlightsRects);
        },
        displayTranscriptHighlights(state: RootState, highlightsIds: string[][]) {
            this.commit("transcriptHighlightsModule/displayHighlights", highlightsIds);
        },
        clearMatches(state: RootState) {
            this.commit("transcriptHighlightsModule/clearMatches");
            this.commit("pdfHighlightsModule/clearMatches");
        },
        previousHighlight(state: RootState, pdf: boolean) {
            if (!pdf) this.commit("transcriptHighlightsModule/previousHighlight");
            else this.commit("pdfHighlightsModule/previousHighlight");
        },
        nextHighlight(state: RootState, pdf: boolean) {
            if (!pdf) this.commit("transcriptHighlightsModule/nextHighlight");
            else this.commit("pdfHighlightsModule/nextHighlight");
        },
        reset(state: RootState) {
            this.commit("pdfHighlightsModule/clearMatches");
            this.commit("transcriptHighlightsModule/clearMatches");
        }
    },
    actions: {

        // TODO: add comments
        async fetchHighlights(context, isPdfAllowed: boolean) {
            // Generate the URL based on the search parameters (given by the user)
            let meetingSearchParamsInstance = context.getters['meetingSearchParamsModule/meetingSearchParamsInstance'];

            let URL = process.env.VUE_APP_API_URL + `/meetings/${meetingSearchParamsInstance.meetingId}/getHighlights?words=${meetingSearchParamsInstance.query}`;
            if (meetingSearchParamsInstance.lang)
                URL += `&lang=${meetingSearchParamsInstance.lang}`;
            if (meetingSearchParamsInstance.speaker)
                URL += `&speaker=${meetingSearchParamsInstance.speaker}`;
            if (meetingSearchParamsInstance.looseSearch)
                URL += `&looseSearch=true`;

            // Fetch the highlights from the API (chunk by chunk)
            try {
                const highlights: Highlight[] = [];
                for await (const parsedChunk of streamingFetch(() => fetch(URL))) {
                    highlights.push(...parsedChunk.highlights);
                    console.log("Received chunk of highlights");
                }

                // Sort the highlights by their id
                highlights.sort((a, b) => {
                    return a.ids[0].localeCompare(b.ids[0], undefined, {numeric: true})
                });

                // Rects are used to highlight PDF, ids are used to highlight transcript
                const rects = highlights.map(h => h.rects);
                const ids = highlights.map(h => h.ids);

                if (isPdfAllowed) {
                    this.commit("displayPdfHighlights", rects);
                    this.commit("displayTranscriptHighlights", ids);
                } else {
                    this.commit("displayTranscriptHighlights", ids);
                }
            } catch (e) {
                console.error("Error fetching highlights:", e);
            }
        },
    }
})


//
// Helper functions
//

/**
 * Generator function to stream responses from fetch calls.
 *
 * @param {Function} fetchcall - The fetch call to make. Should return a response with a readable body stream.
 * @returns {AsyncGenerator<string>} An async generator that yields strings from the response stream.
 */
async function* streamingFetch(fetchcall: Function): AsyncIterableIterator<any> {

    const response = await fetchcall();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';

    while (true) {
        // wait for next encoded chunk
        const {done, value} = await reader.read();
        // check if stream is done
        if (done) break;

        // Decode the chunk and add it to the buffer
        buffer += decoder.decode(value, {stream: true});

        // Process the complete JSON object from the buffer
        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 1);
            if (chunk.trim()) {
                let parsedChunk = undefined;
                try {
                    parsedChunk = JSON.parse(chunk);
                    // Yield the parsed chunk
                    yield parsedChunk;
                } catch (e) {
                    console.error("Error parsing chunk:", e);
                    continue;
                }
            }
            boundary = buffer.indexOf('\n');
        }
    }
}