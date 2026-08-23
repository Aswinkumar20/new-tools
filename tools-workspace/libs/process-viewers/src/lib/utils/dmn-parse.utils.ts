import type {
  DmnClause,
  DmnDataset,
  DmnDecisionTable,
  DmnDrdEdge,
  DmnDrdNode,
  DmnRule,
  DmnSourceKind,
  DmnStat
} from '../types/dmn-viewer.types';

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

function innerText(block: string, tag: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`, 'i');
  const match = re.exec(block);
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) : '';
}

export function normalizeHitPolicy(raw: string): string {
  const v = raw.trim().toUpperCase();
  if (!v) return 'UNIQUE';
  if (v === 'U' || v === 'UNIQUE') return 'UNIQUE';
  if (v === 'F' || v === 'FIRST') return 'FIRST';
  if (v === 'P' || v === 'PRIORITY') return 'PRIORITY';
  if (v === 'A' || v === 'ANY') return 'ANY';
  if (v.startsWith('C') || v === 'COLLECT') return v.includes('+') ? v.replace(/^C/, 'COLLECT') : 'COLLECT';
  if (v === 'R' || v === 'RULE ORDER' || v === 'RULE_ORDER') return 'RULE ORDER';
  if (v === 'O' || v === 'OUTPUT ORDER' || v === 'OUTPUT_ORDER') return 'OUTPUT ORDER';
  return v;
}

function hrefId(href: string): string {
  return href.replace(/^#/, '').trim();
}

function finishDataset(
  name: string,
  sourceKind: DmnSourceKind,
  namespace: string,
  tables: DmnDecisionTable[],
  rules: DmnRule[],
  nodes: DmnDrdNode[],
  edges: DmnDrdEdge[],
  warnings: string[]
): DmnDataset {
  const policyMap = new Map<string, DmnStat>();
  for (const t of tables) {
    const rec = policyMap.get(t.hitPolicy) ?? { name: t.hitPolicy, count: 0 };
    rec.count += 1;
    policyMap.set(t.hitPolicy, rec);
  }
  const kindMap = new Map<string, DmnStat>();
  for (const n of nodes) {
    const rec = kindMap.get(n.kind) ?? { name: n.kind, count: 0 };
    rec.count += 1;
    kindMap.set(n.kind, rec);
  }
  if (!tables.length && !nodes.length) warnings.push('DMN model contains no decision tables or DRD nodes.');
  return {
    name,
    sourceKind,
    namespace,
    tables,
    rules,
    nodes,
    edges,
    hitPolicies: [...policyMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    nodeKinds: [...kindMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    warnings
  };
}

function parseClauses(block: string, tag: 'input' | 'output'): DmnClause[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}\\b([^>]*)>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>|<(?:[\\w.-]+:)?${tag}\\b([^>]*)/>`, 'gi');
  const clauses: DmnClause[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) {
    const a = attrs(match[1] || match[3] || '');
    const inner = match[2] || '';
    const expr = innerText(inner, 'text') || innerText(inner, 'inputExpression');
    clauses.push({
      id: a.id || `${tag}-${clauses.length + 1}`,
      label: a.label || a.name || a.id || `${tag} ${clauses.length + 1}`,
      expression: expr || a.expression || '',
      typeRef: a.typeRef || /typeRef="([^"]+)"/i.exec(inner)?.[1] || ''
    });
  }
  return clauses;
}

