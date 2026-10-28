<template>
  <div class="filters-panel" v-if="searchFilters != null">
    <!-- hidden when advanced search is open -->
    <section class="filter-section" v-show="!searchParamsInstance.advanced.enabled">
      <h6 class="filter-title">{{ $t('filterContent') }}</h6>

      <div class="field">
        <div class="field-label">{{ $t('speaker') }}</div>
        <Typeahead
            :placeholder="$t('selectSpeakerPlaceholder')"
            :list="speakersList"
            :displayFn="speakerDisplayFn"
            :emptyItem="undefined"
            :getter="speakerGetter"
            @selectedChange="updateSearchSpeaker"
        />
      </div>
      <div class="field">
        <div class="field-label">{{ $t('personEntity') }}</div>
        <Typeahead
            :placeholder="$t('selectPersonEntityPlaceholder')"
            :list="personEntitiesList"
            :displayFn="personEntityDisplayFn"
            :emptyItem="undefined"
            :getter="personEntityGetter"
            @selectedChange="updatePersonEntity"
        />
      </div>
      <div class="field">
        <div class="field-label">{{ $t('locationEntity') }}</div>
        <Typeahead
            :placeholder="$t('selectLocationEntityPlaceholder')"
            :list="locationEntitiesList"
            :displayFn="locationEntityDisplayFn"
            :emptyItem="undefined"
            :getter="locationEntityGetter"
            @selectedChange="updateLocationEntity"
        />
      </div>
      <div class="field">
        <div class="field-label">{{ $t('capTopic') }}</div>
        <CapTopicMultiselect
            :allTopics="capTopicsList"
            :placeholder="$t('selectCapTopicPlaceholder')"
        />
      </div>
    </section>

    <section class="filter-section">
      <h6 class="filter-title">{{ $t('filterSource') }}</h6>

      <div class="field-label">{{ $t('date') }}</div>
      <div class="date-row">
        <label class="date-label">{{ $t('dateFrom') }}</label>
        <vue-date-picker v-model="searchFilters.dateFrom" :enable-time-picker="false"
                         :format="format" input-class-name="input-field compact-input"
                         @update:model-value="handleDateFromChange"
                         :min-date="minDate" :max-date="searchFilters.dateTo" :year-range="yearRangeFrom"
                         auto-apply
        >
          <template class="reset-icon" #clear-icon>
            <i class="fa fa-rotate-left"
               :class="{ 'reset-icon-enabled': minDate !== null && !compareDates(minDate, searchFilters.dateFrom) }"
               @click.stop="setDefaultFrom"></i>
          </template>
        </vue-date-picker>
      </div>
      <div class="date-row">
        <label class="date-label">{{ $t('dateTo') }}</label>
        <vue-date-picker v-model="searchFilters.dateTo" :enable-time-picker="false"
                         :format="format" input-class-name="input-field compact-input"
                         @update:model-value="handleDateToChange"
                         :min-date="searchFilters.dateFrom" :max-date="maxDate" :year-range="yearRangeTo"
                         auto-apply
        >
          <template #clear-icon>
            <i class="fa fa-rotate-left"
               :class="{ 'reset-icon-enabled': maxDate !== null && !compareDates(maxDate, searchFilters.dateTo) }"
               @click.stop="setDefaultTo"></i>
          </template>
        </vue-date-picker>
      </div>

      <div class="field-label">{{ $t('corpus') }}</div>
      <div class="chip-group">
        <label v-for="corp in corpora" :key="corp.name" class="chip"
               :class="{ active: searchFilters.corpora.includes(corp.name) }">
          <input class="chip-input" :value="corp.name" type="checkbox" v-model="searchFilters.corpora">
          {{ $t(corp.name) }}
        </label>
      </div>

      <div class="field-label">{{ $t('language') }}</div>
      <div class="chip-group">
        <label v-for="lang in allLanguages" :key="lang" class="chip"
               :class="{ active: searchFilters.languages.includes(lang), disabled: enabledLanguages[lang] != true }">
          <input class="chip-input" :value="lang" type="checkbox" v-model="searchFilters.languages"
                 :disabled="enabledLanguages[lang] != true">
          {{ $t(lang) }}
        </label>
      </div>
    </section>
  </div>
</template>

<style>
.filters-panel {
  background-color: #F0F7EE;
  border-radius: 10px;
  padding: 0.25rem 0.75rem;
  color: #1E1E24;
  font-size: 0.85rem;
}

.filter-section {
  padding: 0.6rem 0;
  border-bottom: 1px solid rgba(112, 141, 129, 0.35);
}

.filter-section:last-child {
  border-bottom: none;
}

