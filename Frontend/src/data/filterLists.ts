import axios from 'axios';
import {Attendee} from '@/types/Attendee';
import {PersonEntity} from '@/types/PersonEntity';
import {fetchCapTopics} from '@/data/capTopics';
import {CapTopic} from '@/types/CapTopic';

// lists for the advanced search, loaded once

let speakersPromise: Promise<Attendee[]> | null = null;
let personsPromise: Promise<PersonEntity[]> | null = null;
let topicsPromise: Promise<CapTopic[]> | null = null;

function cached<T>(get: () => Promise<T>, reset: () => void): Promise<T> {
  return get().catch(error => {
    reset();
    throw error;
  });
}

export function fetchSpeakers(): Promise<Attendee[]> {
  if (!speakersPromise) {
    speakersPromise = cached(() => axios.get(process.env.VUE_APP_API_URL + '/poslanci/getAll').then(response =>
        response.data.map((speaker: any) => {
          const names = speaker._source.names;
          return {
            id: speaker._source.id,
            names: Array.from(new Set<string>(Array.isArray(names) ? names : Object.values(names)))
          } as Attendee;
        })), () => speakersPromise = null);
  }
  return speakersPromise;
}

export function fetchPersons(): Promise<PersonEntity[]> {
  if (!personsPromise) {
    personsPromise = cached(() => axios.get(process.env.VUE_APP_API_URL + '/personEntities/getAll').then(response =>
        response.data.map((entity: any) => entity._source as PersonEntity)), () => personsPromise = null);
  }
  return personsPromise;
}

// CAP topics for CapTopicMultiselect
export function fetchTopics(): Promise<CapTopic[]> {
  if (!topicsPromise) {
    topicsPromise = cached(() => fetchCapTopics().then(topics => topics.map(topic => ({
      id: String(topic.id),
      name: topic.name,
      mainTopic: topic.name.split(':')[0].trim(),
      isMainOnly: false
    }))), () => topicsPromise = null);
  }
  return topicsPromise;
}
