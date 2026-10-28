import {format} from "date-fns";
import {GetPageQueryParams} from "../models/GetPageQueryParams";
import {AdvancedCondition, AdvancedNode, AdvancedQuery} from "../models/AdvancedQuery";
import utils from "./utils";

// Advanced search. The tree is checked on:
//  - meeting: each condition can be in any sentence of the meeting
//  - segment: one segment has to match the whole tree (nested segments)
//  - sentence: one sentence has to match the whole tree

const topicClause = (field: string, topics: string[]): any => ({
    bool: {
        should: topics.map(topic => topic.includes(":") ? {term: {[field]: topic}} : {prefix: {[field]: topic + ":"}}),
        minimum_should_match: 1
    }
});

// search words on a sentence translation (same as basic search)
const translationWordsQuery = (words: string, languages: string[]): any | undefined => {
    const languageFilter = [{terms: {"sentences.translations.lang.keyword": languages}}];
    const groups = utils.tokenizeQuery(words)
        .filter(group => group.length > 0)
        .map(group => group.length === 1
            ? utils.buildShouldMatchLemmaAndTextQuery(group[0], languageFilter)
            : {bool: {must: group.map(token => utils.buildShouldMatchLemmaAndTextQuery(token, languageFilter))}});
    return groups.length > 0 ? {bool: {should: groups, minimum_should_match: 1}} : undefined;
};

// search words on a segment
const segmentWordsQuery = (words: string): any | undefined => {
    const token = (word: string) => ({
        bool: {
            should: [{match_phrase: {"segments.text": word}}, {match_phrase: {"segments.lemmas": word}}],
            minimum_should_match: 1
        }
    });
    const groups = utils.tokenizeQuery(words)
        .filter(group => group.length > 0)
        .map(group => group.length === 1 ? token(group[0]) : {bool: {must: group.map(token)}});
    return groups.length > 0 ? {bool: {should: groups, minimum_should_match: 1}} : undefined;
};

const MATCH_NOTHING = {bool: {must_not: [{match_all: {}}]}};

// condition on one sentence
const sentenceCondition = (condition: AdvancedCondition, languages: string[]): any => {
    switch (condition.field) {
        case "speaker":
            return {terms: {"sentences.speaker_id": condition.values}};
        case "person":
            return {terms: {"sentences.person_entities": condition.values}};
        case "location":
            return {terms: {"sentences.location_entities": condition.values}};
        case "topic":
            return topicClause("sentences.cap_topics", condition.values);
        case "words": {
            const words = translationWordsQuery(condition.values.join(" "), languages);
            return words ? {nested: {path: "sentences.translations", query: words}} : MATCH_NOTHING;
        }
    }
};

// condition on one segment
const segmentCondition = (condition: AdvancedCondition): any => {
    switch (condition.field) {
        case "speaker":
            return {terms: {"segments.speaker_id": condition.values}};
        case "person":
            return {terms: {"segments.person_entities": condition.values}};
        case "location":
            return {terms: {"segments.location_entities": condition.values}};
        case "topic":
            return topicClause("segments.cap_topics", condition.values);
        case "words":
            return segmentWordsQuery(condition.values.join(" ")) ?? MATCH_NOTHING;
    }
};

// build bool query from the tree
const combine = (node: AdvancedNode, leaf: (condition: AdvancedCondition) => any): any => {
    const query = node.type === "condition"
        ? leaf(node)
        : node.operator === "AND"
            ? {bool: {must: node.children.map(child => combine(child, leaf))}}
            : {bool: {should: node.children.map(child => combine(child, leaf)), minimum_should_match: 1}};
    return node.not ? {bool: {must_not: [query]}} : query;
};

// tree on one sentence (also used for the sentences timeline)
const buildAdvancedSentenceQuery = (advanced: AdvancedQuery, languages: string[]): any => ({
    bool: {
        must: [
            {nested: {path: "sentences.translations", query: {terms: {"sentences.translations.lang.keyword": languages}}}},
            combine(advanced.root, condition => sentenceCondition(condition, languages))
        ]
    }
});

// tree on one segment (also used for the segments timeline)
const buildAdvancedSegmentQuery = (advanced: AdvancedQuery, languages: string[]): any => ({
    bool: {
        must: [
            {terms: {"segments.original_language": languages}},
            combine(advanced.root, segmentCondition)
        ]
    }
});

// basic search on one segment, for the segments timeline
const buildBasicSegmentQuery = (queryParams: GetPageQueryParams, languages: string[]): any => {
    const splitEntities = (entities: string | undefined): string[] =>
        (entities ?? "").split(",").map(e => e.trim()).filter(e => e.length > 0);
    const persons = splitEntities(queryParams.personEntities);
    const locations = splitEntities(queryParams.locationEntities);
    const words = queryParams.words ? segmentWordsQuery(queryParams.words) : undefined;

    return {
        bool: {
            must: [
                {terms: {"segments.original_language": languages}},
                ...(words ? [words] : []),
                ...(queryParams.speaker?.length ? [{terms: {"segments.speaker_id": queryParams.speaker}}] : []),
                ...(persons.length ? [{terms: {"segments.person_entities": persons}}] : []),
                ...(locations.length ? [{terms: {"segments.location_entities": locations}}] : []),
                ...(queryParams.capTopics?.length ? [topicClause("segments.cap_topics", queryParams.capTopics)] : [])
            ]
        }
    };
};

// inner hit names, read in meetingsRepository.getPage
export const SHOWN_SENTENCES = "shown_sentences";
export const MATCHED_SEGMENTS = "matched_segments";

