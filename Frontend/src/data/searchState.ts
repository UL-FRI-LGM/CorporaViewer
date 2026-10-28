import {LocationQuery, LocationQueryRaw} from 'vue-router';
import {corporaList} from '@/data/corporaInfo';
import {Filters} from '@/types/Filters';
import {SearchParams} from '@/types/SearchParams';
import {advancedToUrl, isAdvancedActive} from '@/data/advancedQuery';

// Search state to URL and back.
// Keys: q, speaker, person, location, topic, from, to, lang, corpus, sort, tab, adv

export interface UrlState {
  words?: string;
  speakerId?: string;
  personId?: string;
  locationName?: string;
  topics: string[];
  dateFrom?: Date;
  dateTo?: Date;
  languages?: string[];
  corpora?: string[];
  sort?: string;
  tab?: string;
  advanced?: string;
}

export function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDate(value: string | undefined): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(date.getTime()) ? undefined : date;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// canonical place name is used as id
export function placeKey(names: { [key: string]: string }): string {
  return names.sl || names.de || Object.values(names)[0] || '';
}

// date range and languages of the given corpora
export function corpusBounds(corpora: string[]): { dateFrom: Date, dateTo: Date, languages: string[] } {
  const selected = corporaList.filter(corpus => corpora.includes(corpus.name));
  const used = selected.length > 0 ? selected : corporaList;
  return {
    dateFrom: new Date(Math.min(...used.map(c => c.dateFrom.getTime()))),
    dateTo: new Date(Math.max(...used.map(c => c.dateTo.getTime()))),
    languages: Array.from(new Set(used.flatMap(c => c.languages)))
  };
}

export function allCorpora(): string[] {
  return corporaList.map(corpus => corpus.name);
}

export function defaultFilters(): { dateFrom: Date, dateTo: Date, languages: string[], corpora: string[], sort: string } {
  const corpora = allCorpora();
  return {...corpusBounds(corpora), corpora, sort: 'relevance'};
}

const FILTER_KEYS = ['from', 'to', 'lang', 'corpus', 'sort'];

export function hasFilterKeys(query: LocationQuery): boolean {
  return FILTER_KEYS.some(key => query[key] !== undefined);
}

function single(value: LocationQuery[string]): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first === null || first === undefined || first === '' ? undefined : first;
}

function list(value: LocationQuery[string]): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.filter((v): v is string => typeof v === 'string' && v !== '');
}

export function queryToState(query: LocationQuery): UrlState {
  const languages = single(query.lang)?.split(',').filter(Boolean);
  const corpora = single(query.corpus)?.split(',').filter(Boolean);
  return {
    words: single(query.q),
    speakerId: single(query.speaker),
    personId: single(query.person),
    locationName: single(query.location),
    topics: list(query.topic),
    dateFrom: parseDate(single(query.from)),
    dateTo: parseDate(single(query.to)),
    languages: languages && languages.length > 0 ? languages : undefined,
    corpora: corpora && corpora.length > 0 ? corpora : undefined,
    sort: single(query.sort),
    tab: single(query.tab),
    advanced: single(query.adv)
  };
}

export function stateToQuery(params: SearchParams, filters: Filters, tab: string): LocationQueryRaw {
  const query: LocationQueryRaw = {};
  if (params.words) query.q = params.words;
  if (params.speaker) query.speaker = params.speaker.id;
  if (params.personEntity) query.person = params.personEntity.id;
  if (params.locationEntity) query.location = placeKey(params.locationEntity.names);
  if (params.capTopics.length > 0) query.topic = params.capTopics.map(topic => topic.name);
  if (isAdvancedActive(params.advanced)) query.adv = advancedToUrl(params.advanced);

  // write filters only when initialized
  if (!filters.initializing) {
    query.from = formatDate(filters.dateFrom);
    query.to = formatDate(filters.dateTo);
    query.lang = filters.languages.join(',');
    query.corpus = filters.corpora.join(',');
    if (filters.sort && filters.sort !== 'relevance') query.sort = filters.sort;
  }
  if (tab && tab !== 'results') query.tab = tab;
  return query;
}
