import type { DtDataset, DtEdge, DtNode, DtNodeKind, DtSourceKind } from '../types/decision-tree-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:decision-tree|decisiontree|tree|node|branch|leaf|edge)\b/i.test(text);
}

function looksLikeCsv(text: string): boolean {
  const first = text.trim().split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')) || '';
  const header = first.toLowerCase();
  return header.includes(',') && (/(?:^|,)(?:id|kind|feature|parent|source|from)(?:$|,)/.test(header) || header.includes('threshold'));
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:json|xml|csv|tree|decision)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) return { source: fence[1].trim(), fenced: true };
  return { source: text.trim(), fenced: false };
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

function slug(value: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'node';
}

function looksLikeTest(text: string): boolean {
  return /<=|>=|==|!=|<|>|\bin\b/i.test(text);
}

function parseTest(text: string): { feature: string; operator: string; threshold: string } {
  const m = /^(.+?)\s*(<=|>=|==|!=|<|>)\s*(.+)$/.exec(text.trim());
  if (m) return { feature: m[1].trim(), operator: m[2], threshold: m[3].trim() };
  return { feature: text.trim(), operator: '', threshold: '' };
}

function normalizeKind(raw: string, fallback: DtNodeKind = 'branch'): DtNodeKind {
  const k = raw.toLowerCase();
  if (k === 'root' || k === 'start') return 'root';
  if (k === 'leaf' || k === 'class' || k === 'outcome' || k === 'value') return 'leaf';
  if (k === 'branch' || k === 'decision' || k === 'split' || k === 'internal') return 'branch';
  return fallback;
}

function upsertNode(
  nodes: DtNode[],
  next: {
    id: string;
    name?: string;
    kind?: DtNodeKind;
    feature?: string;
    operator?: string;
    threshold?: string;
    value?: string;
    samples?: string;
  }
): DtNode {
  const existing = nodes.find((n) => n.id === next.id || n.name === next.name);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind && next.kind !== 'branch') existing.kind = next.kind;
    if (next.feature) existing.feature = next.feature;
    if (next.operator) existing.operator = next.operator;
    if (next.threshold) existing.threshold = next.threshold;
    if (next.value) existing.value = next.value;
    if (next.samples) existing.samples = next.samples;
    return existing;
  }
  const kind = next.kind || (next.value && !next.feature ? 'leaf' : 'branch');
  const name =
    next.name ||
    (kind === 'leaf' ? next.value || next.id : next.feature ? `${next.feature}${next.operator ? ` ${next.operator} ${next.threshold}` : ''}` : next.id);
  const created: DtNode = {
    id: next.id,
    index: nodes.length,
    name,
    kind,
    feature: next.feature || '',
    operator: next.operator || '',
    threshold: next.threshold || '',
    value: next.value || '',
    samples: next.samples || '',
    x: 0,
    y: 0,
    depth: 0
  };
  nodes.push(created);
  return created;
}

function addEdge(edges: DtEdge[], source: string, target: string, label = '', sourceName = '', targetName = ''): void {
  if (!source || !target || source === target) return;
  if (edges.some((e) => e.source === source && e.target === target && e.label === label)) return;
  edges.push({
    id: `e-${edges.length + 1}`,
    index: edges.length,
    source,
    target,
    sourceName: sourceName || source,
    targetName: targetName || target,
    label: label || ''
  });
}

