export interface UniqueSpeakersAggregation {
    buckets: Array<{
        key: string;
        doc_count: number;
    }>;
}
