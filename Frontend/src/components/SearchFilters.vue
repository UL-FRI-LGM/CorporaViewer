<template>
  <div class="filter-outline" v-if="searchFilters != null">
    <div class="filter-label">
      <h4>{{ $t('date') }}</h4>
    </div>
    <div class="filter-content">
      <div class="row">
        <div class="col-2">
          <label>{{ $t('dateFrom') }}</label>
        </div>
        <div class="col-10">
          <vue-date-picker v-model="searchFilters.dateFrom" :enable-time-picker="false"
                           :format="format" input-class-name="input-field" @update:model-value="handleDateFromChange"
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
      </div>
      <div class="row">
        <div class="col-2">
          <label>{{ $t('dateTo') }}</label>
        </div>
        <div class="col-10">
          <vue-date-picker v-model="searchFilters.dateTo" :enable-time-picker="false"
                           :format="format" input-class-name="input-field" @update:model-value="handleDateToChange"
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
      </div>
    </div>
  </div>
  <div class="filter-outline">
    <div class="filter-label">
      <h4>{{ $t('language') }}</h4>
    </div>
    <div class="filter-content">
      <div v-for="lang in allLanguages" class="row">
        <div class="col-2">
          <input class="form-check-input checkbox" :value="lang" type="checkbox" v-model="searchFilters.languages"
                 :disabled="enabledLanguages[lang] != true">
        </div>
        <div class="col-10 text-left">
          <label class="form-check-label">{{ $t(lang) }}</label>
        </div>
      </div>
    </div>
  </div>
  <div class="filter-outline">
    <div class="filter-label">
      <h4>{{ $t('corpus') }}</h4>
    </div>
    <div class="filter-content">
      <div v-for="corp in corpora" class="row">
        <div class="col-2">
          <input class="form-check-input checkbox" :value="corp.name" type="checkbox" v-model="searchFilters.corpora">
        </div>
        <div class="col-10 text-left">
          <label class="form-check-label">{{ $t(corp.name) }}</label>
        </div>
      </div>
    </div>
  </div>
  <div class="filter-outline">
    <div class="filter-label">
      <h4>{{ $t('sort') }}</h4>
    </div>
    <div class="filter-content">
      <select class="form-select input-field" v-model="searchFilters.sort">
        <option value="relevance">{{ $t('sortByRelevance') }}</option>
        <option value="date_asc">{{ $t('sortByDateAsc') }}</option>
        <option value="date_desc">{{ $t('sortByDateDesc') }}</option>
      </select>
    </div>
  </div>
</template>

<style>
.filter-content {
  background-color: #F0F7EE;
  border-radius: 0px 0px 5px 5px;
  padding: 10px;
  color: #1E1E24;
  margin-top: 0px;
}

.input-field:hover, .form-check-input:hover {
  cursor: pointer;
}

.filter-label {
  display: flex;
  padding-left: 1.2rem;
  padding-top: 0.6rem;
  color: #F0F7EE;
}

.filter-outline {
  border: #F0F7EE 2px solid;
  border-radius: 10px;
  margin-bottom: 10px;
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

@Options({
  computed: {
    ...mapGetters('searchFiltersModule', ['searchFiltersInstance'])
  },
  methods: {
    ...mapMutations('searchFiltersModule', ['updateDateFrom', 'updateDateTo', 'updateLanguages', 'updateCorpora'])
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

  created(): void {
    this.initCorporaAndFilters()
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

    // Update enabled languages for checkboxes
    this.enabledLanguages = {};
    this.allLanguages.forEach(language => {
      this.enabledLanguages[language] = this.searchFilters.languages.includes(language);
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
