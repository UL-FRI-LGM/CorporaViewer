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
      <!--   Speaker   -->
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
      <!--   Person entities   -->
      <div class="col-md-6">
        <div class="input-group search-bar-input">
          <Typeahead
              :placeholder="$t('selectPersonEntityPlaceholder')"
              :list="personEntitiesList"
              :displayFn="personEntityDisplayFn"
              :emptyItem="undefined"
              :getter="personEntityGetter"
              @selectedChange="setNewSelectedPersonEntity"
          />
        </div>
      </div>
      <!--   Location entities   -->
      <div class="col-md-6">
        <div class="input-group search-bar-input">
          <Typeahead
              :placeholder="$t('selectLocationEntityPlaceholder')"
              :list="locationEntitiesList"
              :displayFn="locationEntityDisplayFn"
              :emptyItem="undefined"
              :getter="locationEntityGetter"
              @selectedChange="setNewSelectedLocationEntity"
          />
        </div>
      </div>
      <!--   CAP Topics   -->
      <div class="col-md-6">
        <div class="input-group search-bar-input">
          <CapTopicMultiselect
              :allTopics="capTopicsList"
              :placeholder="$t('selectCapTopicPlaceholder')"
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
  margin: 0;
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
  margin: 0;
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
import CapTopicMultiselect from '@components/CapTopicMultiselect.vue';
import {Attendee} from '@/types/Attendee';
import {Place} from '@/types/Place';
import {PersonEntity} from '@/types/PersonEntity';
import {CapTopic} from '@/types/CapTopic';
import {Watch} from 'vue-property-decorator';
import {mapGetters, mapMutations} from 'vuex';
import i18n from '@/data/i18setup';
import {Filters} from '@/types/Filters';

@Options({
  components: {
    Typeahead,
    CapTopicMultiselect
  },
  computed: {
    ...mapGetters('searchParamsModule', ['searchParamsInstance']),
    ...mapGetters('searchFiltersModule', ['searchFiltersInstance'])
  },
  methods: {
    ...mapMutations('searchParamsModule', ['updateSearchWords', 'updateSearchSpeaker', 'updatePersonEntity', 'updateLocationEntity', 'resetCapTopics', 'resetSearchParams']),
    ...mapMutations('resultsModule', ['resetResults'])
  }
})

export default class SearchBar extends Vue {
  [x: string]: any;

  wordSearchQuery: string = ''
  speakersList: Attendee[] = []
  personEntitiesList: PersonEntity[] = []
  locationEntitiesList: Place[] = []
  capTopicsList: CapTopic[] = []

  get searchFilters(): Filters {
    return this.searchFiltersInstance
  }

  @Watch('$i18n.locale') onLocaleChanged() {
    this.sortSpeakersList();
  }

  @Watch('searchFilters.corpora') onCorporaChanged() {
    this.getSpeakersList();
  }

  created(): void {
    this.getSpeakersList();
    this.getPersonEntitiesList();
    this.getLocationEntitiesList();
    this.getCapTopicsList();
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

  setNewSelectedPersonEntity(entity: PersonEntity) {
    this.updatePersonEntity(entity);
  }

  setNewSelectedLocationEntity(entity: Place) {
    this.updateLocationEntity(entity);
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

  getSpeakersList() {
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
              const names = speaker._source.names;
              return {
                id: speaker._source.id,
                names: Array.isArray(names) ? names : Object.values(names)
              }
            }).sort((a: Attendee, b: Attendee) => {
              return this.compareSpeakers(a, b);
            })]
        })
        .catch(error => {
          console.log(error);
        });
  }

  compareSpeakers(a: Attendee, b: Attendee): number {
    const lastNameA = a.names[0].split(' ').pop() ?? "";
    const lastNameB = b.names[0].split(' ').pop() ?? "";
    return lastNameA.localeCompare(lastNameB);
  }

  sortSpeakersList() {
    this.speakersList.sort((a: Attendee, b: Attendee) => {
      return this.compareSpeakers(a, b);
    })
  }

  getPersonEntitiesList() {
    axios.get(process.env.VUE_APP_API_URL + '/personEntities/getAll')
        .then(response => {
          this.personEntitiesList = response.data.map((entity: any) => {
            return entity._source as PersonEntity;
          }).sort((a: PersonEntity, b: PersonEntity) => {
            return a.names.de.localeCompare(b.names.de);
          })
        })
        .catch(error => {
          console.log(error);
        });
  }

  getLocationEntitiesList() {
    axios.get(process.env.VUE_APP_API_URL + '/krajevnaImena/getAll')
        .then(response => {
          this.locationEntitiesList = response.data.map((entity: any) => {
            const corpusRaw = entity._source.corpus;
            return {
              ...entity._source,
              corpus: Array.isArray(corpusRaw) ? corpusRaw : [corpusRaw]
            } as Place;
          }).sort((a: Place, b: Place) => {
            return this.locationEntityDisplayFn(a).localeCompare(this.locationEntityDisplayFn(b));
          });
        })
        .catch(error => {
          console.log(error);
        });
  }

  getCapTopicsList() {
    axios.get(process.env.VUE_APP_API_URL + '/capTopics/getAll')
        .then(response => {
          this.capTopicsList = response.data.map((entity: any) => ({
            ...entity._source,
            mainTopic: entity._source.name.split(':')[0].trim(),
            isMainOnly: false
          })).sort((a: CapTopic, b: CapTopic) => {
            return a.name.localeCompare(b.name);
          })
        })
        .catch(error => {
          console.log(error);
        });
  }

  clear() {
    this.wordSearchQuery = '';

    this.resetSearchParams();
    this.resetResults();
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

}
</script>
