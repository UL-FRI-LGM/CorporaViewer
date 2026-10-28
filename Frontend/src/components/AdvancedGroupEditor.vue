<template>
  <div class="adv-group" :class="{negated: group.not, nested: depth > 0}">
    <div class="adv-group-head">
      <button type="button" class="not-toggle" :class="{active: group.not}" :aria-pressed="group.not"
              :title="$t('advancedNotGroupHint')" @click="toggleNot(group)">{{ $t('advancedNot') }}
      </button>
      <div class="op-toggle" role="group" :aria-label="$t('advancedOperator')">
        <button type="button" :class="{active: group.operator === 'AND'}" :aria-pressed="group.operator === 'AND'"
                @click="setOperator(group, 'AND')">{{ $t('advancedAnd') }}
        </button>
        <button type="button" :class="{active: group.operator === 'OR'}" :aria-pressed="group.operator === 'OR'"
                @click="setOperator(group, 'OR')">{{ $t('advancedOr') }}
        </button>
      </div>
      <span class="op-hint">{{ group.operator === 'AND' ? $t('advancedAndHint') : $t('advancedOrHint') }}</span>

      <span class="head-actions">
        <button type="button" class="adv-button" @click="addChild(group, newCondition())">
          <i class="fa fa-plus"></i> {{ $t('advancedAddCondition') }}
        </button>
        <button type="button" class="adv-button" v-if="depth < MAX_DEPTH" @click="addChild(group, newGroup(group.operator === 'AND' ? 'OR' : 'AND'))">
          <i class="fa fa-plus"></i> {{ $t('advancedAddGroup') }}
        </button>
        <button type="button" class="adv-remove" v-if="removable" :title="$t('advancedRemoveGroup')"
                :aria-label="$t('advancedRemoveGroup')" @click="emit('remove')">
          <i class="fa fa-xmark"></i>
        </button>
      </span>
    </div>

    <div class="adv-children">
      <template v-for="(child, index) in group.children" :key="child.id">
        <div class="op-between" v-if="index > 0">{{ group.operator === 'AND' ? $t('advancedAnd') : $t('advancedOr') }}</div>

        <AdvancedGroupEditor v-if="child.type === 'group'" :group="child" :lists="lists" :depth="depth + 1"
                             :removable="true" @remove="removeChild(group, child.id)"/>

        <div v-else class="adv-condition" :class="{negated: child.not}">
          <button type="button" class="not-toggle" :class="{active: child.not}" :aria-pressed="child.not"
                  :title="$t('advancedNotHint')" @click="toggleNot(child)">{{ $t('advancedNot') }}
          </button>

          <select class="form-select form-select-sm field-select" :value="child.field" :aria-label="$t('advancedField')"
                  @change="setField(child, ($event.target as HTMLSelectElement).value as AdvancedField)">
            <option v-for="field in FIELDS" :key="field" :value="field">{{ $t(FIELD_LABELS[field]) }}</option>
          </select>

          <div class="value-picker">
            <input v-if="child.field === 'words'" class="form-control form-control-sm" type="text"
                   :value="child.values[0] ?? ''" :placeholder="$t('advancedWordsPlaceholder')"
                   :aria-label="$t('advancedField_words')"
                   @change="onWords(child, ($event.target as HTMLInputElement).value)"/>
            <CapTopicMultiselect v-else-if="child.field === 'topic'"
                                 :allTopics="lists.topics"
                                 :placeholder="$t('advancedPickValue')"
                                 :modelValue="selectedTopics(child)"
                                 @update:modelValue="(topics: CapTopic[]) => onTopics(child, topics)"/>
            <Typeahead v-else :key="child.id + child.field"
                       :placeholder="$t('advancedPickValue')"
                       :list="listFor(child.field)"
                       :displayFn="displayFor(child.field)"
                       :emptyItem="undefined"
                       :getter="() => selectedItem(child)"
                       @selectedChange="(item: any) => onPick(child, item)"/>
          </div>

          <button type="button" class="adv-remove" :title="$t('advancedRemoveCondition')"
                  :aria-label="$t('advancedRemoveCondition')" @click="removeChild(group, child.id)">
            <i class="fa fa-xmark"></i>
          </button>
        </div>
      </template>
      <div class="adv-empty" v-if="group.children.length === 0">{{ $t('advancedEmptyGroup') }}</div>
    </div>
  </div>
</template>

<style scoped>
.adv-group {
  border: 1px solid #c9d8cf;
  border-radius: 10px;
  padding: 0.5rem 0.6rem;
  background-color: #ffffff;
}

.adv-group.nested {
  background-color: #f7fbf5;
  border-left: 4px solid #708d81;
}

.adv-group.negated,
.adv-condition.negated {
  border-color: #883636;
}

.adv-group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.head-actions {
  display: inline-flex;
  gap: 0.4rem;
  margin-left: auto;
}

.op-toggle {
  display: inline-flex;
  border: 2px solid #708d81;
  border-radius: 8px;
  overflow: hidden;
}

.op-toggle button {
  border: none;
  background: transparent;
  padding: 0.1rem 0.6rem;
  font-weight: 600;
  cursor: pointer;
}

.op-toggle button.active {
  background-color: #708d81;
  color: #f0f7ee;
}

.op-hint {
  font-size: 0.85rem;
  color: #4a6b5e;
}

