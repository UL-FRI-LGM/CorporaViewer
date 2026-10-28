import {LocationQuery} from 'vue-router';
import {ComparisonSeries} from '@/types/Timeline';

// saved searches on the timeline (URL key cmp)

// first color is the default green for the current search
export const SERIES_COLORS: string[] = ['#708d81', '#eb6834', '#2a78d6', '#eda100', '#e87ba4', '#6250d6', '#e34948'];

// including the current search
export const MAX_SERIES = SERIES_COLORS.length;

// first free color
export function nextSeriesColor(saved: ComparisonSeries[]): string | undefined {
  if (saved.length >= MAX_SERIES - 1) return undefined;
  const used = new Set(saved.map(series => series.color));
  return SERIES_COLORS.slice(1).find(color => !used.has(color));
}

// values for the cmp URL key
export function seriesToQuery(saved: ComparisonSeries[]): string[] {
  return saved.map(series => new URLSearchParams({name: series.name, color: series.color, query: series.query}).toString());
}

// check that the query is a valid getTimeline query
function isSeriesQuery(query: string): boolean {
  if (!query.startsWith('?') || /[/#]/.test(query)) return false;
  const keys = Array.from(new URLSearchParams(query.slice(1)).keys());
  return !keys.includes('interval') && !keys.includes('unit');
}

// read series from the URL, skip invalid ones
export function seriesFromQuery(value: LocationQuery[string] | undefined): ComparisonSeries[] {
  const values = (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string' && v !== '');
  const used = new Set<string>();
  const series: ComparisonSeries[] = [];

  for (const entry of values) {
    const params = new URLSearchParams(entry);
    const query = params.get('query');
    const color = params.get('color') ?? '';
    if (!query || !isSeriesQuery(query) || !SERIES_COLORS.slice(1).includes(color) || used.has(color)) continue;
    used.add(color);
    series.push({name: params.get('name') || query, color, query});
  }
  return series.slice(0, MAX_SERIES - 1);
}

// series name from its filters
export function seriesLabel(parts: { words?: string; speaker?: string; person?: string; place?: string; topics: string[] },
                            emptyLabel: string): string {
  const labels = [
    parts.place,
    parts.person,
    parts.speaker,
    parts.topics.length > 0 ? parts.topics.join(', ') : undefined,
    parts.words ? `"${parts.words}"` : undefined
  ].filter((label): label is string => !!label);
  return labels.length > 0 ? labels.join(' · ') : emptyLabel;
}