function parseRules(tableBlock: string, tableId: string, tableName: string, hitPolicy: string): DmnRule[] {
  const rules: DmnRule[] = [];
  const ruleRe = /<(?:[\w.-]+:)?rule\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?rule>/gi;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(tableBlock))) {
    const a = attrs(match[1]);
    const inner = match[2];
    const inputs: string[] = [];
    const outputs: string[] = [];
    const inRe = /<(?:[\w.-]+:)?inputEntry\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?inputEntry>/gi;
    const outRe = /<(?:[\w.-]+:)?outputEntry\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?outputEntry>/gi;
    let entry: RegExpExecArray | null;
    while ((entry = inRe.exec(inner))) inputs.push(decodeXml(entry[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) || '-');
    while ((entry = outRe.exec(inner))) outputs.push(decodeXml(entry[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) || '-');
    rules.push({
      id: a.id || `r-${rules.length + 1}`,
      index: rules.length,
      tableId,
      tableName,
      hitPolicy,
      inputs,
      outputs,
      annotation: innerText(inner, 'description') || a.description || ''
    });
  }
  return rules;
}

function parseDmnXml(xml: string): DmnDataset {
  if (!/<(?:[\w.-]+:)?definitions\b/i.test(xml) && !/DMN\/20/i.test(xml) && !/<decisionTable\b/i.test(xml)) {
    throw new Error('Not a DMN document');
  }
  const defAttrs = attrs(/<(?:[\w.-]+:)?definitions\b([^>]*)>/i.exec(xml)?.[1] ?? '');
  const name = defAttrs.name || 'DMN model';
  const namespace = defAttrs.namespace || defAttrs.targetNamespace || '';
  const tables: DmnDecisionTable[] = [];
  const rules: DmnRule[] = [];
  const nodes: DmnDrdNode[] = [];
  const edges: DmnDrdEdge[] = [];
  const nameById = new Map<string, string>();

  const decisionRe = /<(?:[\w.-]+:)?decision\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?decision>/gi;
  let match: RegExpExecArray | null;
  while ((match = decisionRe.exec(xml))) {
    const a = attrs(match[1]);
    const id = a.id || `d-${nodes.length + 1}`;
    const decisionName = a.name || id;
    nameById.set(id, decisionName);
    nodes.push({ id, name: decisionName, kind: 'decision' });
    const inner = match[2];
    const tableMatch = /<(?:[\w.-]+:)?decisionTable\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?decisionTable>/i.exec(inner);
    if (tableMatch) {
      const ta = attrs(tableMatch[1]);
      const tableId = ta.id || `dt-${tables.length + 1}`;
      const hitPolicy = normalizeHitPolicy(ta.hitPolicy || 'UNIQUE');
      const inputs = parseClauses(tableMatch[2], 'input');
      const outputs = parseClauses(tableMatch[2], 'output');
      const tableRules = parseRules(tableMatch[2], tableId, decisionName, hitPolicy);
      tableRules.forEach((r) => {
        r.index = rules.length;
        rules.push(r);
      });
      tables.push({ id: tableId, name: decisionName, hitPolicy, inputs, outputs, ruleCount: tableRules.length });
    }
    const reqRe = /<(?:[\w.-]+:)?(informationRequirement|authorityRequirement|knowledgeRequirement)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?\1>/gi;
    let req: RegExpExecArray | null;
    while ((req = reqRe.exec(inner))) {
      const kind = req[1].toLowerCase();
      const href =
        /href="([^"]+)"/i.exec(req[3])?.[1] ||
        /required(?:Decision|Input|Authority|Knowledge)\b[^>]*href="([^"]+)"/i.exec(req[3])?.[1] ||
        '';
      const target = hrefId(href);
      if (!target) continue;
      const type = kind.includes('authority') ? 'authority' : kind.includes('knowledge') ? 'knowledge' : 'information';
      edges.push({ id: `e-${edges.length + 1}`, source: target, target: id, type });
    }
  }

  const inputRe = /<(?:[\w.-]+:)?inputData\b([^>]*)\/?>/gi;
  while ((match = inputRe.exec(xml))) {
    const a = attrs(match[1]);
    const id = a.id || `in-${nodes.length + 1}`;
    const n = a.name || id;
    nameById.set(id, n);
    nodes.push({ id, name: n, kind: 'input' });
  }
  const ksRe = /<(?:[\w.-]+:)?knowledgeSource\b([^>]*)\/?>/gi;
  while ((match = ksRe.exec(xml))) {
    const a = attrs(match[1]);
    const id = a.id || `ks-${nodes.length + 1}`;
    const n = a.name || id;
    nameById.set(id, n);
    nodes.push({ id, name: n, kind: 'knowledge' });
  }

  if (!tables.length && !nodes.length) throw new Error('DMN document contains no decisions or tables');
  const warnings: string[] = [];
  if (!tables.length) warnings.push('DMN has DRD nodes but no decision tables.');
  return finishDataset(name, 'dmn', namespace, tables, rules, nodes, edges, warnings);
}