const buildLevelQuery = (advanced: AdvancedQuery, languages: string[]): any => {
    switch (advanced.level) {
        case "sentence":
            return {nested: {path: "sentences", query: buildAdvancedSentenceQuery(advanced, languages)}};
        case "segment":
            return {
                nested: {
                    path: "segments",
                    query: buildAdvancedSegmentQuery(advanced, languages),
                    // ids of the matching segments, the shown sentences are taken only from them
                    inner_hits: {name: MATCHED_SEGMENTS, size: 100, _source: ["segments.id"]}
                }
            };
        case "meeting":
            // each condition can be in a different sentence
            return combine(advanced.root, condition => ({
                nested: {path: "sentences", query: sentenceCondition(condition, languages)}
            }));
    }
};

// conditions without NOT
const positiveConditions = (node: AdvancedNode, negated: boolean = false): AdvancedCondition[] => {
    const isNegated = negated !== !!node.not;
    if (node.type === "condition") return isNegated ? [] : [node];
    return node.children.flatMap(child => positiveConditions(child, isNegated));
};

// The tree on one sentence, where only speaker and topic conditions are checked (a sentence has the same speaker
// and topics as its segment). The other conditions count as true (or false under NOT), so every sentence of a
// matching segment matches this query.
const relaxedSegmentTree = (node: AdvancedNode, over: boolean = true): any => {
    let query: any;
    if (node.type === "condition") {
        query = node.field === "speaker" || node.field === "topic"
            ? sentenceCondition(node, [])
            : (over !== !!node.not ? {match_all: {}} : MATCH_NOTHING);
        return node.not ? {bool: {must_not: [query]}} : query;
    }
    const children = node.children.map(child => relaxedSegmentTree(child, over !== !!node.not));
    query = node.operator === "AND"
        ? {bool: {must: children}}
        : {bool: {should: children, minimum_should_match: 1}};
    return node.not ? {bool: {must_not: [query]}} : query;
};

// original translation of a shown sentence, with the searched words highlighted
const shownTranslation = (advanced: AdvancedQuery, languages: string[]): any => {
    const words = positiveConditions(advanced.root)
        .filter(condition => condition.field === "words")
        .map(condition => translationWordsQuery(condition.values.join(" "), languages))
        .filter(query => query);
    const originalOnly: any[] = languages.length > 1 ? [{match: {"sentences.translations.original": 1}}] : [];

    return {
        nested: {
            path: "sentences.translations",
            query: {
                bool: {
                    filter: [{terms: {"sentences.translations.lang.keyword": languages}}, ...originalOnly],
                    should: words
                }
            },
            inner_hits: {
                size: 1,
                highlight: {
                    fields: {
                        "sentences.translations.text": {},
                        "sentences.translations.words.lemma": {},
                    }
                },
                sort: [{"sentences.translations.original": {order: "desc"}}]
            }
        }
    };
};

// sentences shown in the results, does not filter meetings
//  - sentence: sentences that match the whole tree
//  - segment: sentences with the words/persons/places of the tree, only from matching segments (filtered in getPage)
//  - meeting: sentences that match any condition without NOT
const buildShownSentences = (advanced: AdvancedQuery, languages: string[]): any | undefined => {
    let sentence: any;
    if (advanced.level === "sentence") {
        sentence = buildAdvancedSentenceQuery(advanced, languages);
    } else {
        // topics are on the whole segment, so they do not pick sentences (on segment level the speaker neither)
        const segmentWide = advanced.level === "segment" ? ["topic", "speaker"] : ["topic"];
        const clauses = positiveConditions(advanced.root)
            .filter(condition => !segmentWide.includes(condition.field))
            .map(condition => sentenceCondition(condition, languages));
        if (advanced.level === "segment") {
            sentence = {
                bool: {
                    must: [
                        relaxedSegmentTree(advanced.root),
                        ...(clauses.length > 0 ? [{bool: {should: clauses, minimum_should_match: 1}}] : [])
                    ]
                }
            };
        } else if (clauses.length > 0) {
            sentence = {bool: {should: clauses, minimum_should_match: 1}};
        } else {
            return undefined;
        }
    }

    return {
        nested: {
            path: "sentences",
            query: {bool: {must: [sentence, shownTranslation(advanced, languages)]}},
            inner_hits: {
                name: SHOWN_SENTENCES,
                size: advanced.level === "segment" ? 100 : 10,
                _source: ["sentences.segment_id"]
            }
        }
    };
};


const buildAdvancedMeetingsQuery = (queryParams: GetPageQueryParams): any => {
    const advanced = queryParams.advanced!;
    const languages: string[] = queryParams.filters.languages!.split(",");

    const filter: any[] = [];
    if (queryParams.filters.corpora) {
        filter.push({terms: {"corpus": queryParams.filters.corpora.split(",")}});
    }
    if (queryParams.filters.dateFrom || queryParams.filters.dateTo) {
        const range: any = {};
        if (queryParams.filters.dateFrom) range.gte = format(new Date(queryParams.filters.dateFrom), 'dd.MM.yyyy');
        if (queryParams.filters.dateTo) range.lte = format(new Date(queryParams.filters.dateTo), 'dd.MM.yyyy');
        filter.push({range: {date: range}});
    }

    const shown = buildShownSentences(advanced, languages);
    return {
        bool: {
            filter,
            must: [buildLevelQuery(advanced, languages)],
            should: shown ? [shown] : []
        }
    };
};

export default {
    buildAdvancedMeetingsQuery,
    buildAdvancedSentenceQuery,
    buildAdvancedSegmentQuery,
    buildBasicSegmentQuery
};