function layoutTree(nodes: DtNode[], edges: DtEdge[], root: string): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const e of edges) {
    outgoing.get(e.source)?.push(e.target);
    incoming.get(e.target)?.push(e.source);
  }
  const rank = new Map<string, number>();
  const startIds =
    root && nodes.some((n) => n.id === root)
      ? [root]
      : nodes.filter((n) => n.kind === 'root').map((n) => n.id);
  const starts = startIds.length ? startIds : nodes.filter((n) => !(incoming.get(n.id)?.length)).map((n) => n.id);
  (starts.length ? starts : nodes.slice(0, 1).map((n) => n.id)).forEach((id) => rank.set(id, 0));
  const queue = [...rank.keys()];
  while (queue.length) {
    const id = queue.shift() as string;
    const r = rank.get(id) ?? 0;
    for (const next of outgoing.get(id) ?? []) {
      if (!rank.has(next)) {
        rank.set(next, r + 1);
        queue.push(next);
      }
    }
  }
  const buckets = new Map<number, DtNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    n.depth = r;
    const list = buckets.get(r) ?? [];
    list.push(n);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((n, i) => {
      n.x = 48 + r * 200;
      n.y = 40 + i * 110;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: DtSourceKind,
  title: string,
  root: string,
  nodes: DtNode[],
  edges: DtEdge[],
  warnings: string[]
): DtDataset {
  if (!nodes.length) throw new Error('Decision tree contains no nodes');
  let rootId = root;
  if (rootId) {
    const found = upsertNode(nodes, { id: rootId, name: rootId, kind: 'root' });
    rootId = found.id;
  } else {
    const marked = nodes.find((n) => n.kind === 'root');
    const incoming = new Set(edges.map((e) => e.target));
    const start = marked || nodes.find((n) => n.kind !== 'leaf' && !incoming.has(n.id)) || nodes.find((n) => !incoming.has(n.id));
    rootId = start?.id || nodes[0]?.id || '';
    if (start && start.kind === 'branch') start.kind = 'root';
  }
  const byId = new Map(nodes.map((n) => [n.id, n.name]));
  const byName = new Map(nodes.map((n) => [n.name.toLowerCase(), n.id]));
  for (const e of edges) {
    if (!byId.has(e.source)) e.source = byName.get(e.source.toLowerCase()) || e.source;
    if (!byId.has(e.target)) e.target = byName.get(e.target.toLowerCase()) || e.target;
    e.sourceName = byId.get(e.source) || e.sourceName || e.source;
    e.targetName = byId.get(e.target) || e.targetName || e.target;
  }
  layoutTree(nodes, edges, rootId);
  nodes.forEach((n, i) => (n.index = i));
  edges.forEach((e, i) => (e.index = i));
  const branches = nodes.filter((n) => n.kind !== 'leaf');
  const leaves = nodes.filter((n) => n.kind === 'leaf');
  if (!leaves.length) warnings.push('No leaf outcomes found — all nodes look like branches');
  return { name, sourceKind, title: title || name, root: rootId, nodes, branches, leaves, edges, warnings };
}

function ingestFlatNode(nodes: DtNode[], row: Record<string, unknown>): void {
  const value = asString(row.value || row.class || row.prediction || row.outcome);
  const feature = asString(row.feature || row.attribute || row.split);
  const id = asString(row.id || row.name || (value && !feature ? value : feature));
  if (!id) return;
  const kind = normalizeKind(asString(row.kind || row.type), value && !feature ? 'leaf' : 'branch');
  upsertNode(nodes, {
    id,
    name: asString(row.name || row.label || (kind === 'leaf' ? value : feature ? `${feature} ${asString(row.operator || row.op, '<=')} ${asString(row.threshold)}` : id)),
    kind,
    feature,
    operator: asString(row.operator || row.op, feature ? '<=' : ''),
    threshold: asString(row.threshold ?? row.splitValue ?? ''),
    value,
    samples: asString(row.samples || row.n || row.count)
  });
}

function ingestEdgeRow(nodes: DtNode[], edges: DtEdge[], row: Record<string, unknown>): void {
  const source = asString(row.source || row.from || row.parent || row.start);
  const target = asString(row.target || row.to || row.child || row.end || row.id);
  if (!source || !target) return;
  upsertNode(nodes, { id: source, name: asString(row.sourceName || row.fromName, source) });
  const targetKindRaw = asString(row.targetKind || row.toKind);
  upsertNode(nodes, {
    id: target,
    name: asString(row.targetName || row.toName, target),
    kind: targetKindRaw ? normalizeKind(targetKindRaw) : undefined
  });
  addEdge(edges, source, target, asString(row.label || row.edge || row.rel || row.yesno));
}

function ingestNested(
  nodes: DtNode[],
  edges: DtEdge[],
  raw: unknown,
  parentId: string,
  edgeLabel: string,
  isRoot: boolean
): string {
  if (raw == null) return '';
  if (typeof raw === 'string' || typeof raw === 'number') {
    const value = String(raw);
    const id = slug(value);
    upsertNode(nodes, { id, name: value, kind: 'leaf', value });
    if (parentId) addEdge(edges, parentId, id, edgeLabel);
    return id;
  }
  const row = rec(raw);
  const value = asString(row.value || row.class || row.prediction || row.outcome);
  const feature = asString(row.feature || row.attribute || row.split);
  const op = asString(row.operator || row.op, feature ? '<=' : '');
  const threshold = asString(row.threshold ?? row.splitValue ?? '');
  const kind: DtNodeKind = value && !feature ? 'leaf' : isRoot ? 'root' : 'branch';
  const name = kind === 'leaf' ? value : feature ? `${feature}${op ? ` ${op} ${threshold}` : ''}` : asString(row.name || row.id);
  const id = asString(row.id) || slug(name || `n${nodes.length}`);
  upsertNode(nodes, { id, name, kind, feature, operator: op, threshold, value, samples: asString(row.samples) });
  if (parentId) addEdge(edges, parentId, id, edgeLabel);
  const left = row.left ?? row.yes ?? row.true;
  const right = row.right ?? row.no ?? row.false;
  if (left != null) ingestNested(nodes, edges, left, id, asString(row.leftLabel || row.yesLabel, 'yes'), false);
  if (right != null) ingestNested(nodes, edges, right, id, asString(row.rightLabel || row.noLabel, 'no'), false);
  const children = Array.isArray(row.children) ? row.children : Array.isArray(row.nodes) ? [] : [];
  children.forEach((child, i) => {
    const c = rec(child);
    ingestNested(nodes, edges, child, id, asString(c.edge || c.label || c.rel, i === 0 ? 'yes' : 'no'), false);
  });
  return id;
}

function parseJson(raw: unknown, fileName: string): DtDataset {
  const rootObj = rec(Array.isArray(raw) ? { nodes: raw } : raw);
  const wrapped = rec(rootObj.tree || rootObj.decisionTree || rootObj.model);
  const body = Object.keys(wrapped).length ? { ...rootObj, ...wrapped } : rootObj;
  const name = asString(body.name || body.title, fileName.replace(/\.[^.]+$/, '') || 'Decision tree');
  const nodes: DtNode[] = [];
  const edges: DtEdge[] = [];
  const nodeList = Array.isArray(body.nodes) ? body.nodes : Array.isArray(body.branches) ? body.branches : [];
  const edgeList = Array.isArray(body.edges) ? body.edges : Array.isArray(body.links) ? body.links : [];
  const leafList = Array.isArray(body.leaves) ? body.leaves : [];
  if (nodeList.length || leafList.length) {
    for (const item of nodeList) ingestFlatNode(nodes, rec(item));
    for (const item of leafList) ingestFlatNode(nodes, { ...rec(item), kind: 'leaf' });
    for (const item of edgeList) ingestEdgeRow(nodes, edges, rec(item));
  } else if (asString(body.feature) || asString(body.value) || body.left != null || body.right != null) {
    ingestNested(nodes, edges, body, '', '', true);
  }
  if (!nodes.length) throw new Error('Decision tree JSON contains no nodes');
  return finishDataset(name, 'json', asString(body.title || body.name, name), asString(body.root || body.rootId), nodes, edges, []);
}

function parseXml(xml: string, fileName: string): DtDataset {
  const rootTag = /<(?:decision-tree|decisiontree|tree)\b([^>]*)>/i.exec(xml);
  const ra = attrs(rootTag?.[1] || '');
  const name = ra.name || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Decision tree';
  const nodes: DtNode[] = [];
  const edges: DtEdge[] = [];
  const nodeRe =
    /<(?:[\w.-]+:)?(?:node|branch|leaf)\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/>|<(?:[\w.-]+:)?(?:node|branch|leaf)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:node|branch|leaf)>/gi;
  let match: RegExpExecArray | null;
  while ((match = nodeRe.exec(xml))) {
    const tag = match[0];
    const a = attrs(match[1] || match[2] || '');
    const id = a.id || a.name || '';
    if (!id) continue;
    const tagKind = /<(?:[\w.-]+:)?(node|branch|leaf)\b/i.exec(tag)?.[1]?.toLowerCase() || 'node';
    const kind = normalizeKind(a.kind || a.type || tagKind, tagKind === 'leaf' ? 'leaf' : tagKind === 'branch' ? 'branch' : 'branch');
    upsertNode(nodes, {
      id,
      name: a.name || a.label || (kind === 'leaf' ? a.value || id : a.feature ? `${a.feature} ${a.operator || '<='} ${a.threshold || ''}` : id),
      kind: kind === 'branch' && a.kind === 'root' ? 'root' : kind,
      feature: a.feature || a.attribute || '',
      operator: a.operator || a.op || '',
      threshold: a.threshold || '',
      value: a.value || a.class || '',
      samples: a.samples || ''
    });
  }
  const edgeRe =
    /<(?:[\w.-]+:)?(?:edge|link|branch-edge)\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/>|<(?:[\w.-]+:)?(?:edge|link)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:edge|link)>/gi;
  while ((match = edgeRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const source = a.source || a.from || a.parent || '';
    const target = a.target || a.to || a.child || '';
    if (!source || !target) continue;
    upsertNode(nodes, { id: source, name: source });
    upsertNode(nodes, { id: target, name: target });
    addEdge(edges, source, target, a.label || a.edge || a.rel || '');
  }
  if (!nodes.length) throw new Error('Decision tree XML contains no nodes');
  return finishDataset(name, 'xml', name, ra.root || ra.rootid || '', nodes, edges, []);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') inQ = false;
      else cur += ch;
      continue;
    }
    if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text: string, fileName: string): DtDataset {
  const nodes: DtNode[] = [];
  const edges: DtEdge[] = [];
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const ingestTable = (block: string): void => {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    if (lines.length < 2) return;
    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const idx = (name: string): number => header.indexOf(name);
    const isEdge = (idx('source') >= 0 || idx('from') >= 0) && (idx('target') >= 0 || idx('to') >= 0) && idx('id') < 0;
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);
      const get = (name: string, fallback = ''): string => {
        const i = idx(name);
        return i >= 0 ? cols[i] || fallback : fallback;
      };
      if (isEdge) {
        ingestEdgeRow(nodes, edges, {
          source: get('source') || get('from'),
          target: get('target') || get('to'),
          label: get('label') || get('edge') || get('rel')
        });
        continue;
      }
      const id = get('id') || get('name');
      if (!id) continue;
      ingestFlatNode(nodes, {
        id,
        name: get('name', id),
        kind: get('kind') || get('type'),
        feature: get('feature') || get('attribute'),
        operator: get('operator') || get('op'),
        threshold: get('threshold'),
        value: get('value') || get('class'),
        samples: get('samples')
      });
      const parent = get('parent') || get('from') || get('source');
      if (parent) addEdge(edges, parent, id, get('edge') || get('label') || get('rel'));
    }
  };
  if (blocks.length) blocks.forEach(ingestTable);
  else ingestTable(text);
  if (!nodes.length) throw new Error('Decision tree CSV contains no nodes');
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Decision tree';
  return finishDataset(fromFile, 'csv', fromFile, '', nodes, edges, []);
}

