<template>
  <div class="page-container">
    <div class="search-bar-container">
      <SearchBar @newsearch="executeInitialSearch"></SearchBar>
    </div>
    <div class="row">
      <div class="col-md-3">
        <div class="search-filters">
          <SearchFilters></SearchFilters>
        </div>
      </div>

      <div class="col-md-9">
        <div class="light-green-container">
          <div v-if="!searchParamsInstance.searchOccurred && !loading">
            <h5>{{ $t('resultsWillBeDisplayedHere') }}</h5>
          </div>
          <div v-else-if="loading">
            <div class="spinner-border" role="status">
              <span class="sr-only">{{ $t('loading') }}</span>
            </div>
            <div class="info">
              <h6>{{ $t('additionalLoadingInfo') }}</h6>
            </div>
          </div>
          <div v-else-if="resultsInstance.results[0]?.length == 0">
            <h5>{{ $t('noResults') }}</h5>
          </div>
          <div v-else>
            <div class="showing-results">
              {{ getShowingResultsText() }}
            </div>
            <div v-for="i in resultsInstance.getResultsPage(page)?.length" class="search-results">
              <SearchResult v-bind:page="page" v-bind:index="i - 1"
                            v-bind:selectedSpeaker="searchParamsInstance.speaker" @openPdf="openPdf"></SearchResult>
            </div>
          </div>
        </div>
        <div class="paging" v-if="resultsInstance.results[0]">
          <Paging v-bind:numOfDocuments="results.total" v-bind:currentPage="page" v-bind:pageSize="pageSize"
                  v-bind:pagesShown="numOfPagesShown" @page-click="changePageTo"></Paging>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-results {
  margin-bottom: 30px;
}

.search-results:last-child {
  margin-bottom: 0px;
}

.search-filters {
  position: sticky;
  top: 20px;
  z-index: 1;
  transition: top 1s ease-in-out;
  margin-bottom: 1rem;
}

.search-bar-container {
  margin: 0.75rem;
  background-color: #f0f7ee;
  border-radius: 10px;
  padding: 20px;
  color: #1e1e24;
}

.spinner-border {
  color: #708D81 !important;
}

.showing-results {
  background-color: #708D81;
  color: #F0F7EE;
  padding: 1rem;
  border-radius: 10px;
  font-size: larger;
  margin-bottom: 1rem;
  font-weight: bold;
}

</style>

<script lang="ts">

import axios from 'axios';
import { Options, Vue } from 'vue-class-component';
import { mapMutations, mapGetters } from 'vuex';
import i18n from '@/data/i18setup';

// components
import SearchBar from '@components/SearchBar.vue';
import SearchResult from '@components/SearchResult.vue';
import SearchFilters from '@components/SearchFilters.vue';
import Paging from '@components/Paging.vue';

// types
import { Attendee } from '@/types/Attendee';
import { Place } from '@/types/Place';
import { SearchParams } from '@/types/SearchParams';
import { Filters } from '@/types/Filters';
import { Results } from '@/types/Results';

@Options({
  components: {
    SearchBar,
    SearchResult,
    SearchFilters,
    Paging
  },
  computed: {
    ...mapGetters('searchParamsModule', ['searchParamsInstance']),
    ...mapGetters('searchFiltersModule', ['searchFiltersInstance']),
    ...mapGetters('resultsModule', ['resultsInstance']),
  },
  methods: {
    ...mapMutations('resultsModule', ['setResults', 'initResults', 'resetResults']),
  }
})

export default class SearchView extends Vue {

  get searchParams(): SearchParams {
    return this.searchParamsInstance;
  }
  get searchFilters(): Filters {
    return this.searchFiltersInstance;
  }
  get results(): Results {
    return this.resultsInstance;
  }

  [x: string]: any;

  loading: boolean = false;

