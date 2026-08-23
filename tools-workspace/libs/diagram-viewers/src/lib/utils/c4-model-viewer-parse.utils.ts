import type {
  C4Dataset,
  C4Element,
  C4ElementKind,
  C4Level,
  C4Relation,
  C4SourceKind
} from '../types/c4-model-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:c4|element|relation)\b/i.test(text);
}

function looksLikeDsl(text: string): boolean {
  return /\bworkspace\b/i.test(text) && /\bmodel\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:uml|plantuml|puml|c4|structurizr|dsl)?\s*([\s\S]*?)```/i.exec(text);
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

function splitCsvArgs(inner: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      if (ch === quote) quote = '';
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function kindFromName(raw: string): C4ElementKind {
  const v = raw.trim().toLowerCase();
  if (v === 'person' || v === 'person_ext') return 'person';
  if (v === 'container' || v === 'container_ext' || v === 'containerdb' || v === 'containerqueue') return 'container';
  if (v === 'component' || v === 'component_ext' || v === 'componentdb') return 'component';
  if (v === 'boundary' || v === 'system_boundary' || v === 'enterprise_boundary') return 'boundary';
  return 'system';
}

function kindFromFn(fn: string): C4ElementKind {
  const f = fn.toLowerCase();
  if (f.startsWith('person')) return 'person';
  if (f.includes('boundary') || f === 'boundary') return 'boundary';
  if (f.startsWith('container')) return 'container';
  if (f.startsWith('component')) return 'component';
  return 'system';
}

function upsertElement(
  elements: C4Element[],
  next: Partial<C4Element> & { id: string; name: string; kind: C4ElementKind }
): C4Element {
  const existing = elements.find((e) => e.id === next.id);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind && next.kind !== 'system') existing.kind = next.kind;
    if (next.stereotype) existing.stereotype = next.stereotype;
    if (next.technology) existing.technology = next.technology;
    if (next.description) existing.description = next.description;
    if (next.parent && !existing.parent) existing.parent = next.parent;
    return existing;
  }
  const created: C4Element = {
    id: next.id,
    index: elements.length,
    name: next.name,
    kind: next.kind,
    stereotype: next.stereotype || '',
    technology: next.technology || '',
    description: next.description || '',
    parent: next.parent || '',
    x: 0,
    y: 0
  };
  elements.push(created);
  return created;
}

function layoutElements(elements: C4Element[], relations: C4Relation[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const e of elements) {
    incoming.set(e.id, []);
    outgoing.set(e.id, []);
  }
  for (const r of relations) {
    outgoing.get(r.source)?.push(r.target);
    incoming.get(r.target)?.push(r.source);
  }
  const rank = new Map<string, number>();
  const starts = elements.filter((e) => !(incoming.get(e.id)?.length)).map((e) => e.id);
  (starts.length ? starts : elements.slice(0, 1).map((e) => e.id)).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, C4Element[]>();
  for (const e of elements) {
    const r = rank.get(e.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(e);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((e, i) => {
      e.x = 56 + r * 170;
      e.y = 48 + i * 92;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: C4SourceKind,
  title: string,
  elements: C4Element[],
  relations: C4Relation[],
  warnings: string[]
): C4Dataset {
  const nameById = new Map(elements.map((e) => [e.id, e.name] as const));
  relations.forEach((r, i) => {
    r.index = i;
    r.sourceName = nameById.get(r.source) || r.source;
    r.targetName = nameById.get(r.target) || r.target;
  });
  elements.forEach((e, i) => {
    e.index = i;
  });
  layoutElements(elements, relations);
  const hasContext = elements.some((e) => e.kind === 'person' || e.kind === 'system' || e.kind === 'boundary');
  const hasContainer = elements.some((e) => e.kind === 'container');
  const hasComponent = elements.some((e) => e.kind === 'component');
  let level: C4Level = 'context';
  if (hasComponent && !hasContainer && !hasContext) level = 'component';
  else if (hasContainer && !hasComponent && !hasContext) level = 'container';
  else if ((hasContainer || hasComponent) && hasContext) level = 'mixed';
  else if (hasContainer && hasComponent) level = 'mixed';
  else if (hasContainer) level = 'container';
  else if (hasComponent) level = 'component';
  if (!elements.length) warnings.push('C4 model contains no elements.');
  if (!relations.length && elements.length) warnings.push('C4 model has elements but no relations.');
  return { name, sourceKind, title: title || name, level, elements, relations, warnings };
}

function parseC4Call(line: string): { fn: string; args: string[] } | null {
  const m =
    /^(Person(?:_Ext)?|System(?:Db|_Ext)?|Container(?:Db|Queue|_Ext)?|Component(?:Db|_Ext)?|Enterprise_Boundary|System_Boundary|Container_Boundary|Boundary|Rel(?:_[A-Za-z]+)?)\(\s*(.*)\)\s*$/i.exec(
      line
    );
  if (!m) return null;
  return { fn: m[1], args: splitCsvArgs(m[2]) };
}

function parseXml(xml: string, fileName: string): C4Dataset {
  const root = /<c4\b([^>]*)>/i.exec(xml);
  const name = attrs(root?.[1] || '').name || fileName.replace(/\.[^.]+$/, '') || 'C4 model';
  const elements: C4Element[] = [];
  const relations: C4Relation[] = [];
  for (const m of xml.matchAll(/<element\b([^>]*)\/?>/gi)) {
    const a = attrs(m[1] || '');
    const id = a.id || a.name || `e-${elements.length + 1}`;
    upsertElement(elements, {
      id,
      name: a.name || id,
      kind: kindFromName(a.kind || 'system'),
      stereotype: a.stereotype || '',
      technology: a.technology || '',
      description: a.description || '',
      parent: a.parent || ''
    });
  }
  for (const m of xml.matchAll(/<relation\b([^>]*)\/?>/gi)) {
    const a = attrs(m[1] || '');
    const source = a.source || a.from || '';
    const target = a.target || a.to || '';
    if (!source || !target) continue;
    upsertElement(elements, { id: source, name: source, kind: 'system' });
    upsertElement(elements, { id: target, name: target, kind: 'system' });
    relations.push({
      id: `r-${relations.length + 1}`,
      index: relations.length,
      source,
      target,
      sourceName: '',
      targetName: '',
      label: a.label || a.name || '',
      technology: a.technology || ''
    });
  }
  if (!elements.length) throw new Error('C4 XML contains no elements');
  return finishDataset(name, 'xml', name, elements, relations, []);
}

function parseJson(text: string, fileName: string): C4Dataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid C4 JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('C4 JSON must be an object');
  const elRaw = (Array.isArray(obj.elements) ? obj.elements : Array.isArray(obj.nodes) ? obj.nodes : []) as unknown[];
  if (!elRaw.length) throw new Error('C4 JSON is missing elements');
  const elements: C4Element[] = elRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `e-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.label, asString(rec.id, `e-${i + 1}`)),
      kind: kindFromName(asString(rec.kind || rec.type, 'system')),
      stereotype: asString(rec.stereotype),
      technology: asString(rec.technology || rec.tech),
      description: asString(rec.description || rec.desc),
      parent: asString(rec.parent || rec.group),
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const relRaw = (Array.isArray(obj.relations) ? obj.relations : Array.isArray(obj.links) ? obj.links : []) as unknown[];
  const relations: C4Relation[] = relRaw
    .map((item, i) => {
      const rec = (item ?? {}) as Record<string, unknown>;
      return {
        id: asString(rec.id, `r-${i + 1}`),
        index: i,
        source: asString(rec.source || rec.from),
        target: asString(rec.target || rec.to),
        sourceName: '',
        targetName: '',
        label: asString(rec.label),
        technology: asString(rec.technology || rec.tech)
      };
    })
    .filter((r) => r.source && r.target);
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'C4 JSON'),
    'json',
    asString(obj.title),
    elements,
    relations,
    []
  );
}

