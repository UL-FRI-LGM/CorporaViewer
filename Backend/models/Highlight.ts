export interface Highlight {
    ids: string[];
    rects: Rect[];
}

export interface Rect {
    page: number;
    coordinates: Coordinate[];
}

interface Coordinate {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}


