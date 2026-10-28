<template>
  <div class="page-container">
    <div class="search-bar-container">
      <!-- hidden when advanced search is open -->
      <SearchBar v-show="!searchParamsInstance.advanced.enabled" @newsearch="onTextSearch"></SearchBar>
      <AdvancedSearch></AdvancedSearch>
    </div>
    <div class="search-layout">
      <aside class="filters-column" :class="{collapsed: !filtersOpen}">
        <!-- filters panel -->
        <div v-show="filtersOpen" class="search-filters">
          <div class="filters-head">
            <span>{{ $t('filters') }}</span>
            <button type="button" class="filters-collapse" :title="$t('hideFilters')" :aria-label="$t('hideFilters')"
                    :aria-expanded="filtersOpen" @click="toggleFilters">
              <i class="fa fa-angles-left"></i>
            </button>
          </div>
          <SearchFilters @ready="onFiltersReady"></SearchFilters>
        </div>

        <!-- collapsed filters -->
        <button v-show="!filtersOpen" type="button" class="filters-rail" :title="$t('showFilters')"
                :aria-label="$t('showFilters')" :aria-expanded="filtersOpen" @click="toggleFilters">
          <i class="fa fa-angles-right"></i>
          <i class="fa fa-sliders"></i>
          <span class="rail-label">{{ $t('filters') }}</span>
          <span class="filters-badge" v-if="activeChips.length > 0">{{ activeChips.length }}</span>
        </button>
      </aside>

      <div class="results-column">
        <div class="results-header" ref="resultsHeader">
          <ul class="tabs-bar" role="tablist">
            <li v-for="tab in tabs" :key="tab.id" role="presentation">
              <button type="button" role="tab" class="tab-button" :class="{active: activeTab === tab.id}"
                      :aria-selected="activeTab === tab.id" @click="setTab(tab.id)">
                {{ $t(tab.label) }}
              </button>
            </li>
          </ul>

          <label class="sort-control" v-if="activeTab === 'results' && searchFilters">
            {{ $t('sort') }}
            <select class="form-select form-select-sm input-field" v-model="searchFilters.sort">
              <option value="relevance">{{ $t('sortByRelevance') }}</option>
              <option value="date_asc">{{ $t('sortByDateAsc') }}</option>
              <option value="date_desc">{{ $t('sortByDateDesc') }}</option>
            </select>
          </label>
        </div>

        <div class="active-filters" v-if="activeChips.length > 0">
          <span class="filter-chip" v-for="chip in activeChips" :key="chip.key">
            {{ chip.label }}
            <button type="button" class="chip-remove" :aria-label="$t('removeFilter')" @click="chip.remove()">
              <i class="fa fa-xmark"></i>
            </button>
          </span>
          <button type="button" class="clear-all" @click="clearAll">{{ $t('clearAll') }}</button>
        </div>

        <div v-show="activeTab === 'results'" role="tabpanel">
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
                    v-bind:pagesShown="numOfPagesShown" @page-click="onPageClick"></Paging>
          </div>
        </div>

        <div v-show="activeTab === 'map'" role="tabpanel">
          <div class="map-status" v-if="mapLoading">
            <div class="spinner-border spinner-border-sm" role="status">
              <span class="sr-only">{{ $t('loading') }}</span>
            </div>
          </div>
          <div class="map-status" v-else-if="!searchParamsInstance.searchOccurred">
            {{ $t('mapNoSearch') }}
          </div>
          <div class="map-status" v-else-if="mapLocations.length === 0">
            {{ $t('mapNoLocations') }}
          </div>
          <div class="map-status" v-if="mapTruncated">{{ $t('mapTruncated') }}</div>
          <MapView :locations="mapLocations" :active="activeTab === 'map'" @select-location="onMapLocationSelect"></MapView>
        </div>

        <div v-show="activeTab === 'timeline'" role="tabpanel">
          <TimelineView :series="timelineSeriesData" :unit="timelineUnit" :canAddSeries="canAddSeries"
                        :interval="timelineInterval" :loading="timelineLoading"
                        :dateFrom="searchFilters.dateFrom" :dateTo="searchFilters.dateTo"
                        :rangeActive="dateRangeActive" @select="onTimelineSelect" @reset="resetDateRange"
                        @interval-change="onTimelineInterval" @unit-change="onTimelineUnit"
                        @add-series="addSeries" @remove-series="removeSeries"
                        @rename-series="renameSeries" @retry="retryTimeline"></TimelineView>
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
  margin-bottom: 0;
}

