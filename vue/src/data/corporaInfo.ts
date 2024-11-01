import CorpusList from "@/types/Corpus";

export const corporaList: CorpusList = [
    {
        name: "DezelniZborKranjski",
        languages: ["sl", "de"],
        dateFrom: new Date("1861-01-01"),
        dateTo: new Date("1913-12-31"),
    },
    {
        name: "Yu1Parl",
        languages: ["sl", "hr", "sr"],
        dateFrom: new Date("1919-01-01"),
        dateTo: new Date("1939-12-31"),
    },
];