.filter-title {
  margin: 0 0 0.4rem 0;
  font-weight: 700;
  text-align: left;
}

.field {
  margin-bottom: 0.6rem;
  text-align: left;
}

.field-label {
  text-align: left;
  font-weight: 600;
  margin: 0.4rem 0 0.2rem 0;
}

.date-row {
  display: grid;
  grid-template-columns: 2rem 1fr;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.35rem;
}

.date-label {
  padding-top: 0;
}

.compact-input {
  font-size: 0.85rem;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border: 2px solid #708D81;
  border-radius: 10px;
  color: #1E1E24;
  cursor: pointer;
  user-select: none;
  line-height: 1.3;
}

.chip:hover {
  border-color: #1E1E24;
}

.chip.active {
  background-color: #708D81;
  color: #F0F7EE;
}

.chip.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chip.disabled:hover {
  border-color: #708D81;
}

/* visually hidden checkbox */
.chip-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.chip:has(.chip-input:focus-visible) {
  outline: 3px solid #1E1E24;
  outline-offset: 2px;
}

.input-field:hover, .form-check-input:hover {
  cursor: pointer;
}

.row {
  margin: 10px 0px 10px 0px;
}

.text-left {
  text-align: left !important;
}

label {
  padding-top: 0.5rem;
}

.reset-icon-enabled {
  cursor: pointer;
  color: #708d81 !important;
}
</style>

<script lang="ts">
import {Options, Vue} from 'vue-class-component';
import {Watch} from 'vue-property-decorator';
import {corporaList} from '../data/corporaInfo';
import {Corpus} from '@/types/Corpus';
import {mapGetters, mapMutations} from 'vuex';
import {Filters} from '@/types/Filters';
import axios from 'axios';
import Typeahead from '@components/Typeahead.vue';
import CapTopicMultiselect from '@components/CapTopicMultiselect.vue';
import {Attendee} from '@/types/Attendee';
import {Place} from '@/types/Place';
import {PersonEntity} from '@/types/PersonEntity';
import {CapTopic} from '@/types/CapTopic';
import {placeKey, queryToState} from '@/data/searchState';
import {fetchPlaces} from '@/data/places';
import {fetchCapTopics} from '@/data/capTopics';

@Options({
  components: {
    Typeahead,
    CapTopicMultiselect
  },
  emits: ['ready'],
  computed: {
    ...mapGetters('searchFiltersModule', ['searchFiltersInstance']),
    ...mapGetters('searchParamsModule', ['searchParamsInstance'])
  },
  methods: {
    ...mapMutations('searchFiltersModule', ['updateDateFrom', 'updateDateTo', 'updateLanguages', 'updateCorpora']),
    ...mapMutations('searchParamsModule', ['updateSearchSpeaker', 'updatePersonEntity', 'updateLocationEntity', 'addCapTopic'])
  }
})

export default class SearchFilters extends Vue {
  [x: string]: any;

  get searchFilters(): Filters {
    return this.searchFiltersInstance
  }

  minDate: Date | null = null;
  maxDate: Date | null = null;

  currentYear: string = new Date().getFullYear().toString();

  yearRangeFrom: string[] = [this.currentYear, this.currentYear];
  yearRangeTo: string[] = [this.currentYear, this.currentYear];

  enabledLanguages!: any;
  allLanguages: Set<string> = new Set<string>();
  corpora!: Corpus[];
  previousCorpora: string[] = [];

  format: string = 'dd.MM.yyyy';

  @Watch('searchFilters.corpora') onCorporaChanged() {
    // this code prevents corpora from loading twice when the component is created and therefore overwriting saved languages
    if (!this.previousCorpora.every((value, index) => value === this.searchFilters.corpora[index]) || !this.searchFilters.corpora.every((value, index) => value === this.previousCorpora[index])) {
      this.updateFiltersOnCorporaChanged()
    }
    this.previousCorpora = Array.from(this.searchFilters.corpora)
  }

  speakersList: Attendee[] = [];
  personEntitiesList: PersonEntity[] = [];
  locationEntitiesList: Place[] = [];
  capTopicsList: CapTopic[] = [];

  created(): void {
    this.initCorporaAndFilters()

    // lists are needed to restore the search from the URL
    Promise.allSettled([
      this.getSpeakersList(),
      this.getPersonEntitiesList(),
      this.getLocationEntitiesList(),
      this.getCapTopicsList()
    ]).then(() => {
      this.applyEntitiesFromUrl();
      this.$emit('ready');
    });
  }

  speakerGetter(): Attendee {
    return this.searchParamsInstance.speaker;
  }