function parseDmnJson(data: Record<string, unknown>): DmnDataset {
  const tablesRaw = Array.isArray(data.tables) ? data.tables : Array.isArray(data.decisions) ? data.decisions : null;
  if (!tablesRaw) throw new Error('DMN JSON is missing tables');
  const tables: DmnDecisionTable[] = [];
  const rules: DmnRule[] = [];
  const nodes: DmnDrdNode[] = [];
  tablesRaw.forEach((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const id = asString(row.id, `dt-${i + 1}`);
    const name = asString(row.name, `Decision ${i + 1}`);
    const hitPolicy = normalizeHitPolicy(asString(row.hitPolicy, 'UNIQUE'));
    const inputsRaw = Array.isArray(row.inputs) ? row.inputs : [];
    const outputsRaw = Array.isArray(row.outputs) ? row.outputs : [];
    const inputs: DmnClause[] = inputsRaw.map((c, ci) => {
      if (typeof c === 'string') return { id: `in-${ci + 1}`, label: c, expression: c, typeRef: '' };
      const rec = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
      return {
        id: asString(rec.id, `in-${ci + 1}`),
        label: asString(rec.label ?? rec.name, `Input ${ci + 1}`),
        expression: asString(rec.expression),
        typeRef: asString(rec.typeRef)
      };
    });
    const outputs: DmnClause[] = outputsRaw.map((c, ci) => {
      if (typeof c === 'string') return { id: `out-${ci + 1}`, label: c, expression: c, typeRef: '' };
      const rec = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
      return {
        id: asString(rec.id, `out-${ci + 1}`),
        label: asString(rec.label ?? rec.name, `Output ${ci + 1}`),
        expression: asString(rec.expression),
        typeRef: asString(rec.typeRef)
      };
    });
    const rulesRaw = Array.isArray(row.rules) ? row.rules : [];
    rulesRaw.forEach((r) => {
      const rec = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      const inVals = Array.isArray(rec.inputs) ? rec.inputs.map((v) => String(v)) : [asString(rec.when)];
      const outVals = Array.isArray(rec.outputs) ? rec.outputs.map((v) => String(v)) : [asString(rec.then)];
      rules.push({
        id: asString(rec.id, `r-${rules.length + 1}`),
        index: rules.length,
        tableId: id,
        tableName: name,
        hitPolicy,
        inputs: inVals,
        outputs: outVals,
        annotation: asString(rec.annotation)
      });
    });
    tables.push({ id, name, hitPolicy, inputs, outputs, ruleCount: rulesRaw.length });
    nodes.push({ id, name, kind: 'decision' });
  });
  const nodesRaw = Array.isArray(data.nodes) ? data.nodes : [];
  nodesRaw.forEach((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const id = asString(rec.id, `n-${i + 1}`);
    if (nodes.some((n) => n.id === id)) return;
    nodes.push({ id, name: asString(rec.name, id), kind: asString(rec.kind, 'input') });
  });
  const edgesRaw = Array.isArray(data.edges) ? data.edges : [];
  const edges: DmnDrdEdge[] = edgesRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `e-${i + 1}`),
      source: asString(rec.source),
      target: asString(rec.target),
      type: asString(rec.type, 'information')
    };
  });
  return finishDataset(asString(data.name, 'DMN snapshot'), 'json', asString(data.namespace), tables, rules, nodes, edges, []);
}