  currentSearchParams?: SearchParams;
  currentSearchFilters?: Filters;
  page: number = 0;
  pageSize: number = 10;
  numOfPagesShown: number = 10;
  validDocumentIds: string[] = [];

  isPreloadingPages: boolean = false;
  stopPreloading: boolean = false;
  resolvePreload: (value?: unknown) => void = () => { };
  rejectPreload: (reason?: any) => void = (reason?) => { console.error(reason) };


  mounted(): void {
    this.page = this.results.page;
    this.pageSize = this.results.pageSize;

    this.recalcPagesShown()
    window.addEventListener('resize', () => {
      this.recalcPagesShown()
    });
  }

  unmounted(): void {
    window.removeEventListener('resize', () => {
      this.recalcPagesShown()
    });

    this.results.page = this.page;
    this.results.pageSize = this.pageSize;
  }

  recalcPagesShown() {
    if (window.innerWidth < 576) {
      this.numOfPagesShown = 3;
    } else if (window.innerWidth < 768) {
      this.numOfPagesShown = 5;
    } else if (window.innerWidth < 992) {
      this.numOfPagesShown = 7;
    } else {
      this.numOfPagesShown = 10;
    }
  }

  initList(length: number) {
    let list: any[] = [];
    for (let i = 0; i < length; i++) {
      list.push(undefined);
    }
    return list;
  }
  /**
   * Executes a search with the stored parameters.
   */
  async executeInitialSearch() {
    // check if search is already loading and ignore if it is
    if (this.loading) {
      console.log("ignoring search")
      return;
    }

    if (this.isPreloadingPages) {
      this.stopPreloading = true;
      await new Promise((resolve, reject) => {
        this.resolvePreload = resolve;
        this.rejectPreload = reject;
      });
    }


    // reset searchAfter data
    this.searchParams.pitId = undefined;
    this.searchParams.searchAfterScore = undefined;
    this.searchParams.searchAfterDate = undefined;
    this.searchParams.searchAfterIndex = undefined;

    // save current search params and filters state
    this.currentSearchParams = { ...this.searchParamsInstance };
    this.currentSearchFilters = { ...this.searchFiltersInstance };

    const queryParams = this.buildQueryParams({ ...this.currentSearchParams, ...this.currentSearchFilters });

    this.loading = true;
    this.resetResults();

    // execute search
    axios.get(process.env.VUE_APP_API_URL + "/meetings/getPage/1" + queryParams, {
      timeout: 60000
    }).then((response: any) => {
      // get pit and searchAfter data from response
      this.searchParams.pitId = response.data.pitId;
      this.searchParams.searchAfterScore = response.data.searchAfterScore;
      this.searchParams.searchAfterDate = response.data.searchAfterDate;
      this.searchParams.searchAfterIndex = response.data.searchAfterIndex;

      if (this.currentSearchParams) this.currentSearchParams.pitId = response.data.pitId;
      if (this.currentSearchParams) this.currentSearchParams.searchAfterScore = response.data.searchAfterScore;
      if (this.currentSearchParams) this.currentSearchParams.searchAfterDate = response.data.searchAfterDate;
      if (this.currentSearchParams) this.currentSearchParams.searchAfterIndex = response.data.searchAfterIndex;

      // save query results
      this.initResults({
        total: response.data.total,
        pageSize: this.pageSize
      })
      this.results.results[0] = response.data.meetings;


      // set loading to false and searchOccurred to true
      this.loading = false;
      this.searchParamsInstance.searchOccurred = true;

      // preload pages
      this.changePageTo(0);
    }).catch((error: any) => {
      this.loading = false;
      this.searchParamsInstance.searchOccurred = true;
      console.error(error);
    });
  }

  getOtherLocales(key: "dezelniGlavar" | "porocevalec" | "predsednik") {
    let otherLocales = "";
    for (const [lang, value] of Object.entries(i18n.global.messages)) {
      if (lang !== i18n.global.locale) {
        otherLocales += `,${value[key]}`;
      }
    }
    return otherLocales;
  }

