export interface PlacesIndexDocument {
    corpus: string[];
    names: {
        sl: string;
        de: string;
    };
    coordinates?: {
        lat: string;
        lon: string;
    };
}
