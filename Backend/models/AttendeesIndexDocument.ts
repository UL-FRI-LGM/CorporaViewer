export interface AttendeesIndexDocument {
    id: string;
    // sl and de names
    names: string[] | { sl: string, de: string };
    aliases?: string[];
    profession?: string;
    terms?: string[];
    corpus: string;
}