.search-filters {
  position: sticky;
  top: 20px;
  z-index: 1;
  transition: top 1s ease-in-out;
  margin-bottom: 1rem;
}

.results-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.tabs-bar {
  display: flex;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.search-layout {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin: 0 0.75rem;
}

.filters-column {
  flex: 0 0 25%;
  min-width: 260px;
  max-width: 360px;
}

.filters-column.collapsed {
  flex: 0 0 3rem;
  min-width: 3rem;
}

.results-column {
  flex: 1 1 0;
  min-width: 0;
}

.filters-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.4rem;
  padding-left: 0.25rem;
  color: #f0f7ee;
  font-weight: 600;
}

.filters-collapse,
.filters-rail {
  background: transparent;
  color: #f0f7ee;
  border: 2px solid #f0f7ee;
  border-radius: 10px;
  cursor: pointer;
}

.filters-collapse {
  padding: 0.1rem 0.6rem;
}

.filters-rail {
  position: sticky;
  top: 20px;
  width: 3rem;
  padding: 0.6rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.filters-collapse:hover,
.filters-rail:hover {
  border-color: #1e1e24;
}

.filters-collapse:focus-visible,
.filters-rail:focus-visible {
  outline: 3px solid #1e1e24;
  outline-offset: 2px;
}

.rail-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-weight: 600;
  letter-spacing: 0.05em;
}

.filters-badge {
  display: inline-block;
  min-width: 1.4rem;
  padding: 0 0.35rem;
  border-radius: 10px;
  background-color: #f0f7ee;
  color: #1e1e24;
  font-size: 0.8rem;
}

@media (max-width: 767px) {
  .search-layout {
    flex-direction: column;
    align-items: stretch;
  }

  .filters-column,
  .filters-column.collapsed {
    flex: none;
    width: 100%;
    max-width: none;
  }

  .filters-rail {
    position: static;
    width: 100%;
    flex-direction: row;
    justify-content: center;
    padding: 0.4rem 0;
  }

  .rail-label {
    writing-mode: horizontal-tb;
    transform: none;
  }

  .filters-rail .fa-angles-right {
    transform: rotate(90deg);
  }
}

.sort-control {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #f0f7ee;
  font-weight: 600;
}

.sort-control select {
  width: auto;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.3rem 0.15rem 0.7rem;
  border-radius: 10px;
  background-color: #f0f7ee;
  color: #1e1e24;
  font-size: 0.9rem;
}

.chip-remove {
  border: none;
  background: transparent;
  color: #883636;
  cursor: pointer;
  padding: 0 0.3rem;
}

.clear-all {
  border: none;
  background: transparent;
  color: #f0f7ee;
  text-decoration: underline;
  cursor: pointer;
}

.tab-button {
  background: transparent;
  color: #f0f7ee;
  border: 2px solid #f0f7ee;
  border-radius: 10px;
  padding: 0.4rem 1.2rem;
  font-weight: 600;
  cursor: pointer;
}

.tab-button:hover {
  border-color: #1e1e24;
}

.tab-button.active {
  background-color: #f0f7ee;
  color: #1e1e24;
}

.tab-button:focus-visible {
  outline: 3px solid #1e1e24;
  outline-offset: 2px;
}

