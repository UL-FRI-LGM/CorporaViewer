import {
  AdvancedCondition,
  AdvancedField,
  AdvancedGroup,
  AdvancedLevel,
  AdvancedNode,
  AdvancedOperator,
  AdvancedSearch
} from '@/types/AdvancedQuery';

// advanced search tree helpers (editing, request param and URL)

let nextId = 1;

export function newCondition(field: AdvancedField = 'words'): AdvancedCondition {
  return {type: 'condition', id: nextId++, field, values: [], label: '', not: false};
}

export function newGroup(operator: AdvancedOperator = 'AND', withCondition: boolean = true): AdvancedGroup {
  return {type: 'group', id: nextId++, operator, not: false, children: withCondition ? [newCondition()] : []};
}

export function emptyAdvanced(): AdvancedSearch {
  return {enabled: false, level: 'meeting', root: newGroup()};
}

export function addChild(group: AdvancedGroup, node: AdvancedNode) {
  group.children.push(node);
}

export function removeChild(group: AdvancedGroup, id: number) {
  group.children = group.children.filter(child => child.id !== id);
}

export function setOperator(group: AdvancedGroup, operator: AdvancedOperator) {
  group.operator = operator;
}

export function toggleNot(node: AdvancedNode) {
  node.not = !node.not;
}

export function setField(condition: AdvancedCondition, field: AdvancedField) {
  condition.field = field;
  condition.values = [];
  condition.label = '';
}

export function setValue(condition: AdvancedCondition, values: string[], label: string) {
  condition.values = values.filter(value => value.trim() !== '');
  condition.label = label;
}

function hasValues(node: AdvancedNode): boolean {
  return node.type === 'condition' ? node.values.length > 0 : node.children.some(hasValues);
}

// on and at least one condition is filled
export function isAdvancedActive(advanced: AdvancedSearch | undefined): boolean {
  return !!advanced && advanced.enabled && hasValues(advanced.root);
}

function strip(node: AdvancedNode, withLabels: boolean): any {
  if (node.type === 'condition') {
    return {type: 'condition', field: node.field, values: node.values, not: node.not, ...(withLabels ? {label: node.label} : {})};
  }
  return {type: 'group', operator: node.operator, not: node.not, children: node.children.map(child => strip(child, withLabels))};
}

// advanced request param
export function advancedToApi(advanced: AdvancedSearch): string {
  return JSON.stringify({level: advanced.level, root: strip(advanced.root, false)});
}

// for the URL, with labels
export function advancedToUrl(advanced: AdvancedSearch): string {
  return JSON.stringify({level: advanced.level, root: strip(advanced.root, true)});
}

const LEVELS: AdvancedLevel[] = ['meeting', 'segment', 'sentence'];
const FIELDS: AdvancedField[] = ['words', 'speaker', 'person', 'location', 'topic'];

// read from the URL, undefined if invalid
export function advancedFromUrl(value: string | undefined): AdvancedSearch | undefined {
  if (!value) return undefined;
  let parsed: any;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }

  const read = (node: any, depth: number): AdvancedNode | undefined => {
    if (!node || typeof node !== 'object' || depth > 6) return undefined;
    if (node.type === 'condition' && FIELDS.includes(node.field)) {
      const values = Array.isArray(node.values) ? node.values.filter((v: any) => typeof v === 'string') : [];
      return {type: 'condition', id: nextId++, field: node.field, values, label: String(node.label ?? values.join(' ')), not: !!node.not};
    }
    if (node.type === 'group' && (node.operator === 'AND' || node.operator === 'OR') && Array.isArray(node.children)) {
      const children = node.children.map((child: any) => read(child, depth + 1)).filter((c: any): c is AdvancedNode => !!c);
      return {type: 'group', id: nextId++, operator: node.operator, not: !!node.not, children};
    }
    return undefined;
  };

  const root = read(parsed?.root, 0);
  if (!root || root.type !== 'group' || !LEVELS.includes(parsed.level)) return undefined;
  return {enabled: true, level: parsed.level, root};
}

// words, places and persons of the conditions without NOT (for the PDF highlights), and their speaker ids
export function advancedHighlightTerms(advanced: AdvancedSearch): { words: string[], speakers: string[] } {
  const words: string[] = [];
  const speakers: string[] = [];
  const collect = (node: AdvancedNode, negated: boolean) => {
    const not = negated !== node.not;
    if (node.type === 'group') {
      node.children.forEach(child => collect(child, not));
      return;
    }
    if (not || node.values.length === 0) return;
    if (node.field === 'speaker') speakers.push(...node.values);
    else if (node.field !== 'topic') words.push(...node.values);
  };
  collect(advanced.root, false);
  return {words: Array.from(new Set(words)), speakers: Array.from(new Set(speakers))};
}

// deep copy
export function cloneAdvanced(advanced: AdvancedSearch): AdvancedSearch {
  return JSON.parse(JSON.stringify(advanced));
}

// tree as text, e.g. (Bleiweis OR Toman) AND Ljubljana
export function advancedSummary(advanced: AdvancedSearch, words: { and: string, or: string, not: string }): string {
  const render = (node: AdvancedNode, nested: boolean): string => {
    let text: string;
    if (node.type === 'condition') {
      text = node.field === 'words' ? `"${node.label}"` : node.label;
    } else {
      const parts = node.children.filter(child => child.type === 'group' || child.values.length > 0).map(child => render(child, true));
      text = parts.join(` ${node.operator === 'AND' ? words.and : words.or} `);
      if (nested && parts.length > 1) text = `(${text})`;
    }
    return node.not ? `${words.not} ${text}` : text;
  };
  return render(advanced.root, false);
}