  personEntityGetter(): PersonEntity {
    return this.searchParamsInstance.personEntity;
  }

  locationEntityGetter(): Place {
    return this.searchParamsInstance.locationEntity;
  }

  speakerDisplayFn(speaker: Attendee): string {
    return speaker.names.join(' / ');
  }

  personEntityDisplayFn(entity: PersonEntity): string {
    const locale = this.$i18n.locale;
    if (locale === 'sl' && entity.names.sl) {
      return entity.names.sl + (entity.names.de && entity.names.de !== entity.names.sl ? ' / ' + entity.names.de : '');
    }
    return entity.names.de + (entity.names.sl && entity.names.sl !== entity.names.de ? ' / ' + entity.names.sl : '');
  }

  locationEntityDisplayFn(entity: Place): string {
    const locale = this.$i18n.locale;
    const sl = entity.names.sl || '';
    const de = entity.names.de || '';
    if (locale === 'sl' && sl) {
      return sl + (de && de !== sl ? ' / ' + de : '');
    }
    return (de || sl) + (de && sl && sl !== de ? ' / ' + sl : '');
  }

  compareSpeakers(a: Attendee, b: Attendee): number {
    const lastNameA = a.names[0].split(' ').pop() ?? "";
    const lastNameB = b.names[0].split(' ').pop() ?? "";
    return lastNameA.localeCompare(lastNameB);
  }

  getSpeakersList() {
    return axios.get(process.env.VUE_APP_API_URL + '/poslanci/getAll')
        .then(response => {
          this.speakersList = response.data.map((speaker: any) => {
            const names = speaker._source.names;
            return {
              id: speaker._source.id,
              // show sl and de name (only once if they are the same)
              names: Array.from(new Set<string>(Array.isArray(names) ? names : Object.values(names)))
            }
          }).sort((a: Attendee, b: Attendee) => this.compareSpeakers(a, b));
        })
        .catch(error => console.log(error));
  }

  getPersonEntitiesList() {
    return axios.get(process.env.VUE_APP_API_URL + '/personEntities/getAll')
        .then(response => {
          this.personEntitiesList = response.data
              .map((entity: any) => entity._source as PersonEntity)
              .sort((a: PersonEntity, b: PersonEntity) => a.names.de.localeCompare(b.names.de));
        })
        .catch(error => console.log(error));
  }

  getLocationEntitiesList() {
    return fetchPlaces()
        .then(places => {
          this.locationEntitiesList = [...places].sort((a: Place, b: Place) => {
            return this.locationEntityDisplayFn(a).localeCompare(this.locationEntityDisplayFn(b));
          });
        })
        .catch(error => console.log(error));
  }

  getCapTopicsList() {
    return fetchCapTopics()
        .then(topics => {
          this.capTopicsList = topics.map(topic => ({
            ...topic,
            id: String(topic.id),
            mainTopic: topic.name.split(':')[0].trim(),
            isMainOnly: false
          })).sort((a: CapTopic, b: CapTopic) => a.name.localeCompare(b.name));
        })
        .catch(error => console.log(error));
  }

  // restore entity filters from the URL (only on first page load)
  applyEntitiesFromUrl() {
    if (this.searchParamsInstance.searchOccurred) return;

    const state = queryToState(this.$route.query);
    if (state.speakerId) {
      this.updateSearchSpeaker(this.speakersList.find((s: Attendee) => s.id === state.speakerId));
    }
    if (state.personId) {
      this.updatePersonEntity(this.personEntitiesList.find((p: PersonEntity) => p.id === state.personId));
    }
    if (state.locationName) {
      this.updateLocationEntity(this.locationEntitiesList.find((p: Place) => placeKey(p.names) === state.locationName));
    }
    for (const name of state.topics) {
      if (name.includes(':')) {
        const topic = this.capTopicsList.find((t: CapTopic) => t.name === name);
        if (topic) this.addCapTopic(topic);
      } else if (this.capTopicsList.some((t: CapTopic) => t.mainTopic === name)) {
        this.addCapTopic({id: 'main_' + name, name: name, mainTopic: name, isMainOnly: true});
      }
    }
  }

  compareDates(date1: Date, date2: Date) {
    return date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear()
  }

  handleDateFromChange(modelData: Date) {
    this.yearRangeTo = [
      modelData.getFullYear().toString(),
      this.maxDate ? this.maxDate.getFullYear().toString() : this.currentYear
    ]
    this.updateDateFrom(modelData || this.minDate);
  }

  setDefaultFrom() {
    this.yearRangeTo = [
      this.minDate ? this.minDate.getFullYear().toString() : this.currentYear,
      this.maxDate ? this.maxDate.getFullYear().toString() : this.currentYear
    ]
    this.updateDateFrom(this.minDate || new Date());
  }