.map-status {
  background-color: #f0f7ee;
  color: #1e1e24;
  border-radius: 10px;
  padding: 0.5rem 1rem;
  margin-bottom: 0.5rem;
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
import {Options, Vue} from 'vue-class-component';
import {mapMutations, mapGetters} from 'vuex';

// components
import SearchBar from '@components/SearchBar.vue';
import AdvancedSearch from '@components/AdvancedSearch.vue';
import {advancedFromUrl, advancedSummary, advancedToApi, cloneAdvanced, isAdvancedActive} from '@/data/advancedQuery';
import {AdvancedSearch as AdvancedSearchState} from '@/types/AdvancedQuery';
import SearchResult from '@components/SearchResult.vue';
import SearchFilters from '@components/SearchFilters.vue';
import Paging from '@components/Paging.vue';
import MapView, { MapLocation } from '@components/MapView.vue';
import TimelineView from '@components/TimelineView.vue';
import {ComparisonSeries, TimelineBucket, TimelineInterval, TimelineSeriesData, TimelineUnit} from '@/types/Timeline';
import {MAX_SERIES, nextSeriesColor, SERIES_COLORS, seriesFromQuery, seriesLabel, seriesToQuery} from '@/data/timelineSeries';

// search state
import {
  allCorpora,
  corpusBounds,
  defaultFilters,
  hasFilterKeys,
  placeKey,
  queryToState,
  sameDay,
  stateToQuery,
  UrlState
} from '@/data/searchState';
import {fetchPlaces} from '@/data/places';
import {capTopicLabel} from '@/data/capTopics';
import {Watch} from 'vue-property-decorator';

// types
import {Attendee} from '@/types/Attendee';
import {Place} from '@/types/Place';
import {PersonEntity} from '@/types/PersonEntity';
import {SearchParams} from '@/types/SearchParams';
import {Filters} from '@/types/Filters';
import {Results} from '@/types/Results';
import {CapTopic} from "@/types/CapTopic";

// not used when advanced search is open
const CONTENT_PARAMS = ['words', 'speaker', 'personEntity', 'locationEntity', 'capTopics'];

@Options({
  components: {
    SearchBar,
    AdvancedSearch,
    SearchResult,
    SearchFilters,
    Paging,
    MapView,
    TimelineView
  },
  computed: {
    ...mapGetters('searchParamsModule', ['searchParamsInstance']),
    ...mapGetters('searchFiltersModule', ['searchFiltersInstance']),
    ...mapGetters('resultsModule', ['resultsInstance']),
  },
  methods: {
    ...mapMutations('resultsModule', ['setResults', 'initResults', 'resetResults']),
    ...mapMutations('searchParamsModule', ['updateSearchWords', 'updateSearchSpeaker', 'updatePersonEntity', 'updateLocationEntity', 'removeCapTopic', 'resetSearchParams', 'updateAdvanced']),
    ...mapMutations('searchFiltersModule', ['updateDateFrom', 'updateDateTo', 'updateLanguages', 'updateCorpora', 'updateSort']),
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

  readonly tabs = [
    {id: 'results', label: 'tabResults'},
    {id: 'map', label: 'tabMap'},
    {id: 'timeline', label: 'tabTimeline'}
  ];
  activeTab: string = 'results';

  filtersOpen: boolean = true;
  // search starts when filters are ready
  urlReady: boolean = false;
  searchQueued: boolean = false;
  searchStarting: boolean = false;
  lastExecutedSignature: string | null = null;
  searchTimer?: number;
  writtenQueries: Set<string> = new Set<string>();

  // timeline comparison
  comparisonSeries: ComparisonSeries[] = [];
  // needs to be reactive, currentSearchParams is not
  timelineCurrentQuery: string = '';
  seriesBuckets: Record<string, TimelineBucket[]> = {};
  seriesRequests: Record<string, boolean> = {};
  seriesErrors: Record<string, boolean> = {};
  timelineUnit: TimelineUnit = 'meetings';
  timelineInterval: TimelineInterval = 'year';

  loading: boolean = false;
  mapLocations: MapLocation[] = [];
  mapLoading: boolean = false;
  mapTruncated: boolean = false;
  // last search query and the query the map was loaded for
  lastSearchQuery: string | null = null;
  mapLoadedForQuery: string | null = null;

  currentSearchParams?: SearchParams;
  currentSearchFilters?: Filters;
  page: number = 0;
  pageSize: number = 10;
  numOfPagesShown: number = 10;
  validDocumentIds: string[] = [];

  isPreloadingPages: boolean = false;
  stopPreloading: boolean = false;
  resolvePreload: (value?: unknown) => void = () => {
  };
  rejectPreload: (reason?: any) => void = (reason?) => {
    console.error(reason)
  };


  created(): void {
    const url = queryToState(this.$route.query);
    this.comparisonSeries = seriesFromQuery(this.$route.query.cmp);
    if (url.tab && this.tabs.some(t => t.id === url.tab)) {
      this.activeTab = url.tab;
    }

    try {
      this.filtersOpen = localStorage.getItem('parlavis.filtersOpen') !== 'false';
    } catch (e) {
      // no localStorage
    }

    // restore from URL only on first load
    if (!this.searchParams.searchOccurred) {
      this.applyUrlToStore(url);
    }
  }

  // load words and filters from the URL (entities are restored in SearchFilters)
  applyUrlToStore(url: UrlState) {
    if (url.words) {
      this.updateSearchWords(url.words);
    }
    const advanced = advancedFromUrl(url.advanced);
    if (advanced) {
      this.updateAdvanced(advanced);
    }

    if (hasFilterKeys(this.$route.query)) {
      const defaults = defaultFilters();
      const corpora = (url.corpora ?? defaults.corpora).filter(name => defaults.corpora.includes(name));
      const bounds = corpusBounds(corpora);

      this.searchFilters.corpora = corpora.length > 0 ? corpora : defaults.corpora;
      this.searchFilters.dateFrom = url.dateFrom ?? bounds.dateFrom;
      this.searchFilters.dateTo = url.dateTo ?? bounds.dateTo;
      const languages = (url.languages ?? bounds.languages).filter(language => bounds.languages.includes(language));
      this.searchFilters.languages = languages.length > 0 ? languages : bounds.languages;
      this.searchFilters.sort = url.sort ?? defaults.sort;
      this.searchFilters.initializing = false;
    }
  }

  // everything that changes the results
  get searchSignature(): string {
    const params = this.searchParams;
    const filters = this.searchFilters;
    // content filters are not used when advanced search is open
    const basic = !params.advanced.enabled;
    return JSON.stringify([
      basic ? params.words : null,
      basic ? params.speaker?.id : null,
      basic ? params.personEntity?.id : null,
      basic ? params.locationEntity?.names : null,
      basic ? params.capTopics.map(topic => topic.id) : null,
      isAdvancedActive(params.advanced) ? advancedToApi(params.advanced) : null,
      filters.initializing ? null : [filters.dateFrom, filters.dateTo, filters.languages, filters.corpora, filters.sort]
    ]);
  }

  get urlQuery(): string {
    const query: any = stateToQuery(this.searchParams, this.searchFilters, this.activeTab);
    if (this.comparisonSeries.length > 0) query.cmp = seriesToQuery(this.comparisonSeries);
    return JSON.stringify(query);
  }

  @Watch('urlQuery') onUrlQueryChanged() {
    this.writeUrl();
  }

  writeUrl() {
    if (!this.urlReady) return;
    this.writtenQueries.add(this.normalizeQuery(JSON.parse(this.urlQuery)));
    this.$router.replace({query: JSON.parse(this.urlQuery)});
  }

  // so key order does not matter when comparing
  normalizeQuery(query: { [key: string]: any }): string {
    return JSON.stringify(Object.keys(query).sort().map(key => [key, [].concat(query[key]).map(String)]));
  }

  // URL was changed by hand, reload the page
  @Watch('$route.query') onRouteQueryChanged(query: { [key: string]: any }) {
    // other routes have their own query
    if (!this.urlReady || this.$route.name !== 'search') return;
    if (!this.writtenQueries.has(this.normalizeQuery(query))) {
      window.location.reload();
    }
  }

  @Watch('searchSignature') onSearchStateChanged() {
    if (!this.urlReady) return;
    this.scheduleSearch();
  }

  onFiltersReady() {
    this.urlReady = true;
    this.writeUrl();

    if (!this.searchParams.searchOccurred) {
      this.runSearchIfChanged(true);
    } else {
      this.lastExecutedSignature = this.searchSignature;
    }
  }

  onTextSearch() {
    this.runSearchIfChanged(true);
  }

  onMapLocationSelect(name: string) {
    fetchPlaces().then(places => {
      const place = places.find((p: Place) => placeKey(p.names) === name);
      if (place) this.updateLocationEntity(place);
    });
  }

  // debounce, so more filter changes at once run only one search
  scheduleSearch() {
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => this.runSearchIfChanged(), 300);
  }

  runSearchIfChanged(force: boolean = false) {
    window.clearTimeout(this.searchTimer);
    if (!force && this.searchSignature === this.lastExecutedSignature) return;
    this.executeInitialSearch();
  }

  // scroll to the top of the results
  onPageClick(page: number) {
    this.changePageTo(page);
    this.$nextTick(() => {
      (this.$refs.resultsHeader as HTMLElement | undefined)?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
  }

  toggleFilters() {
    this.filtersOpen = !this.filtersOpen;
    try {
      localStorage.setItem('parlavis.filtersOpen', String(this.filtersOpen));
    } catch (e) {
      // not persisted
    }
  }

  get activeChips(): { key: string, label: string, remove: () => void }[] {
    const chips: { key: string, label: string, remove: () => void }[] = [];
    const params = this.searchParams;
    const filters = this.searchFilters;
    const names = (values: { [key: string]: string } | string[]) =>
        Array.from(new Set(Array.isArray(values) ? values : Object.values(values))).join(' / ');

    // content filters are not used when advanced search is open
    const basic = !params.advanced.enabled;
    if (basic && params.speaker) {
      chips.push({
        key: 'speaker',
        label: `${this.$t('speaker')}: ${names(params.speaker.names)}`,
        remove: () => this.updateSearchSpeaker(undefined)
      });
    }
    if (basic && params.personEntity) {
      chips.push({
        key: 'person',
        label: `${this.$t('personEntity')}: ${names(params.personEntity.names)}`,
        remove: () => this.updatePersonEntity(undefined)
      });
    }
    if (basic && params.locationEntity) {
      chips.push({
        key: 'location',
        label: `${this.$t('locationEntity')}: ${names(params.locationEntity.names)}`,
        remove: () => this.updateLocationEntity(undefined)
      });
    }
    if (isAdvancedActive(params.advanced)) {
      chips.push({
        key: 'advanced',
        label: `${this.$t('advancedSearch')}: ${this.advancedText(params.advanced)}`,
        remove: () => this.updateAdvanced({...params.advanced, enabled: false})
      });
    }
    for (const topic of basic ? params.capTopics : []) {
      chips.push({
        key: 'topic-' + topic.id,
        label: `${this.$t('capTopic')}: ${capTopicLabel(topic.name, this.$i18n.locale)}`,
        remove: () => this.removeCapTopic(topic)
      });
    }

    if (!filters.initializing) {
      const bounds = corpusBounds(filters.corpora);
      const format = (date: Date) => `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
      if (!sameDay(filters.dateFrom, bounds.dateFrom) || !sameDay(filters.dateTo, bounds.dateTo)) {
        chips.push({
          key: 'date',
          label: `${this.$t('date')}: ${format(filters.dateFrom)} – ${format(filters.dateTo)}`,
          remove: () => {
            this.updateDateFrom(bounds.dateFrom);
            this.updateDateTo(bounds.dateTo);
          }
        });
      }
      if (filters.languages.length < bounds.languages.length) {
        chips.push({
          key: 'languages',
          label: `${this.$t('language')}: ${filters.languages.map(language => this.$t(language)).join(', ')}`,
          remove: () => this.updateLanguages(bounds.languages)
        });
      }
      if (filters.corpora.length < allCorpora().length) {
        chips.push({
          key: 'corpora',
          label: `${this.$t('corpus')}: ${filters.corpora.map(corpus => this.$t(corpus)).join(', ')}`,
          remove: () => this.updateCorpora(allCorpora())
        });
      }
    }

    return chips;
  }

  clearAll() {
    const occurred = this.searchParams.searchOccurred;
    this.resetSearchParams();
    this.searchParams.searchOccurred = occurred;

    const defaults = defaultFilters();
    this.updateCorpora(defaults.corpora);
    this.updateDateFrom(defaults.dateFrom);
    this.updateDateTo(defaults.dateTo);
    this.updateLanguages(defaults.languages);
    this.updateSort(defaults.sort);
    this.runSearchIfChanged(true);
  }

  mounted(): void {
    this.page = this.results.page;
    this.pageSize = this.results.pageSize;

    // back from the PDF view, reload the map
    this.loadMapLocationsIfNeeded();

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
    // search is running, run again when it is done
    if (this.loading || this.searchStarting) {
      this.searchQueued = true;
      return;
    }
    this.searchStarting = true;
    this.lastExecutedSignature = this.searchSignature;

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
    this.currentSearchParams = {...this.searchParamsInstance, advanced: cloneAdvanced(this.searchParamsInstance.advanced)};
    this.currentSearchFilters = {...this.searchFiltersInstance};
    this.timelineCurrentQuery = this.timelineBaseQuery();

    const queryParams = this.buildQueryParams({...this.currentSearchParams, ...this.currentSearchFilters});

    this.loading = true;
    this.searchStarting = false;
    this.mapLocations = [];
    this.mapTruncated = false;
    this.mapLoadedForQuery = null;
    this.lastSearchQuery = queryParams;
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

      // update map and timeline (only fetched when their tab is open)
      this.loadMapLocationsIfNeeded();
      this.loadTimelineIfNeeded();

      // preload pages
      this.changePageTo(0);
      this.runQueuedSearch();
    }).catch((error: any) => {
      this.loading = false;
      this.searchParamsInstance.searchOccurred = true;
      console.error(error);
      this.runQueuedSearch();
    });
  }

  runQueuedSearch() {
    if (this.searchQueued) {
      this.searchQueued = false;
      this.runSearchIfChanged();
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'map') {
      this.loadMapLocationsIfNeeded();
    } else if (tab === 'timeline') {
      this.loadTimelineIfNeeded();
    }
  }

  // date range is not the default one
  get dateRangeActive(): boolean {
    const filters = this.searchFilters;
    if (filters.initializing) return false;
    const bounds = corpusBounds(filters.corpora);
    return !sameDay(filters.dateFrom, bounds.dateFrom) || !sameDay(filters.dateTo, bounds.dateTo);
  }

  // last search query without dates, paging and interval
  timelineBaseQuery(): string {
    const {dateFrom, dateTo, ...filters} = {...(this.currentSearchFilters ?? this.searchFilters)} as any;
    const params: any = {...(this.currentSearchParams ?? this.searchParams)};
    ['pitId', 'searchAfterScore', 'searchAfterDate', 'searchAfterIndex'].forEach(key => delete params[key]);
    return this.buildQueryParams({...params, ...filters});
  }

  // buckets of a series for the current interval and unit
  timelineKey(query: string): string {
    return `${query}${query.includes('?') ? '&' : '?'}interval=${this.timelineInterval}&unit=${this.timelineUnit}`;
  }

  // current search first, then saved ones
  timelineQueries(): string[] {
    return [this.timelineCurrentQuery, ...this.comparisonSeries.map(series => series.query)];
  }

  get timelineSeriesData(): TimelineSeriesData[] {
    const current: TimelineSeriesData = {
      name: this.$t('timelineCurrentSearch') as string,
      color: SERIES_COLORS[0],
      current: true,
      buckets: this.seriesBuckets[this.timelineKey(this.timelineCurrentQuery)] ?? [],
      failed: !!this.seriesErrors[this.timelineKey(this.timelineCurrentQuery)]
    };
    return [current, ...this.comparisonSeries.map(series => ({
      name: series.name,
      color: series.color,
      current: false,
      buckets: this.seriesBuckets[this.timelineKey(series.query)] ?? [],
      failed: !!this.seriesErrors[this.timelineKey(series.query)]
    }))];
  }

  get timelineLoading(): boolean {
    return this.timelineQueries().some(query => this.seriesRequests[this.timelineKey(query)]);
  }

  get canAddSeries(): boolean {
    return this.comparisonSeries.length < MAX_SERIES - 1;
  }

  // load missing series when the timeline tab is open
  loadTimelineIfNeeded() {
    if (this.activeTab !== 'timeline' || !this.searchParamsInstance.searchOccurred || this.loading) {
      return;
    }

    this.pruneSeriesBuckets();

    for (const key of new Set(this.timelineQueries().map(query => this.timelineKey(query)))) {
      if (this.seriesBuckets[key] || this.seriesRequests[key]) continue;

      // store response under its own key
      this.seriesRequests[key] = true;
      delete this.seriesErrors[key];
      axios.get(process.env.VUE_APP_API_URL + '/meetings/getTimeline' + key, {timeout: 60000})
          .then((response: any) => {
            if (!Array.isArray(response.data?.buckets)) throw new Error('No buckets in the timeline response');
            this.seriesBuckets[key] = response.data.buckets;
          })
          .catch((error: any) => {
            console.error(error);
            this.seriesErrors[key] = true;
          })
          .finally(() => {
            delete this.seriesRequests[key];
          });
    }
  }

  // remove buckets of series that are not shown anymore
  pruneSeriesBuckets() {
    const queries = this.timelineQueries();
    const keep = new Set<string>();
    for (const interval of ['year', 'month']) {
      for (const unit of ['meetings', 'segments', 'sentences']) {
        queries.forEach(query => keep.add(`${query}${query.includes('?') ? '&' : '?'}interval=${interval}&unit=${unit}`));
      }
    }
    Object.keys(this.seriesBuckets).filter(key => !keep.has(key)).forEach(key => delete this.seriesBuckets[key]);
    Object.keys(this.seriesErrors).filter(key => !keep.has(key)).forEach(key => delete this.seriesErrors[key]);
  }

  // retry failed series
  retryTimeline() {
    this.seriesErrors = {};
    this.loadTimelineIfNeeded();
  }

  onTimelineInterval(interval: TimelineInterval) {
    this.timelineInterval = interval;
    this.loadTimelineIfNeeded();
  }

  onTimelineUnit(unit: TimelineUnit) {
    this.timelineUnit = unit;
    this.loadTimelineIfNeeded();
  }

  advancedText(advanced: AdvancedSearchState): string {
    return advancedSummary(advanced, {
      and: this.$t('advancedAnd') as string,
      or: this.$t('advancedOr') as string,
      not: this.$t('advancedNot') as string
    });
  }

  // entity name in the UI language
  displayName(names: { [key: string]: string | undefined }): string {
    const locale = this.$i18n.locale;
    return names[locale] || names.sl || names.de || Object.values(names).find(name => !!name) || '';
  }

  // save current search for comparison
  addSeries() {
    const color = nextSeriesColor(this.comparisonSeries);
    if (!color) return;

    const params = this.currentSearchParams ?? this.searchParams;
    const name = isAdvancedActive(params.advanced) ? this.advancedText(params.advanced) : seriesLabel({
      words: params.words || undefined,
      speaker: params.speaker ? this.displayName(params.speaker.names as any) : undefined,
      person: params.personEntity ? this.displayName(params.personEntity.names as any) : undefined,
      place: params.locationEntity ? this.displayName(params.locationEntity.names) : undefined,
      topics: params.capTopics.map(topic => capTopicLabel(topic.name, this.$i18n.locale))
    }, this.$t('timelineAllMeetings') as string);

    this.comparisonSeries = [...this.comparisonSeries, {name, color, query: this.timelineCurrentQuery}];
    this.loadTimelineIfNeeded();
  }

  // series are identified by color
  removeSeries(color: string) {
    this.comparisonSeries = this.comparisonSeries.filter(series => series.color !== color);
  }

  renameSeries(change: { color: string, name: string }) {
    const name = change.name.trim();
    if (!name) return;
    this.comparisonSeries = this.comparisonSeries.map(series => series.color === change.color ? {...series, name} : series);
  }

  // period selected on the timeline sets the date filter
  onTimelineSelect(range: { from: Date, to: Date }) {
    this.updateDateFrom(range.from);
    this.updateDateTo(range.to);
  }

  resetDateRange() {
    const bounds = corpusBounds(this.searchFilters.corpora);
    this.updateDateFrom(bounds.dateFrom);
    this.updateDateTo(bounds.dateTo);
  }

  // load map locations for the last search (only when the map tab is open)
  loadMapLocationsIfNeeded() {
    if (this.activeTab !== 'map' || !this.searchParamsInstance.searchOccurred || this.loading) {
      return;
    }

    // after the PDF view the query is unknown, build it again
    const query: string = this.lastSearchQuery
        ?? this.buildQueryParams({...this.searchParamsInstance, ...this.searchFiltersInstance});
    if (query === this.mapLoadedForQuery) {
      return;
    }

    this.mapLoadedForQuery = query;
    this.mapLoading = true;
    axios.get(process.env.VUE_APP_API_URL + '/meetings/getMapLocations' + query, {timeout: 60000})
        .then((response: any) => {
          // ignore old responses
          if (this.mapLoadedForQuery !== query) return;
          this.mapLocations = response.data.locations;
          this.mapTruncated = response.data.truncated;
        })
        .catch((error: any) => {
          console.error(error);
          if (this.mapLoadedForQuery === query) this.mapLoadedForQuery = null;
        })
        .finally(() => {
          if (this.mapLoadedForQuery === query || this.mapLoadedForQuery === null) this.mapLoading = false;
        });
  }

  /**
   * Builds query parameters for the search request.
   *
   * @param {Object} params - The search parameters.
   * @returns {string} The query parameters.
   */
  buildQueryParams(params: any): string {
    let queryParams = "";
    const advancedOpen = !!params.advanced?.enabled;
    for (const [key, value] of Object.entries(params)) {
      if (advancedOpen && CONTENT_PARAMS.includes(key)) continue;
      switch (key) {
        case "speaker": {

          const attendee = value as Attendee | undefined;
          if (attendee === undefined) continue;

          // speaker id
          queryParams += queryParams === "" ? "?" : "&";
          queryParams += "speaker=" + attendee.id;
          break;
        }
        case "personEntity": {
          const personEntity = value as PersonEntity | undefined;
          if (personEntity) {
            const names = Object.values(personEntity.names)
              .filter((n): n is string => !!n)
              .map(n => encodeURIComponent(n))
              .join(",");
            if (names) {
              queryParams += queryParams === "" ? "?" : "&";
              queryParams += `personEntities=${names}`;
            }
          }
          break;
        }
        case "locationEntity": {
          const locationEntity = value as Place | undefined;
          if (locationEntity) {
            const names = Object.values(locationEntity.names)
              .filter((n): n is string => !!n)
              .map(n => encodeURIComponent(n))
              .join(",");
            if (names) {
              queryParams += queryParams === "" ? "?" : "&";
              queryParams += `locationEntities=${names}`;
            }
          }
          break;
        }
        case "capTopics": {
          const topics = value as CapTopic[];
          topics.forEach(t => {
            queryParams += queryParams === "" ? "?" : "&";
            queryParams += `capTopics=${encodeURIComponent(t.name)}`;
          });
          break;
        }
        case "advanced": {
          const advanced = value as AdvancedSearchState | undefined;
          if (isAdvancedActive(advanced)) {
            queryParams += queryParams === "" ? "?" : "&";
            queryParams += "advanced=" + encodeURIComponent(advancedToApi(advanced!));
          }
          break;
        }
        case "words": {
          if (value) {
            queryParams += queryParams === "" ? "?" : "&";
            queryParams += "words=" + encodeURIComponent(value as string);
          }
          break;
        }
        default: {
          if (value !== "" && value !== undefined) {
            queryParams += queryParams === "" ? "?" : "&";
            queryParams += key + "=" + value;
          }
          break;
        }
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
      } else if (page === undefined) {
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
    this.$router.push({name: 'view-pdf', params: {meeting_id: meeting_id}})
  }

  getShowingResultsText() {
    let start = this.page * this.pageSize + 1;
    let end = Math.min(this.results.total, (this.page + 1) * this.pageSize);
    return `${this.$t('showingResults')} ${start} - ${end} ${this.$t('of')} ${this.results.total}`
  }
}
</script>
