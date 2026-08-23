import type {
  DecisionModelDataset,
  DecisionModelDecision,
  DecisionModelDependency,
  DecisionModelRule,
  DecisionModelSourceKind,
  DecisionModelStat
} from '../types/decision-model-viewer.types';
import { normalizeHitPolicy } from './dmn-parse.utils';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function hrefId(href: string): string {
  return href.replace(/^#/, '').trim();
}

export function classifyDecisionKind(raw: string): string {
  const v = raw.toLowerCase();
  if (['table', 'decisiontable', 'decision-table'].includes(v)) return 'table';
  if (['expression', 'literal', 'literalexpression'].includes(v)) return 'expression';
  if (['invocation', 'boxed'].includes(v)) return v;
  return v || 'table';
}

function finishDataset(
  name: string,
  sourceKind: DecisionModelSourceKind,
  version: string,
  decisions: DecisionModelDecision[],
  rules: DecisionModelRule[],
  dependencies: DecisionModelDependency[],
  warnings: string[]
): DecisionModelDataset {
  const kindMap = new Map<string, DecisionModelStat>();
  for (const d of decisions) {
    const rec = kindMap.get(d.kind) ?? { name: d.kind, count: 0 };
    rec.count += 1;
    kindMap.set(d.kind, rec);
  }
  const policyMap = new Map<string, DecisionModelStat>();
  for (const d of decisions) {
    if (!d.hitPolicy) continue;
    const rec = policyMap.get(d.hitPolicy) ?? { name: d.hitPolicy, count: 0 };
    rec.count += 1;
    policyMap.set(d.hitPolicy, rec);
  }
  if (!decisions.length && !rules.length) warnings.push('Decision model contains no decisions or rules.');
  return {
    name,
    sourceKind,
    version,
    decisions,
    rules,
    dependencies,
    kinds: [...kindMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    hitPolicies: [...policyMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    warnings
  };
}

function parseJsonModel(data: Record<string, unknown>): DecisionModelDataset {
  const decRaw = Array.isArray(data.decisions) ? data.decisions : Array.isArray(data.tables) ? data.tables : null;
  if (!decRaw) throw new Error('Decision model JSON is missing decisions');
  const decisions: DecisionModelDecision[] = decRaw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const depends = Array.isArray(row.dependsOn) ? row.dependsOn.map((v) => String(v)) : [];
    const inputs = Array.isArray(row.inputs) ? row.inputs.map((v) => (typeof v === 'string' ? v : String((v as { label?: string; name?: string }).label ?? (v as { name?: string }).name ?? v))) : [];
    const outputs = Array.isArray(row.outputs) ? row.outputs.map((v) => (typeof v === 'string' ? v : String((v as { label?: string; name?: string }).label ?? (v as { name?: string }).name ?? v))) : [];
    return {
      id: asString(row.id, `d-${i + 1}`),
      index: i,
      name: asString(row.name, `Decision ${i + 1}`),
      kind: classifyDecisionKind(asString(row.kind ?? row.type, 'table')),
      hitPolicy: row.hitPolicy ? normalizeHitPolicy(asString(row.hitPolicy)) : '',
      dependsOn: depends,
      inputs,
      outputs,
      ruleCount: Array.isArray(row.rules) ? row.rules.length : Math.round(Number(row.ruleCount) || 0)
    };
  });
  const nameById = new Map(decisions.map((d) => [d.id, d.name]));
  decisions.forEach((d) => nameById.set(d.name.toLowerCase(), d.name));
  const depRaw = Array.isArray(data.dependencies) ? data.dependencies : [];
  const dependencies: DecisionModelDependency[] = depRaw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const source = asString(row.source ?? row.from);
    const target = asString(row.target ?? row.to);
    return {
      id: asString(row.id, `dep-${i + 1}`),
      index: i,
      source,
      target,
      sourceName: asString(row.sourceName, nameById.get(source) || source),
      targetName: asString(row.targetName, nameById.get(target) || target),
      type: asString(row.type, 'information')
    };
  });
  if (!dependencies.length) {
    decisions.forEach((d) => {
      d.dependsOn.forEach((src) => {
        dependencies.push({
          id: `dep-${dependencies.length + 1}`,
          index: dependencies.length,
          source: src,
          target: d.id,
          sourceName: nameById.get(src) || src,
          targetName: d.name,
          type: 'information'
        });
      });
    });
  }
  const rulesRaw = Array.isArray(data.rules) ? data.rules : [];
  const extraRules: DecisionModelRule[] = [];
  decRaw.forEach((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const id = asString(row.id);
    const name = asString(row.name, id);
    const nested = Array.isArray(row.rules) ? row.rules : [];
    nested.forEach((r) => {
      const rec = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      extraRules.push({
        id: asString(rec.id, `r-${extraRules.length + 1}`),
        index: extraRules.length,
        decisionId: id,
        decisionName: name,
        when: Array.isArray(rec.inputs) ? rec.inputs.map(String).join(' / ') : asString(rec.when),
        then: Array.isArray(rec.outputs) ? rec.outputs.map(String).join(' / ') : asString(rec.then),
        annotation: asString(rec.annotation)
      });
    });
  });
  const topRules: DecisionModelRule[] = rulesRaw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const decisionId = asString(row.decisionId ?? row.decision);
    return {
      id: asString(row.id, `r-${i + 1}`),
      index: i,
      decisionId,
      decisionName: asString(row.decisionName, nameById.get(decisionId) || decisionId),
      when: asString(row.when ?? row.condition),
      then: asString(row.then ?? row.result),
      annotation: asString(row.annotation)
    };
  });
  const rules = topRules.length ? topRules : extraRules;
  rules.forEach((r, i) => {
    r.index = i;
  });
  const countByDecision = new Map<string, number>();
  rules.forEach((r) => countByDecision.set(r.decisionId, (countByDecision.get(r.decisionId) || 0) + 1));
  decisions.forEach((d) => {
    if (!d.ruleCount) d.ruleCount = countByDecision.get(d.id) || 0;
  });
  return finishDataset(asString(data.name ?? data.title, 'Decision model'), 'json', asString(data.version), decisions, rules, dependencies, []);
}

