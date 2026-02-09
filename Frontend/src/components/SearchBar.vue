<template>
  <!-- a simple bootstrap search bar -->
  <div class="row">
    <div class="row col-md-11">
      <div class="input-group search-bar-input col-md-12">
        <input
            type="text"
            class="form-control input-field"
            :placeholder="$t('searchBarPlaceholder')"
            v-model="wordSearchQuery"
            @keyup.enter="search"
        />
      </div>
      <div class="col-md-6">
        <div class="input-group search-bar-input">
          <Typeahead
              :placeholder="$t('selectSpeakerPlaceholder')"
              :list="speakersList"
              :displayFn="speakerDisplayFn"
              :emptyItem="undefined"
              :getter="speakerGetter"
              @selectedChange="setNewSelectedSpeaker"
          />
        </div>
      </div>
      <div class="col-md-6">
        <div class="input-group search-bar-input">
          <Typeahead
              :placeholder="$t('selectPlacePlaceholder')"
              :list="placeNamesList"
              :displayFn="krajDisplayFn"
              :emptyItem="undefined"
              :getter="placeGetter"
              @selectedChange="setNewSelectedPlace"
          />
        </div>
      </div>
    </div>
    <div class="col-md-1 search-bar-button-container row">
      <button class="col-md-5 btn btn-default" type="button" @click="search">
        <i class="fa fa-search"></i>
      </button>
      <button class="col-md-5 btn btn-default btn-warn" type="button" @click="clear">
        <i class="fa fa-xmark"></i>
      </button>
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
  flex-direction: row;
  margin: 0px;
}

.row > * {
  padding: 5px;
}

.btn {
  padding: 0.5rem !important;
  margin: 0.5rem !important;
  width: 75% !important;
  height: fit-content !important;
}

.btn > i {
  height: auto;
}

@media (max-width: 768px) {
  .btn {
    width: fit-content !important;
    padding: 0.5rem 1.5rem !important;
  }
}

.btn-default :disabled {
  margin: 0px;
  background-color: #f7f6ee;
  border-color: #f0f7ee;
  color: #1e1e24;
}

.btn-warn {
  background-color: #883636 !important;
  color: #f0f7ee;
}
</style>

<script lang="ts">
import axios from 'axios';
import {Options, Vue} from 'vue-class-component';
import Typeahead from '@components/Typeahead.vue';
import {Attendee} from '@/types/Attendee';
import {Place} from '@/types/Place';
import {Watch} from 'vue-property-decorator';
import {mapGetters, mapMutations} from 'vuex';
import i18n from '@/data/i18setup';
import {Filters} from '@/types/Filters';

@Options({
  components: {
    Typeahead
  },
  computed: {
    ...mapGetters('searchParamsModule', ['searchParamsInstance']),
    ...mapGetters('searchFiltersModule', ['searchFiltersInstance'])
  },
  methods: {
    ...mapMutations('searchParamsModule', ['updateSearchWords', 'updateSearchSpeaker', 'updateSearchPlace', 'resetSearchParams']),
    ...mapMutations('resultsModule', ['resetResults'])
  }
})

export default class SearchBar extends Vue {
  [x: string]: any;

  wordSearchQuery: string = ''
  speakersList: Attendee[] = []
  placeNamesList: Place[] = []

  get searchFilters(): Filters {
    return this.searchFiltersInstance
  }

  @Watch('$i18n.locale') onLocaleChanged() {
    this.sortPlaceNamesList();
    this.sortSpeakersList();
  }

  @Watch('searchFilters.corpora') onCorporaChanged() {
    this.getSpeakersList();
    this.getplaceNamesList();
  }

  created(): void {
    this.getSpeakersList();
    this.getplaceNamesList();
  }

  mounted(): void {
    this.wordSearchQuery = this.searchParamsInstance.words;
  }

  search() {
    this.updateSearchWords(this.wordSearchQuery);
    this.$emit('newsearch');
  }

