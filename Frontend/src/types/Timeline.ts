export type TimelineInterval = 'year' | 'month';

export type TimelineUnit = 'meetings' | 'segments' | 'sentences';

// one period from /meetings/getTimeline
export interface TimelineBucket {
  date: string;   // yyyy-MM-dd
  count: number;  // matching
  total: number;  // all
}

// saved search for comparison, query = getTimeline query without dates, interval and unit
export interface ComparisonSeries {
  name: string;
  color: string;
  query: string;
}

// series shown on the timeline
export interface TimelineSeriesData {
  name: string;
  color: string;
  current: boolean;
  buckets: TimelineBucket[];
  failed: boolean;
}
