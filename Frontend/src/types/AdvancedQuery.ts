import {Attendee} from '@/types/Attendee';
import {PersonEntity} from '@/types/PersonEntity';
import {Place} from '@/types/Place';
import {CapTopic} from '@/types/CapTopic';

// advanced search tree (AND/OR/NOT)

export type AdvancedLevel = 'meeting' | 'segment' | 'sentence';
export type AdvancedField = 'words' | 'speaker' | 'person' | 'location' | 'topic';
export type AdvancedOperator = 'AND' | 'OR';

export interface AdvancedCondition {
  type: 'condition';
  id: number;
  field: AdvancedField;
  // words: search text, speaker: id, person/location: names, topic: topic names
  values: string[];
  label: string;    // shown text
  not: boolean;
}

export interface AdvancedGroup {
  type: 'group';
  id: number;
  operator: AdvancedOperator;
  not: boolean;
  children: AdvancedNode[];
}

export type AdvancedNode = AdvancedCondition | AdvancedGroup;

export interface AdvancedSearch {
  enabled: boolean;
  level: AdvancedLevel;
  root: AdvancedGroup;
}

// lists for the pickers
export interface AdvancedLists {
  speakers: Attendee[];
  persons: PersonEntity[];
  places: Place[];
  topics: CapTopic[];
}