function splitArrowPath(line: string): { parts: string[]; labels: string[] } {
  const parts: string[] = [];
  const labels: string[] = [];
  let rest = line.trim();
  const re = /\s*(?:--([^-]+)?-->|-->)\s*/;
  while (rest) {
    const m = re.exec(rest);
    if (!m) {
      parts.push(rest.trim());
      break;
    }
    parts.push(rest.slice(0, m.index).trim());
    labels.push((m[1] || '').trim());
    rest = rest.slice(m.index + m[0].length);
  }
  return { parts: parts.filter(Boolean), labels };
}

function ingestLabeledNode(nodes: DtNode[], label: string, forceLeaf: boolean): DtNode {
  if (forceLeaf || (!looksLikeTest(label) && !/^if\s+/i.test(label))) {
    const id = slug(label);
    return upsertNode(nodes, { id, name: label, kind: 'leaf', value: label });
  }
  const test = parseTest(label.replace(/^if\s+/i, ''));
  const name = test.feature ? `${test.feature}${test.operator ? ` ${test.operator} ${test.threshold}` : ''}` : label;
  const id = slug(name);
  return upsertNode(nodes, {
    id,
    name,
    kind: 'branch',
    feature: test.feature,
    operator: test.operator,
    threshold: test.threshold
  });
}

