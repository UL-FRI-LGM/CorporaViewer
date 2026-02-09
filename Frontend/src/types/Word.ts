import {Rect} from './Rect';

export interface Word {
    id: string,
    lemma: string,
    text: string,
    propn: number,
    coordinates?: Rect[],
}