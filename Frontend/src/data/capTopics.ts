import axios from 'axios';
import {reactive} from 'vue';

// CAP topics from the backend, loaded once.
// The english name is used as id everywhere, name_sl is only for display.
export interface CapTopicDocument {
  id: number | string;
  name: string;
  name_sl?: string;
}

// english name -> slovenian name
const slNames = reactive<Record<string, string>>({});

let topicsPromise: Promise<CapTopicDocument[]> | null = null;

export function fetchCapTopics(): Promise<CapTopicDocument[]> {
  if (!topicsPromise) {
    topicsPromise = axios.get(process.env.VUE_APP_API_URL + '/capTopics/getAll')
        .then(response => {
          const topics: CapTopicDocument[] = response.data.map((entity: any) => entity._source);
          for (const topic of topics) {
            if (!topic.name_sl) continue;
            slNames[topic.name] = topic.name_sl;
            slNames[topic.name.split(':')[0].trim()] = topic.name_sl.split(':')[0].trim();
          }
          return topics;
        })
        .catch(error => {
          topicsPromise = null;
          throw error;
        });
  }
  return topicsPromise;
}

// main topic label
export function capMainTopicLabel(main: string, locale: string): string {
  return (locale === 'sl' && slNames[main]) || main;
}

// subtopic label without the main topic
export function capSubtopicLabel(name: string, locale: string): string {
  const label = (locale === 'sl' && slNames[name]) || name;
  return label.split(':').slice(1).join(':').trim() || label;
}

// full topic label
export function capTopicLabel(name: string, locale: string): string {
  if (!name.includes(':')) return capMainTopicLabel(name, locale);
  const main = name.split(':')[0].trim();
  return `${capMainTopicLabel(main, locale)}: ${capSubtopicLabel(name, locale)}`;
}
