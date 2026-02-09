<template>
  <!-- PDF / transcript container -->
  <div class="pdf-viewer-container">

    <!-- Toolbar for mobile devices -->
    <div v-if="!windowAllowsPdfDisplay()" class="toolbar-container">

      <!-- Hamburger Menu Toggle Button -->
      <div class="hamburger-menu" @click="showToolbar = !showToolbar">
        <i class="fa" :class="showToolbar ? 'fa-xmark' : 'fa-bars'"></i>
        <div class="title">
          <h3><strong>{{ $t('toolbar') }}</strong></h3>
        </div>
        <div></div>
      </div>

      <div v-if="showToolbar" class="toolbar-content-wrapper">
        <!-- Language selection -->
        <div class="toolbar-control-container language-control" v-if="show === 'transcript'">
          <div class="toolbar-label">
            <h5>{{ $t('language') }}</h5>
          </div>
          <div class="toolbar-content">
            <select class="input-field" v-model="transcriptLanguage">
              <option value="">{{ $t('dontTranslate') }}</option>
              <option v-for="lang in languageOptions" :value="lang">{{ $t(lang) }}</option>
            </select>
          </div>
        </div>

        <!-- Search bar -->
        <div class="toolbar-control-container">
          <div class="toolbar-label">
            <h5>{{ $t('textSearch') }}</h5>
          </div>
          <div class="toolbar-content">

            <div class="row">
              <div class="row col-9">
                <!-- Search bar for searching the document content  -->
                <input
                    type="text"
                    class="form-control input-field"
                    :placeholder="$t('searchBarPlaceholder')"
                    v-model="query"
                    @keyup.enter="searchForHighlights"
                />

                <!-- Option list for choosing speaker -->
                <Typeahead
                    :placeholder="$t('allSpeakers')"
                    :list="speakerList"
                    :displayFn="speakerDisplayFn"
                    :emptyItem="undefined"
                    :getter="getSelectedSpeaker"
                    @selectedChange="handleSpeakerChanged"
                />

              </div>
              <div class="col-3 search-bar-button-container row">
                <!-- Search button -->
                <button class="btn btn-default" type="button" @click="searchForHighlights">
                  <i class="fa fa-search"></i>
                </button>
                <!-- Clear button-->
                <button class="btn btn-default btn-warn" type="button" @click="clear">
                  <i class="fa fa-xmark"></i>
                </button>
              </div>
            </div>
            <div class="row py-2 my-2">
              <input
                  type="checkbox"
                  id="looseSearch"
                  class="col-2 d-flex align-content-start form-check-input checkbox"
                  placeholder="Loose search"
                  v-model="looseSearch"
              />
              <label for="looseSearch" class="col-10 d-flex align-content-start">{{ $t('looseSearch') }}</label>
            </div>

            <div class="content-search-buttons">
              <div class="btn btn-primary content-search-button" @click="previousHighlightClick"
                   v-if="showNextPrevHighlightButtons()">
                <i class="fas fa-arrow-left"></i>
              </div>
              <div class="btn btn-primary content-search-button" @click="nextHighlightClick"
                   v-if="showNextPrevHighlightButtons()">
                <i class="fas fa-arrow-right"></i>
              </div>
            </div>
            <div class="highlight-text-info" v-if="show === 'pdf'">
              {{
                pdfHighlightsInstance.displayedHighlights(this.query)
              }}
            </div>
            <div class="highlight-text-info" v-if="show === 'transcript'">
              {{
                getTranscriptHighlights()
              }}
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Display of original document -->
    <PdfDisplay v-if="windowAllowsPdfDisplay()"
                :class="{ 'blur': loading, 'scrollable': show === 'pdf' }"
                v-bind:meeting_id="meeting_id" @loaded="handleLoaded" @loading="handleLoading"
                @executeInitialSearch="searchForHighlights"></PdfDisplay>
    <!-- Display of transcript -->
    <Transcript v-if="show === 'transcript'"
                :class="{ 'blur': loading, 'scrollable': show === 'transcript' }"
                @loaded="handleLoaded" @loading="handleLoading">
    </Transcript>
    <!-- Display of loading wheel -->
    <div class="loading-container" v-if="loading">
      <div class="spinner-border" role="status">
        <span class="sr-only">{{ $t('loading') }}</span>
      </div>
    </div>

    <!-- Toolbar for PC -->
    <div class="toolbar-container" v-if="windowAllowsPdfDisplay()">
      <!-- Toolbar title -->
      <div class="title">
        <h3><strong>{{ $t('toolbar') }}</strong></h3>
      </div>

      <!-- Toggle between original PDF and transcript -->
      <div class="toolbar-control-container">
        <div class="toolbar-label">
          <h5>{{ $t('show') }}</h5>
        </div>
        <div class="toolbar-content">
          <select class="input-field" v-model="show">
            <option value="pdf" id="choosePdfOption">{{ $t('originalDocument') }}</option>
            <option value="transcript">{{ $t('transcript') }}</option>
          </select>
        </div>
      </div>

      <!-- Language selection -->
      <div class="toolbar-control-container" v-if="show === 'transcript'">
        <div class="toolbar-label">
          <h5>{{ $t('transcriptLanguage') }}</h5>
        </div>
        <div class="toolbar-content">
          <select class="input-field" v-model="transcriptLanguage">
            <option value="">{{ $t('dontTranslate') }}</option>
            <option v-for="lang in languageOptions" :value="lang">{{ $t(lang) }}</option>
          </select>
        </div>
      </div>

      <!-- Search bar -->
      <div class="toolbar-control-container">
        <div class="toolbar-label">
          <h5>{{ $t('textSearch') }}</h5>
        </div>
        <div class="toolbar-content">

          <div class="row">
            <div class="row col-md-9">
              <!-- Search bar for searching the document content  -->
              <input
                  type="text"
                  class="form-control input-field"
                  :placeholder="$t('searchBarPlaceholder')"
                  v-model="query"
                  @keyup.enter="searchForHighlights"
              />

              <!-- Option list for choosing speaker -->
              <Typeahead
                  :placeholder="$t('allSpeakers')"
                  :list="speakerList"
                  :displayFn="speakerDisplayFn"
                  :emptyItem="undefined"
                  :getter="getSelectedSpeaker"
                  @selectedChange="handleSpeakerChanged"
              />


            </div>
            <div class="col-md-3 search-bar-button-container row">
              <!-- Search button -->
              <button class="col-md-5 btn btn-default" type="button" @click="searchForHighlights" :disabled="loading">
                <i class="fa fa-search"></i>
              </button>
              <!-- Clear button-->
              <button class="col-md-5 btn btn-default btn-warn" type="button" @click="clear">
                <i class="fa fa-xmark"></i>
              </button>
            </div>
          </div>

          <div class="row py-2 my-2">
            <input
                type="checkbox"
                id="looseSearch"
                class="col-1 d-flex align-content-start form-check-input checkbox"
                placeholder="Loose search"
                v-model="looseSearch"
            />
            <label for="looseSearch" class="col-11 d-flex align-content-start">{{ $t('looseSearch') }}</label>
          </div>

          <div class="content-search-buttons">
            <div class="btn btn-primary content-search-button" @click="previousHighlightClick"
                 v-if="showNextPrevHighlightButtons()">
              <i class="fas fa-arrow-left"></i>
            </div>
            <div class="btn btn-primary content-search-button" @click="nextHighlightClick"
                 v-if="showNextPrevHighlightButtons()">
              <i class="fas fa-arrow-right"></i>
            </div>
          </div>
          <div class="highlight-text-info" v-if="show === 'pdf'">
            {{
              pdfHighlightsInstance.displayedHighlights(this.query)
            }}
          </div>
          <div class="highlight-text-info" v-if="show === 'transcript'">
            {{
              getTranscriptHighlights()
            }}
          </div>
        </div>
      </div>

      <!-- Search info -->
      <div class="toolbar-tooltip">
        <button class="btn btn-primary btn-tooltip" @click="toggleTooltip" :class="{ 'btn-disabled': showTooltip }">
          <i class="fas fa-circle-question"></i>
        </button>
        <div class="tooltip-text" :class="{ 'tooltip-hidden': !showTooltip }">
          <button class="btn btn-primary hide-button" @click="toggleTooltip"><i class="fas fa-eye-slash"></i></button>
          <p>{{ $t('tooltip') }}</p>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination-control-container" v-if="show === 'pdf'">
        <button class="btn btn-primary pagination-button" @click="documentPagination.previousPage()"
                :disabled="!documentPagination.hasPreviousPage()">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="pagination">
          <span class="max-pages">{{ $t('page') }}&nbsp;&nbsp;</span>
          <input type="number" class="page-input" v-model="pageInput" :min="1" :max="documentPagination.total"
                 @keyup.enter="applyPageInput()" @blur="applyPageInput()">
          <span class="max-pages">/ {{ documentPagination.total() }}</span>
        </div>
        <button class="btn btn-primary pagination-button" @click="documentPagination.nextPage()"
                :disabled="!documentPagination.hasNextPage()">
          <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>

