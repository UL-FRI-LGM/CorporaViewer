export interface Place {
    corpus: string[],
    names: {
        [key: string]: string
    },
    coordinates?: {
        lat: string;
        lon: string;
    }
}