function parseDmnAsModel(xml: string): DecisionModelDataset {
  if (!/<(?:[\w.-]+:)?definitions\b/i.test(xml) && !/<decisionTable\b/i.test(xml)) throw new Error('Not a decision model DMN document');
  const defAttrs = attrs(/<(?:[\w.-]+:)?definitions\b([^>]*)>/i.exec(xml)?.[1] ?? '');
  const decisions: DecisionModelDecision[] = [];
  const rules: DecisionModelRule[] = [];
  const dependencies: DecisionModelDependency[] = [];
  const nameById = new Map<string, string>();
  const decisionRe = /<(?:[\w.-]+:)?decision\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?decision>/gi;
  let match: RegExpExecArray | null;
  while ((match = decisionRe.exec(xml))) {
    const a = attrs(match[1]);
    const id = a.id || `d-${decisions.length + 1}`;
    const name = a.name || id;
    nameById.set(id, name);
    const inner = match[2];
    const tableMatch = /<(?:[\w.-]+:)?decisionTable\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?decisionTable>/i.exec(inner);
    const exprMatch = /<(?:[\w.-]+:)?literalExpression\b/i.test(inner);
    const hitPolicy = tableMatch ? normalizeHitPolicy(attrs(tableMatch[1]).hitPolicy || 'UNIQUE') : '';
    const dependsOn: string[] = [];
    const reqRe = /href="([^"]+)"/gi;
    let href: RegExpExecArray | null;
    while ((href = reqRe.exec(inner))) {
      const target = hrefId(href[1]);
      if (target && target !== id) dependsOn.push(target);
    }
    if (tableMatch) {
      const ruleRe = /<(?:[\w.-]+:)?rule\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?rule>/gi;
      let rule: RegExpExecArray | null;
      while ((rule = ruleRe.exec(tableMatch[2]))) {
        const inputs: string[] = [];
        const outputs: string[] = [];
        const inRe = /<(?:[\w.-]+:)?inputEntry\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?inputEntry>/gi;
        const outRe = /<(?:[\w.-]+:)?outputEntry\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?outputEntry>/gi;
        let entry: RegExpExecArray | null;
        while ((entry = inRe.exec(rule[2]))) inputs.push(decodeXml(entry[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) || '-');
        while ((entry = outRe.exec(rule[2]))) outputs.push(decodeXml(entry[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) || '-');
        rules.push({
          id: attrs(rule[1]).id || `r-${rules.length + 1}`,
          index: rules.length,
          decisionId: id,
          decisionName: name,
          when: inputs.join(' / '),
          then: outputs.join(' / '),
          annotation: ''
        });
      }
    }
    decisions.push({
      id,
      index: decisions.length,
      name,
      kind: tableMatch ? 'table' : exprMatch ? 'expression' : 'table',
      hitPolicy,
      dependsOn: [...new Set(dependsOn)],
      inputs: [],
      outputs: [],
      ruleCount: rules.filter((r) => r.decisionId === id).length
    });
  }
  const inputRe = /<(?:[\w.-]+:)?inputData\b([^>]*)\/?>/gi;
  while ((match = inputRe.exec(xml))) {
    const a = attrs(match[1]);
    if (a.id) nameById.set(a.id, a.name || a.id);
  }
  decisions.forEach((d) => {
    d.dependsOn.forEach((src) => {
      dependencies.push({
        id: `dep-${dependencies.length + 1}`,
        index: dependencies.length,
        source: src,
        target: d.id,
        sourceName: nameById.get(src) || src,
        targetName: d.name,
        type: 'information'
      });
    });
  });
  if (!decisions.length) throw new Error('Decision model contains no decisions');
  return finishDataset(defAttrs.name || 'DMN decision model', 'dmn', '', decisions, rules, dependencies, []);
}

