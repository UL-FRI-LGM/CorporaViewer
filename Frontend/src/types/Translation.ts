export interface Translation {
    speaker: string,
    lang: string,
    original: number,
    text: string,
    words: [
        {
            id: string,
            lemma: string,
            text: string,
            propn: number,
        }
    ],
    highlights?: {
        'sentences.translations.text': string[],
        'sentences.translations.words.lemma': string[]
    }
}