.search-bar-button-container {
  align-items: center;
  display: flex;
  flex-direction: column;
}

.search-bar-button-container button {
  padding: 10% 30% 10% 30%;
  margin: auto;
  border-radius: 20px;
}

.row {
  display: flex !important;
  margin: 0;
  padding: 0;
}

.typeahead-container {
  padding: 0;
}

.search-bar-button-container .btn {
  padding: 0.5rem !important;
  margin: 0.5rem !important;
  width: 75% !important;
  height: fit-content !important;
}

.search-bar-button-container .btn > i {
  height: auto;
}

@media (max-width: 768px) {
  .search-bar-button-container .btn {
    width: fit-content !important;
    padding: 0.5rem 1.5rem !important;
  }
}

.search-bar-button-container .btn-default :disabled {
  margin: 0px;
  background-color: #f7f6ee;
  border-color: #f0f7ee;
  color: #1e1e24;
}

.search-bar-button-container .btn-warn {
  background-color: #883636 !important;
  color: #f0f7ee;
}


.toolbar-tooltip {
  transition: all 0.3s ease-in-out;
  display: grid;
}

.btn-tooltip, .tooltip-text {
  grid-column: 1;
  grid-row: 1;
}

.btn-tooltip {
  display: flex;
  padding: 0.8rem;
  margin: 1rem;
  background-color: #708d81;
  color: #f0f7ee;
  border: none;
  border-radius: 50px;
  z-index: 2;
  width: fit-content;
  height: fit-content;
  transition: all 0.2s ease-in-out;
}