.not-toggle {
  border: 2px solid #c9d8cf;
  border-radius: 8px;
  background: transparent;
  padding: 0.05rem 0.5rem;
  font-weight: 600;
  color: #4a6b5e;
  cursor: pointer;
}

.not-toggle.active {
  border-color: #883636;
  background-color: #883636;
  color: #f0f7ee;
}

.adv-button {
  border: 1px solid #708d81;
  border-radius: 8px;
  background: transparent;
  padding: 0.1rem 0.6rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.adv-button:hover {
  background-color: #708d81;
  color: #f0f7ee;
}

.adv-remove {
  border: none;
  background: transparent;
  color: #883636;
  cursor: pointer;
  padding: 0 0.3rem;
}

.adv-children {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.op-between {
  font-size: 0.75rem;
  font-weight: 700;
  color: #708d81;
  padding-left: 0.5rem;
}

.adv-condition {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #e1ebe4;
  border-radius: 8px;
  padding: 0.3rem 0.4rem;
}

.field-select {
  width: auto;
  min-width: 9rem;
}

.value-picker {
  flex: 1 1 14rem;
  min-width: 12rem;
}

.adv-empty {
  font-size: 0.85rem;
  color: #4a6b5e;
}

button:focus-visible {
  outline: 3px solid #1e1e24;
  outline-offset: 2px;
}
</style>

<script setup lang="ts">
import Typeahead from '@components/Typeahead.vue';
import CapTopicMultiselect from '@components/CapTopicMultiselect.vue';
import i18n from '@/data/i18setup';
import {capTopicLabel} from '@/data/capTopics';
import {addChild, newCondition, newGroup, removeChild, setField, setOperator, setValue, toggleNot} from '@/data/advancedQuery';
import {AdvancedCondition, AdvancedField, AdvancedGroup, AdvancedLists} from '@/types/AdvancedQuery';
import {Attendee} from '@/types/Attendee';
import {CapTopic} from '@/types/CapTopic';
import {PersonEntity} from '@/types/PersonEntity';
import {Place} from '@/types/Place';

const props = defineProps<{
  group: AdvancedGroup;
  lists: AdvancedLists;
  depth: number;
  removable: boolean;
}>();

const emit = defineEmits<{
  (e: 'remove'): void;
}>();

const MAX_DEPTH = 4;
const FIELDS: AdvancedField[] = ['words', 'speaker', 'person', 'location', 'topic'];
const FIELD_LABELS: Record<AdvancedField, string> = {
  words: 'advancedField_words',
  speaker: 'speaker',
  person: 'personEntity',
  location: 'locationEntity',
  topic: 'capTopic'
};

const locale = () => i18n.global.locale as string;
const unique = (values: (string | undefined)[]) => Array.from(new Set(values.filter((v): v is string => !!v)));

function entityName(names: Record<string, string>): string {
  const own = names[locale()];
  const others = unique(Object.values(names)).filter(name => name !== own);
  return [own, ...others].filter(Boolean).join(' / ');
}

function topicName(topic: string): string {
  return topic.includes(':') ? capTopicLabel(topic, locale()) : `${capTopicLabel(topic, locale())} (${i18n.global.t('advancedAllSubtopics')})`;
}

function listFor(field: AdvancedField): any[] {
  switch (field) {
    case 'speaker':
      return props.lists.speakers;
    case 'person':
      return props.lists.persons;
    case 'location':
      return props.lists.places;
    default:
      return [];
  }
}

function displayFor(field: AdvancedField): (item: any) => string {
  switch (field) {
    case 'speaker':
      return (speaker: Attendee) => speaker.names.join(' / ');
    case 'person':
    case 'location':
      return (entity: PersonEntity | Place) => entityName(entity.names);
    default:
      return (item: any) => String(item);
  }
}

// selected item for the picker
function selectedItem(condition: AdvancedCondition): any {
  const value = condition.values[0];
  if (!value) return undefined;
  switch (condition.field) {
    case 'speaker':
      return props.lists.speakers.find(speaker => speaker.id === value);
    case 'person':
      return props.lists.persons.find(person => Object.values(person.names).includes(value));
    case 'location':
      return props.lists.places.find(place => Object.values(place.names).includes(value));
    default:
      return undefined;
  }
}

function onPick(condition: AdvancedCondition, item: any) {
  if (!item) {
    setValue(condition, [], '');
    return;
  }
  switch (condition.field) {
    case 'speaker':
      setValue(condition, [item.id], item.names.join(' / '));
      break;
    case 'person':
    case 'location':
      setValue(condition, unique(Object.values(item.names)), entityName(item.names));
      break;
  }
}

// selected topics for the topic picker
function selectedTopics(condition: AdvancedCondition): CapTopic[] {
  return condition.values.map(name => name.includes(':')
      ? props.lists.topics.find(topic => topic.name === name)
      ?? {id: name, name, mainTopic: name.split(':')[0].trim(), isMainOnly: false}
      : {id: 'main_' + name, name, mainTopic: name, isMainOnly: true});
}

function onTopics(condition: AdvancedCondition, topics: CapTopic[]) {
  setValue(condition, topics.map(topic => topic.name), topics.map(topic => topicName(topic.name)).join(' / '));
}

function onWords(condition: AdvancedCondition, text: string) {
  setValue(condition, [text.trim()], text.trim());
}
</script>
