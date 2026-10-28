<template>
  <div class="advanced-search" :class="{open}">
    <button type="button" class="advanced-toggle" :aria-expanded="open" @click="setEnabled(!open)">
      <i class="fa" :class="open ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
      {{ $t('advancedSearch') }}
      <span class="active-badge" v-if="active">{{ $t('advancedActive') }}</span>
    </button>

    <div class="advanced-body" v-if="open">
      <div class="advanced-options">
        <label class="level-select">
          {{ $t('advancedLevel') }}
          <select class="form-select form-select-sm" :value="advanced.level"
                  @change="setLevel(($event.target as HTMLSelectElement).value as AdvancedLevel)">
            <option value="meeting">{{ $t('advancedLevel_meeting') }}</option>
            <option value="segment">{{ $t('advancedLevel_segment') }}</option>
            <option value="sentence">{{ $t('advancedLevel_sentence') }}</option>
          </select>
        </label>
        <span class="level-hint">{{ $t('advancedLevelHint_' + advanced.level) }}</span>
      </div>

      <p class="advanced-note">{{ $t('advancedReplacesFilters') }}</p>
      <p class="advanced-note" v-if="listsError">{{ $t('advancedListsFailed') }}</p>

      <AdvancedGroupEditor :group="advanced.root" :lists="lists" :depth="0" :removable="false"/>
    </div>
  </div>
</template>

<style scoped>
.advanced-search {
  text-align: left;
  margin: 0.5rem 0;
}

.advanced-toggle {
  border: none;
  background: transparent;
  color: #1e1e24;
  font-weight: 600;
  padding: 0.2rem 0;
  cursor: pointer;
}

.advanced-toggle:focus-visible {
  outline: 3px solid #1e1e24;
  outline-offset: 2px;
}

.active-badge {
  margin-left: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #f0f7ee;
  background-color: #708d81;
  border-radius: 8px;
  padding: 0.05rem 0.5rem;
}

.advanced-body {
  border: 2px solid #708d81;
  border-radius: 10px;
  padding: 0.75rem;
  margin-top: 0.4rem;
  background-color: #f0f7ee;
}

.advanced-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.level-select {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.level-select select {
  width: auto;
}

.level-hint,
.advanced-note {
  font-size: 0.85rem;
  color: #4a6b5e;
}

.advanced-note {
  margin: 0 0 0.5rem 0;
}
</style>

<script setup lang="ts">
import {computed, reactive, ref, watch} from 'vue';
import {useStore} from 'vuex';
import AdvancedGroupEditor from '@components/AdvancedGroupEditor.vue';
import {isAdvancedActive} from '@/data/advancedQuery';
import {fetchPersons, fetchSpeakers, fetchTopics} from '@/data/filterLists';
import {fetchPlaces} from '@/data/places';
import {AdvancedLevel, AdvancedLists, AdvancedSearch} from '@/types/AdvancedQuery';

const store = useStore();

const advanced = computed<AdvancedSearch>(() => store.getters['searchParamsModule/searchParamsInstance'].advanced);
const active = computed(() => isAdvancedActive(advanced.value));

// advanced search is on while the panel is open
const open = computed(() => advanced.value.enabled);

const lists = reactive<AdvancedLists>({speakers: [], persons: [], places: [], topics: []});
const listsError = ref(false);
let listsRequested = false;

function loadLists() {
  if (listsRequested) return;
  listsRequested = true;
  Promise.all([fetchSpeakers(), fetchPersons(), fetchPlaces(), fetchTopics()])
      .then(([speakers, persons, places, topics]) => {
        lists.speakers = speakers;
        lists.persons = persons;
        lists.places = places;
        lists.topics = topics;
      })
      .catch(error => {
        console.error(error);
        listsError.value = true;
        listsRequested = false;
      });
}

watch(open, isOpen => {
  if (isOpen) loadLists();
}, {immediate: true});

function setEnabled(enabled: boolean) {
  store.commit('searchParamsModule/updateAdvanced', {...advanced.value, enabled});
}

function setLevel(level: AdvancedLevel) {
  store.commit('searchParamsModule/updateAdvanced', {...advanced.value, level});
}
</script>