function parseMarkdownList(text: string, fileName: string, sourceKind: DtSourceKind): DtDataset {
  const nodes: DtNode[] = [];
  const edges: DtEdge[] = [];
  let name = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Decision tree';
  const stack: Array<{ indent: number; id: string; yesUsed: boolean }> = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('```')) continue;
    const heading = /^#\s+(.+)$/.exec(trimmed);
    if (heading) {
      name = heading[1].trim();
      continue;
    }
    const oneLine = /^if\s+(.+?)\s+then\s+(.+?)\s+else\s+(.+)$/i.exec(trimmed);
    if (oneLine) {
      const branch = ingestLabeledNode(nodes, oneLine[1], false);
      const yes = ingestLabeledNode(nodes, oneLine[2], true);
      const no = ingestLabeledNode(nodes, oneLine[3], true);
      addEdge(edges, branch.id, yes.id, 'yes');
      addEdge(edges, branch.id, no.id, 'no');
      continue;
    }
    if (/-->/.test(trimmed)) {
      const { parts, labels } = splitArrowPath(trimmed);
      for (let i = 0; i < parts.length; i++) {
        const node = ingestLabeledNode(nodes, parts[i], i === parts.length - 1 && !looksLikeTest(parts[i]));
        if (i > 0) addEdge(edges, slug(parts[i - 1].replace(/^if\s+/i, '')), node.id, labels[i - 1] || '');
      }
      continue;
    }
    const indent = rawLine.match(/^(\s*)/)?.[1].replace(/\t/g, '  ').length ?? 0;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const elseLine = /^else(?:\s*:\s*(.+))?$/i.exec(trimmed);
    if (elseLine) {
      const parent = stack[stack.length - 1];
      if (elseLine[1]) {
        const leaf = ingestLabeledNode(nodes, elseLine[1].trim(), true);
        if (parent) addEdge(edges, parent.id, leaf.id, 'no');
      } else if (parent) parent.yesUsed = true;
      continue;
    }
    const colon = /^(.+?)\s*:\s*(.+)$/.exec(trimmed);
    if (colon && !looksLikeTest(colon[2])) {
      const left = colon[1].trim();
      const right = colon[2].trim();
      const parent = stack[stack.length - 1];
      const label = parent?.yesUsed ? 'no' : 'yes';
      if (parent) parent.yesUsed = true;
      if (looksLikeTest(left) || /^if\s+/i.test(left)) {
        const branch = ingestLabeledNode(nodes, left.replace(/^if\s+/i, ''), false);
        const leaf = ingestLabeledNode(nodes, right, true);
        if (parent) addEdge(edges, parent.id, branch.id, label);
        addEdge(edges, branch.id, leaf.id, 'yes');
        stack.push({ indent, id: branch.id, yesUsed: true });
      } else {
        const leaf = ingestLabeledNode(nodes, right, true);
        if (parent) addEdge(edges, parent.id, leaf.id, label);
      }
      continue;
    }
    const testLine = trimmed.replace(/^if\s+/i, '');
    if (looksLikeTest(testLine) || /^if\s+/i.test(trimmed)) {
      const branch = ingestLabeledNode(nodes, testLine, false);
      const parent = stack[stack.length - 1];
      const label = parent?.yesUsed ? 'no' : 'yes';
      if (parent) {
        addEdge(edges, parent.id, branch.id, label);
        parent.yesUsed = true;
      }
      stack.push({ indent, id: branch.id, yesUsed: false });
    }
  }

  if (!nodes.length) throw new Error('Decision tree contains no nodes');
  return finishDataset(name, sourceKind, name, '', nodes, edges, []);
}

