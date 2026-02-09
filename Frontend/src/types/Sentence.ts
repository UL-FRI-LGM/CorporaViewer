export interface Sentence {
    _index: string,
    _id: string,
    _score: number,
    _source: {
        id: string,
        segment_page: string,
        segment_id: string,
        speaker: string,
        meeting_id: string,
        translations: [
            {
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
                ]
            }
        ]
    },
    highlight: {
        'translations.text': string[],
        'translations.words.lemma': string[]
    }
}