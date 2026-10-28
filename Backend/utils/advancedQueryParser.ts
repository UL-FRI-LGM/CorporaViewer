import {AdvancedField, AdvancedLevel, AdvancedNode, AdvancedQuery} from "../models/AdvancedQuery";

// separate file from advancedQueryBuilder to avoid a circular import with utils

const LEVELS: AdvancedLevel[] = ["meeting", "segment", "sentence"];
const FIELDS: AdvancedField[] = ["words", "speaker", "person", "location", "topic"];
const MAX_NODES = 100;
const MAX_DEPTH = 6;

// parse and check the advanced param, empty conditions and groups are removed
const parseAdvancedQuery = (raw: string | undefined): AdvancedQuery | undefined => {
    if (!raw) return undefined;

    let parsed: any;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return undefined;
    }
    if (!parsed || !LEVELS.includes(parsed.level)) return undefined;

    let nodes = 0;
    const clean = (node: any, depth: number): AdvancedNode | undefined => {
        if (!node || typeof node !== "object" || ++nodes > MAX_NODES || depth > MAX_DEPTH) return undefined;

        if (node.type === "condition") {
            if (!FIELDS.includes(node.field) || !Array.isArray(node.values)) return undefined;
            const values = node.values.filter((v: any) => typeof v === "string" && v.trim() !== "").map((v: string) => v.trim());
            return values.length > 0 ? {type: "condition", field: node.field, values, not: !!node.not} : undefined;
        }
        if (node.type === "group" && (node.operator === "AND" || node.operator === "OR") && Array.isArray(node.children)) {
            const children = node.children.map((child: any) => clean(child, depth + 1)).filter((c: any): c is AdvancedNode => !!c);
            return children.length > 0 ? {type: "group", operator: node.operator, not: !!node.not, children} : undefined;
        }
        return undefined;
    };

    const root = clean(parsed.root, 0);
    if (!root || root.type !== "group") return undefined;
    return {level: parsed.level, root};
};

export default {parseAdvancedQuery};
