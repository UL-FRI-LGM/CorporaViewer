import { Translation } from "./Translation"


export interface Meeting {
    id: string,
    date: Date,
    titles: [
        {
            lang: string,
            title: string
        }
    ],
    agendas: [
        {
            lang: string,
            items: [
                {
                    n: number,
                    text: string
                }
            ]
        }
    ],
    sentences: Translation[],
    totalSentences: number
}

export class Meeting implements Meeting {
    static create(): Meeting {
        return new Meeting();
    }

    id: string = "";
    date: Date = new Date();
    titles: [
        {
            lang: string,
            title: string
        }
    ] = [
            {
                lang: "",
                title: ""
            }
        ];
    agendas: [
        {
            lang: string,
            items: [
                {
                    n: number,
                    text: string
                }
            ]
        }
    ] = [
            {
                lang: "",
                items: [
                    {
                        n: 0,
                        text: ""
                    }
                ]
            }
        ];
    sentences: Translation[] = [];
    totalSentences: number = 0;
}