  /**
   * Builds query parameters for the search request.
   *
   * @param {Object} params - The search parameters.
   * @returns {string} The query parameters.
   */
  buildQueryParams(params: any): string {
    let queryParams = "";
    for (const [key, value] of Object.entries(params)) {
      if (key === "speaker") {
        const attendee = value as Attendee | undefined;
        if (attendee === undefined) continue;

        console.log(attendee);
        queryParams += queryParams === "" ? "?" : "&";
        queryParams += "speaker=" + attendee.names.join(",");

        // add special attendee names
        if (attendee.id === "1") {
          queryParams += this.getOtherLocales("dezelniGlavar");
        } else if (attendee.id === "2") {
          queryParams += this.getOtherLocales("porocevalec");
        } else if (attendee.id === "3") {
          queryParams += this.getOtherLocales("predsednik");
        }
      }
      else if (key === "place") {
        const place = value as Place | undefined;
        if (place === undefined) continue;

        queryParams += queryParams === "" ? "?" : "&";
        queryParams += "place="
        for (const [lang, name] of Object.entries(place.names)) {
          queryParams += `{${lang}:${name}}`
        }
      }
      else if (value !== "" && value !== undefined) {
        queryParams += queryParams === "" ? "?" : "&";
        queryParams += key + "=" + value;
      }
    }
    return queryParams;
  }

  /**
   * Changes the page to the given page and starts preloading the pages.
   * @param {number} page - The page to change to.
   */
  changePageTo(page: number) {

    // set page
    this.page = page;

    // preload pages
    this.preloadPages();
  }

  // Preloads pages one by one, starting from page 1.
  // should wait for previous page to load before loading next page
  async preloadPages() {

    this.isPreloadingPages = true;
    for (const [index, page] of this.results.results.entries()) {
      if (this.stopPreloading) {
        break;
      }
      else if (page === undefined) {
        let preloadError = false;
        await this.loadPage(index + 1).catch((error: any) => {
          console.error(error);
          preloadError = true;
        });
        if (this.stopPreloading || preloadError) {
          break;
        }
      }
    }
    this.isPreloadingPages = false;
    this.stopPreloading = false;
    setTimeout(() => {
      this.resolvePreload();
    });
  }


  async loadPage(page: number) {
    await axios.get(process.env.VUE_APP_API_URL + `/meetings/getPage/${page}` + this.buildQueryParams({
      ...this.currentSearchParams,
      ...this.currentSearchFilters,
      pageSize: this.pageSize,
    })).then((response: any) => {
      this.setResults({
        results: response.data.meetings,
        page: page - 1
      })
      this.searchParams.pitId = response.data.pitId;
      this.searchParams.searchAfterScore = response.data.searchAfterScore;
      this.searchParams.searchAfterDate = response.data.searchAfterDate;
      this.searchParams.searchAfterIndex = response.data.searchAfterIndex;

      if (this.currentSearchParams) this.currentSearchParams.pitId = response.data.pitId;
      if (this.currentSearchParams) this.currentSearchParams.searchAfterScore = response.data.searchAfterScore;
      if (this.currentSearchParams) this.currentSearchParams.searchAfterDate = response.data.searchAfterDate;
      if (this.currentSearchParams) this.currentSearchParams.searchAfterIndex = response.data.searchAfterIndex;

      return response;
    }).catch((error: any) => {
      throw error;
    });
  }

  openPdf(meeting_id: string) {
    this.$router.push({ name: 'view-pdf', params: { meeting_id: meeting_id } })
  }

  getShowingResultsText() {
    let start = this.page * this.pageSize + 1;
    let end = Math.min(this.results.total, (this.page + 1) * this.pageSize);
    return `${this.$t('showingResults')} ${start} - ${end} ${this.$t('of')} ${this.results.total}`
  }
}
</script>