export function parseDecisionTreeText(text: string, fileName = ''): DtDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Decision tree file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid decision tree JSON');
    }
    return parseJson(parsed, fileName);
  }
  if (looksLikeXml(raw) || ext === 'xml') {
    return parseXml(raw, fileName);
  }
  if (ext === 'csv' || looksLikeCsv(raw)) {
    return parseCsv(raw, fileName);
  }
  const extracted = extractFence(raw);
  const sourceKind: DtSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : 'txt';
  if (/-->|^if\s+/im.test(extracted.source) || /^#\s+/m.test(extracted.source) || /:\s+\S+/.test(extracted.source)) {
    return parseMarkdownList(extracted.source, fileName, sourceKind);
  }
  throw new Error('Not a decision tree');
}

export function parseDecisionTreeBytes(bytes: Uint8Array, fileName = ''): DtDataset {
  if (!bytes.length) throw new Error('Decision tree file is empty');
  return parseDecisionTreeText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterDtBranches(nodes: DtNode[], query: string): DtNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('branch:') || token.startsWith('node:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return n.name.toLowerCase().includes(needle) || n.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('kind:')) return n.kind === token.slice(5);
      if (token.startsWith('feature:')) return n.feature.toLowerCase().includes(token.slice(8));
      return `${n.id} ${n.name} ${n.kind} ${n.feature} ${n.operator} ${n.threshold} ${n.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterDtLeaves(nodes: DtNode[], query: string): DtNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('leaf:') || token.startsWith('value:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return n.name.toLowerCase().includes(needle) || n.value.toLowerCase().includes(needle) || n.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('kind:')) return n.kind === token.slice(5);
      return `${n.id} ${n.name} ${n.value} ${n.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterDtEdges(edges: DtEdge[], query: string): DtEdge[] {
  const q = query.trim().toLowerCase();
  if (!q) return edges;
  const tokens = q.split(/\s+/).filter(Boolean);
  return edges.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('from:')) return e.sourceName.toLowerCase().includes(token.slice(5)) || e.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return e.targetName.toLowerCase().includes(token.slice(3)) || e.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('label:') || token.startsWith('edge:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return e.label.toLowerCase().includes(needle);
      }
      return `${e.source} ${e.target} ${e.sourceName} ${e.targetName} ${e.label}`.toLowerCase().includes(token);
    })
  );
}