.tooltip-text {
  padding: 1rem;
  text-align: justify;
  position: relative;
  margin: 0 0.5rem;
  background-color: #708d81;
  color: #f0f7ee;
  border-radius: 10px;
  z-index: 1;
  opacity: 1;
  transition: all 0.2s ease-in-out;
}

.tooltip-text p {
  padding-top: 0.3rem;
  border-top: #f0f7ee 3px solid;
}

.tooltip-hidden {
  display: none;
}

.btn-disabled {
  pointer-events: none;
  opacity: 0;
}

.hide-button {
  display: flex;
  padding: 0.8rem;
  border-radius: 20px;
  margin-bottom: 0.5rem;
}


.title {
  margin: 0.5rem;
  padding: 0.5rem 0 0.2rem 0;
  color: #708d81;
}

.pdf-viewer-container {
  display: flex;
  height: fit-content;
}

.content-search-buttons {
  margin: 0.5rem;
  display: flex;
  justify-content: space-between;
}

.content-search-button {
  margin: 0 0.5rem;
  flex: 1;
}

.highlight-text-info {
  margin: 0 0.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
}


.pdf-container {
  min-width: 1000px;
  width: 69vw;
  height: 0vh;
  position: absolute;
  left: 1vw;
  margin: 1rem auto 0 auto;
  background-color: #f0f7ee;
  border-radius: 10px !important;
  overflow: hidden;
}