  setNewSelectedSpeaker(speaker: Attendee) {
    this.updateSearchSpeaker(speaker);
  }

  setNewSelectedPlace(place: Place) {
    this.updateSearchPlace(place);
  }

  krajDisplayFn(kraj: Place): string {
    const locale = this.$i18n.locale;
    let placeString = (kraj.names[locale] === "zzzzz" ? "" : kraj.names[locale]) ?? "";

    //append each key-value pair to the string
    for (const [key, value] of Object.entries(kraj.names)) {
      if (key != locale && value != "zzzzz") {
        placeString += (placeString === "" ? "" : " / ") + value;
      }
    }

    return placeString
  }

  speakerDisplayFn(speaker: Attendee): string {
    return speaker.names.join(' / ');
  }

  getSpeakersList() {
    const corpora = this.searchFilters.corpora;
    axios.get(process.env.VUE_APP_API_URL + '/poslanci/getAll')
        .then(response => {
          this.speakersList = [{
            id: "1",
            names: [i18n.global.t('dezelniGlavar')]
          },
            {
              id: "2",
              names: [i18n.global.t('porocevalec')]
            },
            {
              id: "3",
              names: [i18n.global.t('predsednik')]
            },
            ...response.data.map((speaker: any) => {
              return {
                id: speaker._source.id,
                names: speaker._source.names
              }
            }).sort((a: Attendee, b: Attendee) => {
              return this.compareSpeakers(a, b);
            })]
        })
        .catch(error => {
          console.log(error);
        });
  }

  getplaceNamesList() {
    const corpora = this.searchFilters.corpora;
    axios.get(process.env.VUE_APP_API_URL + '/krajevnaImena/getAll')
        .then(response => {
          this.placeNamesList = response.data
              .filter((place: any) => {
                const placeCorpora = new Set(place._source.corpus.map((corpus: string) => corpus.toLowerCase()));
                return corpora.length == 0 || corpora.some(corpora => placeCorpora.has(corpora.toLowerCase()));
              }).map((place: any) => {
                return place._source as Place;
              }).sort((a: Place, b: Place) => {
                return this.comparePlaceNames(a, b);
              })
        })
        .catch(error => {
          console.log(error);
        });
  }

  comparePlaceNames(a: Place, b: Place): number {
    // first compare the locale, then compare the other locales if the first one is the same
    const locale = this.$i18n.locale;
    const placeNameA = this.getFirstValidPlaceName(a, locale);
    const placeNameB = this.getFirstValidPlaceName(b, locale);
    return placeNameA.localeCompare(placeNameB);
  }

  getFirstValidPlaceName(place: Place, preferedLocale: string): string {
    if (Object.keys(place.names).includes(preferedLocale) && place.names[preferedLocale] !== "zzzzz") {
      return place.names[preferedLocale];
    } else {
      for (const [key, value] of Object.entries(place.names)) {
        if (value != "zzzzz") {
          return value;
        }
      }
      return "zzzzz";
    }
  }

  compareSpeakers(a: Attendee, b: Attendee): number {
    const lastNameA = a.names[0].split(' ').pop() ?? "";
    const lastNameB = b.names[0].split(' ').pop() ?? "";
    return lastNameA.localeCompare(lastNameB);
  }

  sortPlaceNamesList() {
    this.placeNamesList.sort((a: Place, b: Place) => {
      return this.comparePlaceNames(a, b);
    })
  }

  sortSpeakersList() {
    this.speakersList.sort((a: Attendee, b: Attendee) => {
      return this.compareSpeakers(a, b);
    })
  }

  clear() {
    this.wordSearchQuery = '';

    this.resetSearchParams();
    this.resetResults();
  }

  speakerGetter(): Attendee {
    return this.searchParamsInstance.speaker;
  }

  placeGetter(): Place {
    return this.searchParamsInstance.place;
  }
}
</script>
