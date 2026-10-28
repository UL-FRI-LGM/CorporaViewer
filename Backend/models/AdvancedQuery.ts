// advanced search tree (AND/OR/NOT), checked on a meeting, segment or sentence

export type AdvancedLevel = "meeting" | "segment" | "sentence";
export type AdvancedField = "words" | "speaker" | "person" | "location" | "topic";
export type AdvancedOperator = "AND" | "OR";

export interface AdvancedCondition {
    type: "condition";
    field: AdvancedField;
    // words: search text, speaker: ids, person/location: names, topic: topic names
    values: string[];
    not?: boolean;
}

export interface AdvancedGroup {
    type: "group";
    operator: AdvancedOperator;
    not?: boolean;
    children: AdvancedNode[];
}

export type AdvancedNode = AdvancedCondition | AdvancedGroup;

export interface AdvancedQuery {
    level: AdvancedLevel;
    root: AdvancedGroup;
}