function parsePlantC4(source: string, fileName: string, sourceKind: C4SourceKind): C4Dataset {
  const warnings: string[] = [];
  let title = '';
  const lines = source
    .replace(/\/'[\s\S]*?'\//g, '\n')
    .split(/\r?\n/)
    .map((l) => l.replace(/'.*$/, '').trim())
    .filter((l) => l && !/^@(start|end)uml\b/i.test(l) && !/^skinparam\b|^hide\b|^show\b/i.test(l));
  const elements: C4Element[] = [];
  const relations: C4Relation[] = [];
  for (const line of lines) {
    if (/^!include\b/i.test(line)) {
      warnings.push('Includes are preview-only and are not fetched.');
      continue;
    }
    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      title = unquote(titleMatch[1]);
      continue;
    }
    const c4 = parseC4Call(line);
    if (!c4) {
      warnings.push(`Skipped line: ${line}`);
      continue;
    }
    if (/^Rel/i.test(c4.fn)) {
      const sourceId = unquote(c4.args[0] || '');
      const targetId = unquote(c4.args[1] || '');
      const label = unquote(c4.args[2] || '');
      const technology = unquote(c4.args[3] || '');
      if (!sourceId || !targetId) continue;
      upsertElement(elements, { id: sourceId, name: sourceId, kind: 'system' });
      upsertElement(elements, { id: targetId, name: targetId, kind: 'system' });
      relations.push({
        id: `r-${relations.length + 1}`,
        index: relations.length,
        source: sourceId,
        target: targetId,
        sourceName: '',
        targetName: '',
        label,
        technology
      });
      continue;
    }
    const kind = kindFromFn(c4.fn);
    const stereo = /_Ext$/i.test(c4.fn) ? 'external' : /Db$/i.test(c4.fn) ? 'db' : /Queue$/i.test(c4.fn) ? 'queue' : '';
    const id = unquote(c4.args[0] || `e-${elements.length + 1}`);
    const name = unquote(c4.args[1] || id);
    const technology = kind === 'container' || kind === 'component' ? unquote(c4.args[2] || '') : '';
    const description = unquote(c4.args[kind === 'container' || kind === 'component' ? 3 : 2] || '');
    upsertElement(elements, { id, name, kind, stereotype: stereo, technology, description });
  }
  const fallback = title || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'C4 model';
  return finishDataset(fallback, sourceKind, title, elements, relations, warnings);
}

function parseDsl(source: string, fileName: string): C4Dataset {
  const warnings: string[] = [];
  const elements: C4Element[] = [];
  const relations: C4Relation[] = [];
  let title = '';
  const ws = /workspace\s+"([^"]+)"/i.exec(source);
  if (ws) title = ws[1];
  const modelBlock = /model\s*\{([\s\S]*)\}\s*(?:views\s*\{[\s\S]*\})?\s*\}?\s*$/i.exec(source) || /model\s*\{([\s\S]*)\}/i.exec(source);
  const body = modelBlock ? modelBlock[1] : source;
  const tokens = body
    .replace(/#[^\n]*/g, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const stack: string[] = [];
  for (const line of tokens) {
    if (line === '}') {
      stack.pop();
      continue;
    }
    const rel = /^([A-Za-z][\w-]*)\s*->\s*([A-Za-z][\w-]*)(?:\s+"([^"]*)")?$/.exec(line);
    if (rel) {
      upsertElement(elements, { id: rel[1], name: rel[1], kind: 'system' });
      upsertElement(elements, { id: rel[2], name: rel[2], kind: 'system' });
      relations.push({
        id: `r-${relations.length + 1}`,
        index: relations.length,
        source: rel[1],
        target: rel[2],
        sourceName: '',
        targetName: '',
        label: rel[3] || '',
        technology: ''
      });
      continue;
    }
    const decl =
      /^([A-Za-z][\w-]*)\s*=\s*(person|softwareSystem|container|component)\s+"([^"]+)"(?:\s+"([^"]*)")?\s*(\{)?$/i.exec(
        line
      );
    if (decl) {
      const kindRaw = decl[2].toLowerCase();
      const kind: C4ElementKind =
        kindRaw === 'person' ? 'person' : kindRaw === 'container' ? 'container' : kindRaw === 'component' ? 'component' : 'system';
      upsertElement(elements, {
        id: decl[1],
        name: decl[3],
        kind,
        description: decl[4] || '',
        parent: stack[stack.length - 1] || ''
      });
      if (decl[5]) stack.push(decl[1]);
      continue;
    }
    if (/^(views|styles|properties)\b/i.test(line)) continue;
    warnings.push(`Skipped line: ${line}`);
  }
  const name = title || fileName.replace(/\.[^.]+$/, '') || 'C4 workspace';
  return finishDataset(name, 'dsl', title, elements, relations, warnings);
}