  handleDateToChange(modelData: Date) {
    this.yearRangeFrom = [
      this.minDate ? this.minDate.getFullYear().toString() : this.currentYear,
      modelData.getFullYear().toString()
    ]
    this.updateDateTo(modelData || this.maxDate);
  }

  setDefaultTo() {
    this.yearRangeFrom = [
      this.minDate ? this.minDate.getFullYear().toString() : this.currentYear,
      this.maxDate ? this.maxDate.getFullYear().toString() : this.currentYear
    ]
    this.updateDateTo(this.maxDate || new Date());
  }

  initCorporaAndFilters() {
    this.corpora = corporaList;

    // Compute global bounds for all corpora
    let minDateFrom: Date | null = null;
    let maxDateTo: Date | null = null;
    let allLanguages = new Set<string>();
    let allCorpora = new Set<string>();

    this.corpora.forEach(corpus => {
      if (minDateFrom == null || corpus.dateFrom < minDateFrom) {
        minDateFrom = corpus.dateFrom;
      }
      if (maxDateTo == null || corpus.dateTo > maxDateTo) {
        maxDateTo = corpus.dateTo;
      }
      corpus.languages.forEach(language => {
        allLanguages.add(language);
        this.allLanguages.add(language);
      });
      allCorpora.add(corpus.name);
    });

    // Only set defaults if we're initializing for the first time
    if (this.searchFilters.initializing) {
      this.applyFilterValues(minDateFrom, maxDateTo, Array.from(allLanguages), true);
      this.updateCorpora(Array.from(allCorpora));
      this.searchFilters.sort = "relevance";
    }

    // Sync previousCorpora so the watcher works correctly
    this.previousCorpora = Array.from(this.searchFilters.corpora);

    // Always recompute min/max ranges for the date picker UI
    this.minDate = minDateFrom!;
    this.maxDate = maxDateTo!;
    this.yearRangeFrom = [this.minDate.getFullYear().toString(), this.maxDate.getFullYear().toString()];
    this.yearRangeTo = [this.minDate.getFullYear().toString(), this.maxDate.getFullYear().toString()];

    // languages of the selected corpora
    const availableLanguages = new Set<string>();
    this.corpora.forEach(corpus => {
      if (this.searchFilters.corpora.includes(corpus.name)) corpus.languages.forEach(language => availableLanguages.add(language));
    });
    this.enabledLanguages = {};
    this.allLanguages.forEach(language => {
      this.enabledLanguages[language] = availableLanguages.has(language);
    });

    this.searchFilters.initializing = false;
  }

  updateFiltersOnCorporaChanged() {
    let minDateFrom: Date | null = null
    let maxDateTo: Date | null = null
    let languages = new Set<string>()

    this.corpora.forEach(corpus => {
      if (this.searchFilters.corpora.includes(corpus.name)) {
        if (minDateFrom == null || corpus.dateFrom < minDateFrom) minDateFrom = corpus.dateFrom
        if (maxDateTo == null || corpus.dateTo > maxDateTo) maxDateTo = corpus.dateTo
        corpus.languages.forEach(language => languages.add(language))
      }
    })

    // Force reset to new full range
    this.searchFilters.dateFrom = minDateFrom!
    this.searchFilters.dateTo = maxDateTo!

    this.applyFilterValues(minDateFrom, maxDateTo, Array.from(languages), true)
  }

  applyFilterValues(
      minDate: Date | null,
      maxDate: Date | null,
      languages: string[],
      loadLanguages: boolean = false
  ) {
    this.searchFilters.initializing = false

    this.minDate = minDate == null ? new Date() : minDate
    this.maxDate = maxDate == null ? new Date() : maxDate

    console.log(languages, this.minDate, this.maxDate)

    this.yearRangeFrom = [this.minDate.getFullYear().toString(), this.maxDate.getFullYear().toString()]
    this.yearRangeTo = [this.minDate.getFullYear().toString(), this.maxDate.getFullYear().toString()]


    if (!(this.searchFilters.dateFrom >= this.minDate && this.searchFilters.dateFrom <= this.maxDate)) {
      this.setDefaultFrom()
    }

    if (!(this.searchFilters.dateTo >= this.minDate && this.searchFilters.dateTo <= this.maxDate)) {
      this.setDefaultTo()
    }

    if (loadLanguages) {
      this.updateLanguages(languages);
    }

    this.enabledLanguages = {}
    this.allLanguages.forEach(language => {
      this.enabledLanguages[language] = languages.includes(language)
    })
  }
}
</script>