.page {
  border: none !important;
  margin: 1rem auto !important;
}

.transcript-container {
  width: 69vw;
  height: 0vh;
  position: absolute;
  left: 1vw;
  margin: 1rem auto 0 auto;
  border: 5px solid #f0f7ee;
  background-color: #f0f7ee;
  border-radius: 10px !important;
  overflow-y: hidden;
  padding: 1rem;
}

.scrollable {
  height: 89vh;
  overflow: scroll;
  border-top: 10px solid #f0f7ee;
  border-bottom: 10px solid #f0f7ee;
}

.toolbar-container {
  width: 27vw;
  height: 89vh;
  position: absolute;
  right: 0;
  margin: 1rem;
  border-radius: 10px;
  background-color: #f0f7ee;
  transition: all 0.2s ease-in-out;
}

.toolbar-content {
  background-color: #f0f7ee;
  padding: 0.5rem;
  border: #708d81 4px solid;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}

.toolbar-label {
  background-color: #708d81;
  color: #f0f7ee;
  padding-top: 0.7rem;
  padding-bottom: 0.1rem;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
}


.loading-text {
  position: absolute;
  top: 50%;
  left: calc(50% - 10rem);
}

select {
  width: 100%;
}

.toolbar-control-container {
  margin: 0.5rem;
  width: calc(100% - 1rem);
}

.pagination-control-container {
  margin: 0.5rem;
  padding: 0.5rem 0 0.2rem 0;
  border-radius: 10px;
  background-color: #708d81;
  color: #f0f7ee;
  position: absolute;
  display: flex;
  justify-content: space-between;
  bottom: 0;
  right: 0;
  width: calc(100% - 1rem);
}

.page-input {
  width: 2.5rem;
  padding-bottom: 2px;
  border: none !important;
  border-bottom: #f0f7ee 2px solid !important;
  background-color: transparent !important;
  color: #f0f7ee !important;
  font-size: larger;
  text-align: center;
  transition: all 0.2s ease-in-out;
}

.page-input:focus {
  border-radius: 5px;
  background-color: #1e1e2440 !important;
  border-bottom: transparent 2px solid !important;
  box-shadow: 0px !important;
  outline: none !important;
}

.max-pages {
  color: #f0f7ee;
  font-size: larger;
}

.pagination {
  display: flex;
  align-items: center;
}

.pagination-button {
  margin: 0 0.5rem;
}

input:focus {
  outline: none;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type=number] {
  -moz-appearance: textfield;
  appearance: textfield;
}

.highlight {
  background-color: rgba(255, 0, 0) !important;
}

.current-selected-highlight {
  background-color: rgba(255, 0, 255) !important;
}

.blur {
  overflow-y: hidden !important;
}


.blur ::v-deep > * {
  filter: blur(20px);
}

.hide {
  display: none;
}


.btn-disabled:hover {
  pointer-events: none;
  background-color: #708d81 !important;
  color: #f0f7ee !important;
}

.loading-container {
  position: absolute;
  top: 50%;
  left: calc(75vw * 0.5);
}

@media (max-width: 1350px) {

  .hamburger-menu {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 3rem;
    padding: 0 1rem;
    cursor: pointer;
    font-size: 1.5rem;
    color: #333;
    border-bottom: 4px solid #708d81;
  }

  .pdf-viewer-container {
    display: flex;
    flex-direction: column;
  }

  .transcript-container {
    position: relative;
    margin: 1rem;
    left: 0;
    width: calc(100vw - 2rem);
    height: unset;
    border-radius: 10px;
  }

  .toolbar-container {
    all: unset;
    background-color: #f0f7ee;
    border-radius: 10px;
    position: sticky;
    top: 0;
    left: 0;
    height: fit-content;
    margin: 1rem 1rem 0 1rem;
    z-index: 5;
    display: flex;
    flex-direction: column;
    transition: all 0.2s ease-in-out;
  }

  .toolbar-container > * {
    flex: 1;
  }

  .toolbar-container * {
    font-size: 1rem;
  }

  .loading-container {
    z-index: 1000;
    position: absolute;
    top: 50%;
    left: 50%;
  }

  .language-control {
    display: flex;
    flex-direction: column;
  }

  .language-control > .toolbar-content {
    padding: 0.8rem !important;
    flex: 1;
  }

  .language-control > .toolbar-content > .input-field {
    padding-bottom: 0.5rem !important;
    padding-left: 0.5rem !important;
  }
}

</style>

<script lang="ts">
import Typeahead from '@/components/Typeahead.vue';
import PdfDisplay from '@components/PdfDisplay.vue';
import Transcript from '@components/Transcript.vue';
import 'pdfjs-dist/build/pdf.worker.entry';
import 'pdfjs-dist/web/pdf_viewer.css';
import {Options, Vue} from 'vue-class-component';
import {Watch} from 'vue-property-decorator';
import {closest, distance} from "fastest-levenshtein";
import {mapGetters, mapMutations} from 'vuex';
import axios from 'axios';
import {SearchParams} from '@/types/SearchParams';
import {PdfHighlights, TranscriptHighlights} from '@/types/Highlights';
import {Pagination} from '@/types/Pagination';
import {MeetingSearchParams} from "@/types/MeetingSearchParams";
import store from "@/store";
import {corporaList} from '@/data/corporaInfo';

@Options({
  props: {
    meeting_id: {
      type: String,
      required: true
    },
  },
  components: {
    Typeahead,
    PdfDisplay,
    Transcript
  },
  computed: {
    ...mapGetters('searchParamsModule', ['searchParamsInstance']),
    ...mapGetters('meetingSearchParamsModule', ['meetingSearchParamsInstance']),
    ...mapGetters('transcriptHighlightsModule', ['transcriptHighlightsInstance']),
    ...mapGetters('pdfHighlightsModule', ['pdfHighlightsInstance']),
    ...mapGetters('documentPaginationModule', ['documentPaginationInstance']),
  },
  methods: {
    ...mapMutations(['clearMatches', 'nextHighlight', 'previousHighlight', 'reset']),
    ...mapMutations('searchParamsModule', ['']),
    ...mapMutations('meetingSearchParamsModule', ['resetMeetingSearchParams', 'updateMeetingId', 'updateSearchQuery', 'updateSpeaker', 'updateLanguage', 'updateLooseSearch']),
    ...mapMutations('transcriptHighlightsModule', ['updateOriginalTranscript', 'setUpdateTranscriptIndex', 'setUpdateTranscriptTotal',]),
    ...mapMutations('pdfHighlightsModule', ['updatePdfAnnotationFactory']),
    ...mapMutations('documentPaginationModule', ['setPage', 'updatePageInputFunctions', 'resetPagination'])
  }
})

export default class PdfView extends Vue {
  [x: string]: any;

  get searchParams(): SearchParams {
    return this.searchParamsInstance;
  }

  get meetingSearchParams(): MeetingSearchParams {
    return this.meetingSearchParamsInstance;
  }

  get transcriptHighlights(): TranscriptHighlights {
    return this.transcriptHighlightsInstance;
  }

  get pdfHighlights(): PdfHighlights {
    return this.pdfHighlightsInstance;
  }

  get documentPagination(): Pagination {
    return this.documentPaginationInstance;
  }

  meeting_id?: string;
  transcriptLanguage: string = '';
  languageOptions: string[] = ['sl'];
  speakerList: string[] = [];


  show: string = ''
  loading: boolean = false;

  query: string = '';
  speaker?: string = '';
  looseSearch: boolean = false;

  pageInput: number = 1;
  windowWidth: number = window.innerWidth;

  transcriptIndex: number = 0;
  transcriptTotal: number = 0;

  showTooltip: boolean = false;
  showToolbar: boolean = true;

  async mounted(): Promise<void> {
    this.handleLoading();
    this.show = this.windowAllowsPdfDisplay() ? 'pdf' : 'transcript';

    // not the best way, but works
    console.log(this.meeting_id);
    switch (this.meeting_id?.split('_')[0]) {
      case "DZK":
        this.languageOptions = corporaList[0].languages;
        break;
      case "yu1Parl":
        this.languageOptions = corporaList[1].languages;
        break;
      default:
        this.languageOptions = ['sl'];
    }

    window.addEventListener('resize', this.onResize);

    this.initStoreParams();
    await this.initSpeakerList();
    this.getTranscript();
  }

  unmounted(): void {
    window.removeEventListener('resize', this.onResize);

    this.resetStoreParams();
  }

  /* Event listener functions */
  onResize() {
    this.windowWidth = window.innerWidth;
    if (!this.windowAllowsPdfDisplay()) {
      const choosePdfOption = document.getElementById('choosePdfOption') as HTMLOptionElement;
      if (choosePdfOption !== null) {
        choosePdfOption.disabled = true;
      }
      this.show = 'transcript';
    } else {
      const choosePdfOption = document.getElementById('choosePdfOption') as HTMLOptionElement;
      if (choosePdfOption !== null) {
        choosePdfOption.disabled = false;
      }
    }
  }


  handleLoading() {
    this.loading = true;
  }

  handleLoaded() {
    this.loading = false;
  }

  async searchForHighlights() {
    // If the search is already in progress, do not start another one
    if (this.loading)
      return;

    this.handleLoading();
    await store.dispatch('fetchHighlights', this.windowAllowsPdfDisplay());
    this.handleLoaded();
  }

  async clear() {
    this.looseSearch = false;
    this.query = '';
    this.updateSpeaker(undefined);

    this.resetPagination();
    this.clearMatches();
  }

  @Watch('transcriptLanguage') onTranscriptLanguageChanged() {
    this.updateLanguage(this.transcriptLanguage ? this.transcriptLanguage : undefined);
    this.getTranscript();
  }

  @Watch('query') onQueryChanged() {
    this.updateSearchQuery(this.query);
  }

  @Watch('looseSearch') onLooseSearchChanged() {
    this.updateLooseSearch(this.looseSearch);
  }

  @Watch('show') onShowChanged() {
    if (this.show === 'pdf') {
      this.transcriptLanguage = ''; // Sets the language to original when switching to pdf
      if (this.pdfHighlights.total === 0) {
        this.documentPagination.syncPdfToTranscriptScroll();
      } else if (this.transcriptHighlights.total === 0) {
        this.searchForHighlights();
      } else {
        // Finds current highlight in the pdf and scrolls to it
        const currentIndex = Math.min(Math.max(this.transcriptHighlights.index, 0), this.pdfHighlights.highlights.length - 1);
        this.pdfHighlights.updateIndexChanges(currentIndex);
        this.pdfHighlights.scrollToHighlight();
      }
    }

    // switching to transcript logic is implemented in transcript container
  }

  getTranscript() {
    // get meeting as text with meeting_id and transcriptLanguage
    axios.get(process.env.VUE_APP_API_URL + `/meetings/${this.meeting_id}/getMeetingAsText`, {
      params: {
        lang: this.transcriptLanguage,
        pageLang: this.$i18n.locale
      }
    }).then((response) => {
      this.updateOriginalTranscript({
        text: response.data.text,
        callback: this.searchForHighlights
      });
    }).catch((error) => {
      console.log(error)
    });
  }

  applyPageInput() {
    this.setPage(this.pageInput);
  }

  getPageInput(): number {
    return this.pageInput;
  }

  setPageInput(newPageInput: number) {
    if (this.pageInput !== newPageInput) {
      this.pageInput = newPageInput;
    }
  }


  getSelectedSpeaker(): string | undefined {
    return this.meetingSearchParams.speaker;
  }


  initStoreParams(): void {
    this.updatePageInputFunctions({
      getPageInput: this.getPageInput,
      setPageInput: this.setPageInput
    });

    this.updateMeetingId(this.meeting_id);

    // Compose the query from the parameters used to retrieve relevant documents
    let initialQuery = this.searchParams.words.replaceAll(/\s+OR\s+/g, " ") ?? "";
    if (this.searchParams.place?.names) {
      // Get all valid place names
      let validPlaces = Object.values(this.searchParams.place?.names).filter(name => name !== 'zzzzz');
      // If the place name is composed of multiple words, wrap it in quotes
      let placesQuery = validPlaces.map(place => {
        if (place.includes(" ")) {
          return `"${place}"`;
        } else {
          return place;
        }
      }).join(" ");

      // Combine the initial query with the places query
      initialQuery = `${initialQuery} ${placesQuery}`;
    }

    this.query = initialQuery.trim();
    this.updateSearchQuery(this.query);
    // undefined language -> original language
    this.updateLanguage(undefined);

    this.setUpdateTranscriptIndex(this.updateTranscriptIndex);
    this.setUpdateTranscriptTotal(this.updateTranscriptTotal);
  }

  resetStoreParams(): void {
    this.resetMeetingSearchParams();
    this.updatePdfAnnotationFactory(undefined);
    this.updateOriginalTranscript({
      text: '',
      callback: () => {
      }
    });

    this.reset();
    this.documentPagination.reset();
  }

  // HIGHLIGHT FUNCTIONS
  speakerDisplayFn(speaker: string | undefined) {
    return speaker;
  }

  handleSpeakerChanged(speaker: string) {
    this.speaker = speaker;
    this.updateSpeaker(speaker);
  }

  showNextPrevHighlightButtons() {
    if (this.show === 'pdf')
      return this.pdfHighlights.total > 1;
    else
      return this.transcriptHighlights.total > 1;
  }

  async initSpeakerList() {
    this.speakerList = [];
    const response = await fetch(`${process.env.VUE_APP_API_URL}/meetings/${this.meeting_id}/getSpeakers`);
    const data = await response.json();
    this.speakerList = data.speakers;

    // If a speaker is selected, find the most similar speaker from the list set it as selected
    if (this.searchParams.speaker) {
      let selectedSpeakerLastNames = this.searchParams.speaker.names
          .map((name) => name.split(" ").pop())
          .filter((name): name is string => Boolean(name));
      let meetingParticipantsLastNames = this.speakerList
          .map((speaker) => speaker.split(" ").pop())
          .filter((name): name is string => Boolean(name));

      // Get index of the most similar speaker last name to the selected speaker last name
      let closestSpeakerIndex = 0;
      let minDistance = Number.MAX_VALUE;
      for (const lastName of selectedSpeakerLastNames) {
        let mostSimilarSpeakerLastName = closest(lastName, meetingParticipantsLastNames);
        let editDistance = distance(lastName, mostSimilarSpeakerLastName);
        if (editDistance < minDistance) {
          minDistance = editDistance;
          closestSpeakerIndex = meetingParticipantsLastNames.indexOf(mostSimilarSpeakerLastName);
        }
      }

      let closestSpeaker = this.speakerList[closestSpeakerIndex];
      this.updateSpeaker(closestSpeaker);
    }
  }


  previousHighlightClick() {
    this.previousHighlight(this.show === 'pdf');
  }

  nextHighlightClick() {
    this.nextHighlight(this.show === 'pdf');
  }

  getTranscriptHighlights() {
    if (this.transcriptTotal == 0) {
      return "";
    } else {
      return `Zadetek ${this.transcriptIndex + 1} / ${this.transcriptTotal}`;
    }
  }

  updateTranscriptIndex(index: number) {
    this.transcriptIndex = index;
  }

  updateTranscriptTotal(total: number) {
    this.transcriptTotal = total;
  }

  windowAllowsPdfDisplay() {
    return this.windowWidth > 1350;
  }

  toggleTooltip() {
    this.showTooltip = !this.showTooltip;
  }
}
</script>
