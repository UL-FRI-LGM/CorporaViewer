import {AggregationsCompositeBucket} from "@elastic/elasticsearch/lib/api/types";

export interface UtteranceBucket extends AggregationsCompositeBucket {
    key: {
        segment_sort: string;
        segment_id: string;
    };
    doc_count: number;
    sentences: {
        hits: {
            total: {
                value: number;
                relation: string;
            };
            max_score: number | null;
            hits: SentenceHit[];
        };
    };
}

interface SentenceHit {
    _index: string;
    _id: string;
    _score: number | null;
    _source: SentenceSource;
    sort: string[];
}

interface SentenceSource {
    sentence_id: string;
    segment_id: string;
    speaker: string;
    coordinates: Coordinate[];
}

export interface Coordinate {
    page: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
