<template>
  <div class="typeahead-container">
    <div class="input-wrapper" :class="{ focused: isFocused }" @click="focusInput">
      <span class="chip" v-for="topic in selectedTopics" :key="topic.id"
            @mousedown.prevent>
        {{ topic.name }}
        <i class="fa fa-xmark chip-remove" @click.stop="removeTopic(topic)"></i>
      </span>
      <input
          ref="inputRef"
          class="inline-input"
          type="text"
          v-model="searchText"
          @focus="showDropdown"
          @blur="onBlur"
          @input="dropdownVisible = true"
          @keyup.esc="dropdownVisible = false"
          @keydown.backspace="onBackspace"
          :placeholder="selectedTopics.length === 0 ? props.placeholder : ''"
      />
    </div>
    <div class="autocomplete-dropdown" v-show="dropdownVisible && visibleEntries.length > 0"
         @mousedown.prevent>
      <template v-for="entry in visibleEntries" :key="entry.main">
        <div class="autocomplete-item main-topic-item">
          <span class="expand-arrow" :class="{ expanded: expandedMains.has(entry.main) }" @click="toggleExpand(entry.main)">&#9654;</span>
          <strong class="main-topic-label" @click="toggleExpand(entry.main)">{{ entry.main }}</strong>
          <span class="add-main-btn" @click="selectMainTopic(entry.main)" title="Add whole topic">
            <i class="fa fa-plus"></i>
          </span>
        </div>
        <template v-if="expandedMains.has(entry.main)">
          <div
              v-for="sub in entry.subtopics"
              :key="sub.topic.id"
              class="autocomplete-item subtopic-item"
              @click="selectSubtopic(sub.topic)"
          >
            &middot; {{ sub.label }}
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.typeahead-container {
  position: relative;
  width: 100%;
}

.input-wrapper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.5rem;
  min-height: 2.4rem;
  background-color: transparent;
  border: none;
  border-bottom: 1px solid #1E1E24;
  border-radius: 0;
  cursor: text;
  transition: border-color 0.15s ease-in-out;
}

.input-wrapper.focused {
  border-bottom-color: #708D81;
}

.inline-input {
  flex: 1;
  min-width: 80px;
  border: none;
  outline: none;
  background: transparent;
  padding: 0.1rem 0;
  font-size: inherit;
  color: inherit;
}

.chip {
  display: inline-flex;
  align-items: center;
  background-color: #708D81;
  color: #f0f7ee;
  padding: 0.1rem 0.5rem;
  border-radius: 12px;
  font-size: 0.85em;
  white-space: nowrap;
}

.chip-remove {
  margin-left: 0.4rem;
  cursor: pointer;
  font-size: 0.8em;
}

.chip-remove:hover {
  color: #883636;
}

.autocomplete-dropdown {
  text-align: left;
  position: absolute;
  width: 100%;
  height: max-content;
  max-height: 30rem;
  overflow-y: scroll;
  background-color: #39393b;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  padding: 20px;
  color: #f0f7ee;
  z-index: 10;
}

.autocomplete-item {
  padding: 0.2rem 0.4rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.autocomplete-item:hover {
  background-color: #f0f7ee30;
  border-radius: 5px;
}

.main-topic-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.main-topic-label {
  flex: 1;
}

.add-main-btn {
  opacity: 0.4;
  font-size: 0.75em;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.add-main-btn:hover {
  opacity: 1;
  background-color: #708D81;
}

.expand-arrow {
  font-size: 0.6em;
  opacity: 0.6;
  transition: transform 0.2s ease;
  display: inline-block;
}

.expand-arrow.expanded {
  transform: rotate(90deg);
}

.subtopic-item {
  padding-left: 1.8rem;
  opacity: 0.9;
}
</style>

<script setup lang="ts">
import {computed, ref, reactive, watch} from 'vue';
import {useStore} from 'vuex';
import {CapTopic} from '@/types/CapTopic';

interface SubtopicEntry {
  label: string;
  topic: CapTopic;
}

interface MainTopicEntry {
  main: string;
  subtopics: SubtopicEntry[];
}

const props = defineProps<{
  allTopics: CapTopic[];
  placeholder: string;
}>();

const store = useStore();
const searchText = ref('');
const dropdownVisible = ref(false);
const isFocused = ref(false);
const expandedMains = reactive(new Set<string>());
const inputRef = ref<HTMLInputElement | null>(null);

const selectedTopics = computed<CapTopic[]>(
    () => store.getters['searchParamsModule/searchParamsInstance'].capTopics
);

const selectedIds = computed(
    () => new Set(selectedTopics.value.map(t => t.id))
);

const selectedMainTopics = computed(
    () => new Set(selectedTopics.value.filter(t => t.isMainOnly).map(t => t.mainTopic))
);

const uniqueMainTopics = computed(() =>
    [...new Set(props.allTopics.map(t => t.mainTopic))].sort((a, b) => a.localeCompare(b))
);

const visibleEntries = computed<MainTopicEntry[]>(() => {
  const text = searchText.value.trim().toLowerCase();
  const entries: MainTopicEntry[] = [];

  for (const main of uniqueMainTopics.value) {
    if (selectedMainTopics.value.has(main)) continue;
    if (text !== '' && !main.toLowerCase().includes(text)) continue;

    const subtopics: SubtopicEntry[] = [];
    for (const topic of props.allTopics) {
      if (topic.mainTopic !== main) continue;
      if (selectedIds.value.has(topic.id)) continue;

      subtopics.push({
        label: topic.name.split(':').slice(1).join(':').trim() || topic.name,
        topic: {...topic, isMainOnly: false}
      });
    }

    if (subtopics.length > 0) {
      subtopics.sort((a, b) => a.label.localeCompare(b.label));
      entries.push({main, subtopics});
    }
  }

  return entries;
});

// Auto-expand when only one main topic matches the search
watch(visibleEntries, (entries) => {
  if (searchText.value.trim() !== '' && entries.length === 1) {
    expandedMains.add(entries[0].main);
  }
});

function focusInput() {
  inputRef.value?.focus();
}

function toggleExpand(main: string) {
  expandedMains.has(main) ? expandedMains.delete(main) : expandedMains.add(main);
}

function selectMainTopic(main: string) {
  // Remove any previously selected subtopics of this main topic
  selectedTopics.value
      .filter(t => !t.isMainOnly && t.mainTopic === main)
      .forEach(t => store.commit('searchParamsModule/removeCapTopic', t));
  const topic: CapTopic = {id: 'main_' + main, name: main, mainTopic: main, isMainOnly: true};
  store.commit('searchParamsModule/addCapTopic', topic);
  expandedMains.delete(main);
  searchText.value = '';
}

function selectSubtopic(topic: CapTopic) {
  store.commit('searchParamsModule/addCapTopic', topic);
  searchText.value = '';
}

function removeTopic(topic: CapTopic) {
  store.commit('searchParamsModule/removeCapTopic', topic);
}

function onBackspace() {
  if (searchText.value === '' && selectedTopics.value.length > 0) {
    removeTopic(selectedTopics.value[selectedTopics.value.length - 1]);
  }
}

function showDropdown() {
  isFocused.value = true;
  searchText.value = '';
  dropdownVisible.value = true;
}

function onBlur() {
  isFocused.value = false;
  dropdownVisible.value = false;
  expandedMains.clear();
}
</script>
