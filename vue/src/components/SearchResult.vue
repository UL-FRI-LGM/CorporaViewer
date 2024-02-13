<template>
    <div class="search-result" ref="result">
        <div class="row">
            <div class="col-md-2 image-container" v-if="meeting.id">
                <img :src="imageLink" alt="No thumbnail">
            </div>
            <div class="col-md-10">
                <div class="row">
                    <div class="col-md-12">
                        <h3>{{ getTitle() }}</h3>
                    </div>
                </div>
                <div class="row text-container">
                    <div v-if="!wasMatchAll" class="col-md-12 snippet-container">
                        <span v-for="i in getMaxNumOfSnippets()" v-html="$filters.highlightText(getSnippet(i-1), highlights[i-1])"></span>
                    </div>
                    <div v-else class="col-md-12 agendas-container">
                        <span v-html="getAgendas()"></span>
                    </div>
                </div>
                <div class="row" style="position: relative;">
                    <div class="buttons-container">
                        <button v-if="wasMatchAll" class="btn btn-primary" @click="toggleDetails" :disabled="isMoreAgendasButtonDisabled()">
                            <i v-if="!showingDetails" class="fas fa-angle-down"></i>
                            <i v-else class="fas fa-angle-up"></i>
                            {{ ( !showingDetails ? $t('expandAgendaButton') : $t('hideAgendaButton') ) }}
                        </button>
                        <button class="btn btn-primary" @click="openPdf">
                            <i class="fas fa-file-pdf"></i>
                            {{ $t('viewDocumentButton' )}}
                        </button>
                    </div>
                    <div v-if="!wasMatchAll" class="col-md-12 details-container">
                        <p>
                            {{ $t('totalFound') + `: ${meeting.totalSentences}` }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
.details-container {
    padding-top: 1rem;
    width: 95%;
}

.details-container p {
    text-align: center;
    margin-top: 1rem;
    color: grey;
}

.search-result {
    border-bottom: #708d81 4px solid;
    padding: 1.5rem;
    color: black;
    margin: 1rem 1,5rem;
}

.text-container {
    padding-left: 1rem;
    padding-top: 1rem;
    color: #1E1E24
}

.agendas {
    text-align: left;
    padding: 10px;
    color: #1E1E24
}

.snippet-container {
    text-align: justify;
}

.agendas-container {
    text-align: left;
    padding-left: 1rem;
    color: #1E1E24;
    overflow: hidden;
    transition: all 0.3s ease-in-out;
}

.buttons-container {
    padding-top: 1rem;
    display: flex;
    flex-direction: row;
    justify-content: center;
}

.buttons-container button {
    width: fit-content;
    padding: 0.5rem 1rem;
    margin: 0 1rem;
    border-radius: 20px;
}

@media (max-width: 768px) {
    .image-container {
        display: none;
    }

    .first-button {
        margin-bottom: 1rem;
    }

    .search-result {
        padding: 0;
    }
}
</style>

<script lang="ts">
import { Watch } from 'vue-property-decorator';
import { Options, Vue } from 'vue-class-component';
import { mapGetters } from 'vuex';
import { Meeting } from '@/types/Meeting';


@Options({
    props: {
        index: {
            type: Number,
            required: true
        },
        page: {
            type: Number,
            required: true
        }
    },
    computed: {
        ...mapGetters('searchParamsModule', ['searchParamsInstance']),
        ...mapGetters('resultsModule', ['resultsInstance']),
    }
})

export default class SearchResult extends Vue {
    [x: string]: any;

    wasMatchAll: boolean = false;
    meeting: Meeting = new Meeting();
    imageLink: string = "";
    result: HTMLElement | null = null;
    highlights: string[][] = [];
    selectedSpeakerName: string = "";

    showingDetails: boolean = false;
    moveDetails: boolean = false;
    displayDetails: boolean = false;

    @Watch('meeting', { immediate: true, deep: true })
    onMeetingChanged() {
        this.updateHighlights();
        this.updateImageLink();
        this.scrollToFirstResult();
    }

    @Watch('page', { immediate: true })
    onPageChanged() {
        this.meeting = this.resultsInstance.getMeetingOn(this.page, this.index)!
    }

    mounted(): void {
        this.wasMatchAll = this.searchParamsInstance?.isMatchAll()
        this.meeting = this.resultsInstance.getMeetingOn(this.page, this.index)!
        
        this.selectedSpeakerName = this.searchParamsInstance?.speaker?.names[0] ?? "";
        this.result = this.$refs.result as HTMLElement;
        this.scrollToFirstResult();
    }

    scrollToFirstResult() {
        if (this.index === 0) {
            this.result?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    updateHighlights() {
        this.highlights = [];
        this.meeting.sentences?.forEach(sentence => {
            if (sentence.highlights) {
                this.highlights.push([
                    ...sentence.highlights['sentences.translations.text']?.flatMap(text => { // map all words inside <em> and </em> tags
                        const words: string[] = text.match(/<em>(.*?)<\/em>/g)?.flatMap(x => x.replace(/<\/?em>/g, "").split(" ")) || [];
                        return words;
                    }) ?? [],
                    ...sentence.highlights['sentences.translations.words.lemma']?.map(x => {
                        const lemma = x.replace(/<\/?em>/g, "")
                        const word = sentence.words.find(word => word.lemma === lemma)?.text;
                        return word ? word.toLowerCase() : "";
                    }) ?? []
                ])
            }
        });
    }

    updateImageLink() {
        if (this.meeting.id)
            this.imageLink = process.env.VUE_APP_API_URL + "/pdf/getThumbnailById/" + this.meeting.id;
    }

    toggleDetails() {
        this.showingDetails = !this.showingDetails;
        this.result?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    isMoreAgendasButtonDisabled() {
        const totalAgendas = this.meeting.agendas?.find(agenda => agenda.lang === this.$i18n.locale)?.items.length || 0;
        return totalAgendas <= 5;
    }

    openPdf() {
        this.$emit('openPdf', this.meeting.id);
    }

    getTitle() {
        return this.meeting.titles.find(title => title.lang === this.$i18n.locale)?.title 
            || this.$t('loading'); 
    }
    
    /**
     * Returns the maximum number of snippets to display.
     */
    getMaxNumOfSnippets() {
        if (this.wasMatchAll) {
            return 1;
        }
        const max = this.meeting.sentences.length;
        return Math.min(max, 10);
    }

    /**
     * Returns the snippet at the given index.
     * Snippet is a part of the sentence containing any of the target words and a couple of words before and after them.
     * @param index The index of the snippet to return.
     */
    getSnippet(index: number) {
        // if this is a match all search, return the agendas
        if (this.wasMatchAll) {
            return this.getAgendas();
        }

        // get list of target words
        const targetWordsLowercase = this.highlights[index] ?? [];
        // get list of words in the snippet
        // const untrimmedSnippetWordList = this.getMostRelevantTranslation(this.meeting.sentences[index]._source.translations, targetWordsLowercase).split(" ");
        const untrimmedSnippetWordList = this.meeting.sentences[index].text.split(" ");
        // Get the indices of the target words in the sentence ignoring all special characters
        const targetWordIndices = untrimmedSnippetWordList
            .map((word, i) => targetWordsLowercase.includes(word.toLowerCase().replace(/[^a-zA-ZäöüßÄÖÜčšžČŠŽ]/g,"")) ? i : -1)
            .filter(i2 => i2 !== -1);

        if (targetWordIndices.length === 0 && !this.selectedSpeakerName) {
            return this.$t('noTargetWordsFound');
        }
        else if (targetWordIndices.length === 0 && this.selectedSpeakerName) {
            var snippet = (index == 0 ? '<h6 style="text-align: left; padding-left: 1rem;"><span class="highlight-result">' + this.selectedSpeakerName + "</span>:</h6>" : "")
            snippet += untrimmedSnippetWordList.slice(0, 15).join(" ") + " ... ";
            return snippet;
        }
        else if (targetWordIndices.length === 1) {
            const targetWordIndex = targetWordIndices[0];
            const snippetStartIndex = Math.max(0, targetWordIndex - 7);
            const snippetEndIndex = Math.min(untrimmedSnippetWordList.length, targetWordIndex + 8);
            const snippet = untrimmedSnippetWordList.slice(snippetStartIndex, snippetEndIndex).join(" ");

            return (index == 0 ? " ... " : "") + snippet + " ... ";
        }
        else {
            return (index == 0 ? " ... " : "") + this.getSnippetForMultipleTargetWords(untrimmedSnippetWordList, targetWordIndices, 0);
        }
    }

    getMostRelevantTranslation(
        translations: {
            lang: string,
            original: number,
            text: string,
            words: [
                {
                    id: string,
                    lemma: string,
                    text: string,
                    propn: number,
                }
            ]
        }[],
        targetWordsLowercase: string[]
    ): string {
        // get the translation with the most target words
        const mostRelevantTranslation = translations.reduce((prev, curr) => {
            const currTargetWords = curr.words.map(word => word.text.toLowerCase());
            const currNumOfTargetWords = currTargetWords.filter(word => targetWordsLowercase?.includes(word) ?? false).length;
            const prevTargetWords = prev.words.map(word => word.text.toLowerCase());
            const prevNumOfTargetWords = prevTargetWords.filter(word => targetWordsLowercase?.includes(word) ?? false).length;
            return currNumOfTargetWords > prevNumOfTargetWords ? curr : prev;
        });
        return mostRelevantTranslation.text;
    }

    getAgendas() {
        if (!this.meeting.agendas) {
            return "";
        }
        else {
            //get current page language
            const lang = this.$i18n.locale;
         
            //get agendas in current page language
            const agenda = this.meeting.agendas.find(agenda => agenda.lang === lang);

            const iTo = this.showingDetails ? agenda?.items.length : 5;

            let element = this.$t('noAgenda');

            //if agendas in current page language exist, return them
            if (agenda) {
                element = "<h4>" + this.$t('agenda') + ":</h4><div class=\"agendas\">" + 
                    agenda.items.slice(0, iTo).map(item => { return item.text }).join("<br>") + "</div>";
            }
            
            return element;
        }
    }

    /**
     * Returns snippets for the case when there are multiple target words in the sentence depending on how far apart they are.
     * @param untrimmedSnippetWordList The list of words in the sentence.
     * @param targetWordIndices The indices of the target words in the sentence.
     */
    getSnippetForMultipleTargetWords(untrimmedSnippetWordList: string[], targetWordIndices: number[], targetIndex: number) {
        let snippet = ""
        let snippetStartIndex = Math.max(0, targetWordIndices[0] - 7);

        while (targetIndex < targetWordIndices.length - 1) {
            // if next target word less than 7 words away, add it to the snippet and repeat
            if (targetWordIndices[targetIndex + 1] - targetWordIndices[targetIndex] < 16) {
                targetIndex++;
            } else {
                // if next target word more than 5 words away, append the snippet to the snippet string and repeat with a new snippetStartIndex
                const snippetEndIndex = Math.min(untrimmedSnippetWordList.length, targetWordIndices[targetIndex] + 8);
                snippet += untrimmedSnippetWordList.slice(snippetStartIndex, snippetEndIndex).join(" ") + " ... ";
                targetIndex++;
                snippetStartIndex = Math.max(0, targetWordIndices[targetIndex] - 7);
            }
        }

        // if there are no more target words, append the rest of the sentence to the snippet string
        const snippetEndIndex = Math.min(untrimmedSnippetWordList.length, targetWordIndices[targetIndex] + 8);
        snippet += untrimmedSnippetWordList.slice(snippetStartIndex, snippetEndIndex).join(" ") + " ... ";

        return snippet;
    }
}
</script>