function parseDmnCsv(text: string): DmnDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('DMN CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const decI = idx('decision') >= 0 ? idx('decision') : idx('table') >= 0 ? idx('table') : idx('name');
  const inI = idx('inputs') >= 0 ? idx('inputs') : idx('when');
  const outI = idx('outputs') >= 0 ? idx('outputs') : idx('then');
  if (decI < 0 || inI < 0 || outI < 0) throw new Error('DMN CSV needs decision, inputs, and outputs columns');
  const policyI = idx('hit_policy') >= 0 ? idx('hit_policy') : idx('hitpolicy');
  const tables = new Map<string, DmnDecisionTable>();
  const rules: DmnRule[] = [];
  rows.slice(1).forEach((row) => {
    const tableName = row[decI] || 'Decision';
    const hitPolicy = normalizeHitPolicy(policyI >= 0 ? row[policyI] || 'UNIQUE' : 'UNIQUE');
    const rec =
      tables.get(tableName) ??
      { id: `dt-${tables.size + 1}`, name: tableName, hitPolicy, inputs: [], outputs: [], ruleCount: 0 };
    rec.ruleCount += 1;
    tables.set(tableName, rec);
    rules.push({
      id: `r-${rules.length + 1}`,
      index: rules.length,
      tableId: rec.id,
      tableName,
      hitPolicy,
      inputs: [(row[inI] || '-').replace(/\s*\/\s*/g, ' / ')],
      outputs: [row[outI] || '-'],
      annotation: ''
    });
  });
  const tableList = [...tables.values()];
  const nodes = tableList.map((t) => ({ id: t.id, name: t.name, kind: 'decision' }));
  return finishDataset('DMN CSV', 'csv', '', tableList, rules, nodes, [], []);
}

export function parseDmnText(text: string, fileName = ''): DmnDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('DMN file is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid DMN JSON');
    }
    if (!data || typeof data !== 'object') throw new Error('DMN JSON must be an object');
    return parseDmnJson(data as Record<string, unknown>);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (trimmed.includes(',') && /decision|table/i.test(trimmed.split('\n')[0] || '') && /input|when|output|then/i.test(trimmed.split('\n')[0] || ''))) {
    return parseDmnCsv(trimmed);
  }
  if (ext === 'dmn' || ext === 'xml' || /^</.test(trimmed)) return parseDmnXml(trimmed);
  throw new Error('No DMN model found — use .dmn, XML, JSON, or CSV');
}

export function parseDmnBytes(bytes: Uint8Array, fileName = ''): DmnDataset {
  if (!bytes.length) throw new Error('DMN file is empty');
  return parseDmnText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterDmnTables(tables: DmnDecisionTable[], query: string): DmnDecisionTable[] {
  const q = query.trim().toLowerCase();
  if (!q) return tables;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tables.filter((t) =>
    tokens.every((token) => {
      if (['unique', 'first', 'priority', 'any', 'collect'].includes(token)) return t.hitPolicy.toLowerCase().includes(token);
      if (token.startsWith('policy:')) return t.hitPolicy.toLowerCase().includes(token.slice(7));
      return `${t.id} ${t.name} ${t.hitPolicy}`.toLowerCase().includes(token);
    })
  );
}

export function filterDmnRules(rules: DmnRule[], query: string): DmnRule[] {
  const q = query.trim().toLowerCase();
  if (!q) return rules;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rules.filter((r) =>
    tokens.every((token) => {
      if (['unique', 'first', 'priority', 'any', 'collect'].includes(token)) return r.hitPolicy.toLowerCase().includes(token);
      if (token.startsWith('table:')) return r.tableName.toLowerCase().includes(token.slice(6)) || r.tableId.toLowerCase().includes(token.slice(6));
      const hay = `${r.tableName} ${r.hitPolicy} ${r.inputs.join(' ')} ${r.outputs.join(' ')} ${r.annotation}`.toLowerCase();
      return hay.includes(token);
    })
  );
}

export function filterDmnNodes(nodes: DmnDrdNode[], query: string): DmnDrdNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (['decision', 'input', 'knowledge'].includes(token)) return n.kind === token;
      if (token.startsWith('kind:')) return n.kind === token.slice(5);
      return `${n.id} ${n.name} ${n.kind}`.toLowerCase().includes(token);
    })
  );
}
