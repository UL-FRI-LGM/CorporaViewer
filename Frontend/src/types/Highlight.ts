import {Rect} from "@/types/Rect";

export interface Highlight {
    ids: string[],
    texts?: string[],
    lemmas?: string[],
    rects: Rect[],
}