function parseCsvModel(text: string): DecisionModelDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('Decision model CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const decI = idx('decision') >= 0 ? idx('decision') : idx('name');
  const whenI = idx('when') >= 0 ? idx('when') : idx('condition') >= 0 ? idx('condition') : idx('inputs');
  const thenI = idx('then') >= 0 ? idx('then') : idx('result') >= 0 ? idx('result') : idx('outputs');
  if (decI < 0 || whenI < 0 || thenI < 0) throw new Error('Decision model CSV needs decision, when, and then columns');
  const decisions = new Map<string, DecisionModelDecision>();
  const rules: DecisionModelRule[] = [];
  rows.slice(1).forEach((row) => {
    const name = row[decI] || 'Decision';
    const rec =
      decisions.get(name) ??
      {
        id: `d-${decisions.size + 1}`,
        index: decisions.size,
        name,
        kind: 'table',
        hitPolicy: 'UNIQUE',
        dependsOn: [],
        inputs: [],
        outputs: [],
        ruleCount: 0
      };
    rec.ruleCount += 1;
    decisions.set(name, rec);
    rules.push({
      id: `r-${rules.length + 1}`,
      index: rules.length,
      decisionId: rec.id,
      decisionName: name,
      when: row[whenI] || '-',
      then: row[thenI] || '-',
      annotation: ''
    });
  });
  return finishDataset('Decision model CSV', 'csv', '', [...decisions.values()], rules, [], []);
}

export function parseDecisionModelText(text: string, fileName = ''): DecisionModelDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Decision model is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid decision model JSON');
    }
    if (!data || typeof data !== 'object') throw new Error('Decision model JSON must be an object');
    return parseJsonModel(data as Record<string, unknown>);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (trimmed.includes(',') && /decision|when|then/i.test(trimmed.split('\n')[0] || ''))) {
    return parseCsvModel(trimmed);
  }
  if (ext === 'dmn' || ext === 'xml' || /^</.test(trimmed)) return parseDmnAsModel(trimmed);
  throw new Error('No decision model found — use JSON, DMN/XML, or CSV');
}

export function parseDecisionModelBytes(bytes: Uint8Array, fileName = ''): DecisionModelDataset {
  if (!bytes.length) throw new Error('Decision model is empty');
  return parseDecisionModelText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterDecisionModelDecisions(decisions: DecisionModelDecision[], query: string): DecisionModelDecision[] {
  const q = query.trim().toLowerCase();
  if (!q) return decisions;
  const tokens = q.split(/\s+/).filter(Boolean);
  return decisions.filter((d) =>
    tokens.every((token) => {
      if (['table', 'expression', 'invocation'].includes(token)) return d.kind === token;
      if (['unique', 'first', 'collect', 'priority', 'any'].includes(token)) return d.hitPolicy.toLowerCase().includes(token);
      if (token.startsWith('kind:')) return d.kind === token.slice(5);
      return `${d.id} ${d.name} ${d.kind} ${d.hitPolicy} ${d.inputs.join(' ')} ${d.outputs.join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterDecisionModelRules(rules: DecisionModelRule[], query: string): DecisionModelRule[] {
  const q = query.trim().toLowerCase();
  if (!q) return rules;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rules.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('decision:')) return r.decisionName.toLowerCase().includes(token.slice(9)) || r.decisionId.toLowerCase().includes(token.slice(9));
      return `${r.decisionName} ${r.when} ${r.then} ${r.annotation}`.toLowerCase().includes(token);
    })
  );
}

export function filterDecisionModelDependencies(deps: DecisionModelDependency[], query: string): DecisionModelDependency[] {
  const q = query.trim().toLowerCase();
  if (!q) return deps;
  const tokens = q.split(/\s+/).filter(Boolean);
  return deps.filter((d) =>
    tokens.every((token) => {
      if (['information', 'authority', 'knowledge'].includes(token)) return d.type === token;
      if (token.startsWith('type:')) return d.type === token.slice(5);
      return `${d.sourceName} ${d.targetName} ${d.type} ${d.source} ${d.target}`.toLowerCase().includes(token);
    })
  );
}