export function parseC4Text(text: string, fileName = ''): C4Dataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('C4 file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  if (looksLikeXml(raw) || (ext === 'xml' && looksLikeXml(raw))) return parseXml(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: C4SourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'dsl' || looksLikeDsl(extracted.source) ? 'dsl' : ext === 'txt' ? 'txt' : 'puml';
  if (looksLikeDsl(extracted.source) || ext === 'dsl') {
    const parsed = parseDsl(extracted.source, fileName);
    if (!parsed.elements.length) throw new Error('C4 model contains no elements');
    return parsed;
  }
  if (
    /@startuml\b/i.test(extracted.source) ||
    /\b(Person|System|Container|Component|Rel)\s*\(/i.test(extracted.source)
  ) {
    const parsed = parsePlantC4(extracted.source, fileName, sourceKind);
    if (!parsed.elements.length) throw new Error('C4 model contains no elements');
    return parsed;
  }
  throw new Error('Not a C4 model');
}

export function parseC4Bytes(bytes: Uint8Array, fileName = ''): C4Dataset {
  if (!bytes.length) throw new Error('C4 file is empty');
  return parseC4Text(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterC4Elements(
  elements: C4Element[],
  query: string,
  view: 'all' | 'context' | 'container' | 'component' = 'all'
): C4Element[] {
  let list = elements;
  if (view === 'context') list = list.filter((e) => e.kind === 'person' || e.kind === 'system' || e.kind === 'boundary');
  if (view === 'container') list = list.filter((e) => e.kind === 'container');
  if (view === 'component') list = list.filter((e) => e.kind === 'component');
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('kind:')) return e.kind === token.slice(5);
      if (token.startsWith('tech:')) return e.technology.toLowerCase().includes(token.slice(5));
      if (token.startsWith('el:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return e.name.toLowerCase().includes(needle) || e.id.toLowerCase().includes(needle);
      }
      return `${e.id} ${e.name} ${e.kind} ${e.stereotype} ${e.technology} ${e.description} ${e.parent}`.toLowerCase().includes(token);
    })
  );
}

export function filterC4Relations(relations: C4Relation[], query: string): C4Relation[] {
  const q = query.trim().toLowerCase();
  if (!q) return relations;
  const tokens = q.split(/\s+/).filter(Boolean);
  return relations.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('rel:') || token.startsWith('label:')) return r.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return r.sourceName.toLowerCase().includes(token.slice(5)) || r.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return r.targetName.toLowerCase().includes(token.slice(3)) || r.target.toLowerCase().includes(token.slice(3));
      return `${r.source} ${r.target} ${r.sourceName} ${r.targetName} ${r.label} ${r.technology}`.toLowerCase().includes(token);
    })
  );
}
