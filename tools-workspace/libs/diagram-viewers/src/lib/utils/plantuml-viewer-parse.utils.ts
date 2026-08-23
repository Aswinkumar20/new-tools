import type {
  PumlDataset,
  PumlElement,
  PumlElementKind,
  PumlKind,
  PumlRelation,
  PumlRelationStyle,
  PumlSourceKind
} from '../types/plantuml-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

function extractPlantUmlSource(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:plantuml|puml)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) return { source: fence[1].trim(), fenced: true };
  return { source: text.trim(), fenced: false };
}

function stripPlantUmlNoise(source: string): { body: string; title: string; warnings: string[] } {
  const warnings: string[] = [];
  let title = '';
  const withoutBlock = source.replace(/\/'[\s\S]*?'\//g, '\n');
  const lines: string[] = [];
  for (const raw of withoutBlock.split(/\r?\n/)) {
    const line = raw.replace(/'.*$/, '').trim();
    if (!line) continue;
    if (/^@(start|end)(uml|c4\w*)\b/i.test(line)) continue;
    if (/^!include\b/i.test(line)) {
      warnings.push('Includes are preview-only and are not fetched.');
      continue;
    }
    if (/^skinparam\b|^hide\b|^show\b|^scale\b/i.test(line)) continue;
    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      title = unquote(titleMatch[1]);
      continue;
    }
    lines.push(line);
  }
  return { body: lines.join('\n'), title, warnings };
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

function upsertElement(elements: PumlElement[], next: Partial<PumlElement> & { id: string; name: string; kind: PumlElementKind }): PumlElement {
  const existing = elements.find((e) => e.id === next.id);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind !== 'other') existing.kind = next.kind;
    if (next.stereotype) existing.stereotype = next.stereotype;
    if (next.members?.length) existing.members = [...existing.members, ...next.members];
    if (next.group && !existing.group) existing.group = next.group;
    return existing;
  }
  const created: PumlElement = {
    id: next.id,
    index: elements.length,
    name: next.name,
    kind: next.kind,
    stereotype: next.stereotype || '',
    members: next.members ? [...next.members] : [],
    group: next.group || '',
    x: 0,
    y: 0
  };
  elements.push(created);
  return created;
}

function idFromToken(token: string): { id: string; card: string; name: string } {
  const cleaned = token.trim();
  const card = /^"([^"]*)"\s+(.+)$/.exec(cleaned) || /^(.+?)\s+"([^"]*)"$/.exec(cleaned);
  if (card && cleaned.startsWith('"') && /^"([^"]*)"\s+/.test(cleaned)) {
    return { id: unquote(card[2]), card: card[1], name: unquote(card[2]) };
  }
  if (card && /"([^"]*)"$/.test(cleaned) && !cleaned.startsWith('"')) {
    return { id: unquote(card[1]), card: card[2], name: unquote(card[1]) };
  }
  const id = unquote(cleaned.replace(/\s+/g, ' '));
  return { id, card: '', name: id };
}

const REL_OPS: Array<{ op: string; style: PumlRelationStyle }> = [
  { op: '<|--', style: 'extend' },
  { op: '--|>', style: 'extend' },
  { op: '<|..', style: 'realize' },
  { op: '..|>', style: 'realize' },
  { op: '*--', style: 'compose' },
  { op: '--*', style: 'compose' },
  { op: 'o--', style: 'agg' },
  { op: '--o', style: 'agg' },
  { op: '<..', style: 'depend' },
  { op: '..>', style: 'depend' },
  { op: '-->', style: 'assoc' },
  { op: '<--', style: 'assoc' },
  { op: '..', style: 'depend' },
  { op: '--', style: 'assoc' }
];

function parseUmlRelation(line: string): { left: string; right: string; op: string; style: PumlRelationStyle; label: string } | null {
  const rels = [...REL_OPS].sort((a, b) => b.op.length - a.op.length);
  const labeled = /^(.*?)\s*:\s*(.+)$/.exec(line);
  const main = labeled && rels.some((rel) => labeled[1].includes(rel.op)) ? labeled[1].trim() : line;
  const label = labeled && rels.some((rel) => labeled[1].includes(rel.op)) ? labeled[2].trim() : '';
  for (const rel of rels) {
    const padded = ` ${rel.op} `;
    const idx = main.indexOf(padded);
    if (idx < 0) continue;
    const left = main.slice(0, idx).trim();
    const right = main.slice(idx + padded.length).trim();
    if (!left || !right) continue;
    return { left, right, op: rel.op, style: rel.style, label };
  }
  return null;
}

function isUmlKind(kind: PumlElementKind): boolean {
  return kind === 'class' || kind === 'interface' || kind === 'enum' || kind === 'actor' || kind === 'usecase';
}

function isC4Kind(kind: PumlElementKind): boolean {
  return kind === 'person' || kind === 'system' || kind === 'container' || kind === 'component' || kind === 'boundary';
}

function layoutElements(elements: PumlElement[], relations: PumlRelation[]): void {
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
  const buckets = new Map<number, PumlElement[]>();
  for (const e of elements) {
    const r = rank.get(e.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(e);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((e, i) => {
      e.x = 56 + r * 160;
      e.y = 48 + i * 92;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: PumlSourceKind,
  title: string,
  elements: PumlElement[],
  relations: PumlRelation[],
  warnings: string[]
): PumlDataset {
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
  const umlCount = elements.filter((e) => isUmlKind(e.kind)).length;
  const c4Count = elements.filter((e) => isC4Kind(e.kind)).length;
  let kind: PumlKind = 'uml';
  if (umlCount && c4Count) kind = 'mixed';
  else if (c4Count) kind = 'c4';
  if (!elements.length) warnings.push('PlantUML diagram contains no elements.');
  if (!relations.length && elements.length) warnings.push('PlantUML diagram has elements but no relations.');
  return { name, sourceKind, kind, title: title || name, elements, relations, warnings };
}

function parseC4Call(line: string): { fn: string; args: string[] } | null {
  const m = /^(Person(?:_Ext)?|System(?:_Ext)?|Container(?:_Ext)?|Component(?:_Ext)?|Enterprise_Boundary|System_Boundary|Boundary|Rel(?:_[A-Za-z]+)?)\(\s*(.*)\)\s*$/i.exec(line);
  if (!m) return null;
  return { fn: m[1], args: splitCsvArgs(m[2]) };
}

function c4KindFromFn(fn: string): PumlElementKind {
  const f = fn.toLowerCase();
  if (f.startsWith('person')) return 'person';
  if (f.startsWith('system_boundary') || f.startsWith('enterprise') || f === 'boundary') return 'boundary';
  if (f.startsWith('system')) return 'system';
  if (f.startsWith('container')) return 'container';
  if (f.startsWith('component')) return 'component';
  return 'other';
}

function parsePlantUmlBody(body: string, fileName: string, sourceKind: PumlSourceKind, title: string, baseWarnings: string[]): PumlDataset {
  const elements: PumlElement[] = [];
  const relations: PumlRelation[] = [];
  const warnings = [...baseWarnings];
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const decl = /^(abstract\s+)?(class|interface|enum|actor|usecase)\s+("?[\w.]+"?|[\w.]+)(?:\s*\{)?\s*$/i.exec(line);
    if (decl) {
      const kindRaw = decl[2].toLowerCase();
      const kind: PumlElementKind =
        kindRaw === 'interface' || kindRaw === 'enum' || kindRaw === 'actor' || kindRaw === 'usecase' ? kindRaw : 'class';
      const name = unquote(decl[3]);
      const members: string[] = [];
      if (line.includes('{') || (lines[i + 1] || '').startsWith('{')) {
        if (!line.includes('{')) i++;
        i++;
        while (i < lines.length && lines[i] !== '}') {
          if (lines[i] && lines[i] !== '{') members.push(lines[i].replace(/^[+\-#~]\s*/, ''));
          i++;
        }
      }
      upsertElement(elements, { id: name, name, kind, members, stereotype: decl[1] ? 'abstract' : '' });
      i++;
      continue;
    }
    const c4 = parseC4Call(line);
    if (c4) {
      if (/^Rel/i.test(c4.fn)) {
        const source = unquote(c4.args[0] || '');
        const target = unquote(c4.args[1] || '');
        const label = unquote(c4.args[2] || '');
        if (source && target) {
          upsertElement(elements, { id: source, name: source, kind: 'other' });
          upsertElement(elements, { id: target, name: target, kind: 'other' });
          relations.push({
            id: `r-${relations.length + 1}`,
            index: relations.length,
            source,
            target,
            sourceName: source,
            targetName: target,
            label,
            style: 'rel',
            sourceCard: '',
            targetCard: ''
          });
        }
      } else {
        const id = unquote(c4.args[0] || `e-${elements.length + 1}`);
        const name = unquote(c4.args[1] || id);
        const kind = c4KindFromFn(c4.fn);
        const stereo = /_Ext$/i.test(c4.fn) ? 'external' : '';
        upsertElement(elements, { id, name, kind, stereotype: stereo });
      }
      i++;
      continue;
    }
    const rel = parseUmlRelation(line);
    if (rel) {
      const left = idFromToken(rel.left);
      const right = idFromToken(rel.right);
      upsertElement(elements, { id: left.id, name: left.name, kind: 'other' });
      upsertElement(elements, { id: right.id, name: right.name, kind: 'other' });
      relations.push({
        id: `r-${relations.length + 1}`,
        index: relations.length,
        source: rel.op.startsWith('<') || rel.op.endsWith('--*') || rel.op === '<--' ? right.id : left.id,
        target: rel.op.startsWith('<') || rel.op.endsWith('--*') || rel.op === '<--' ? left.id : right.id,
        sourceName: '',
        targetName: '',
        label: rel.label,
        style: rel.style,
        sourceCard: rel.op.startsWith('<') ? right.card : left.card,
        targetCard: rel.op.startsWith('<') ? left.card : right.card
      });
      // Keep direction as written for --> *-- o-- ..> ..|> --|>
      if (rel.op === '-->' || rel.op === '*--' || rel.op === 'o--' || rel.op === '..>' || rel.op === '..|>' || rel.op === '--|>' || rel.op === '--' || rel.op === '..') {
        relations[relations.length - 1].source = left.id;
        relations[relations.length - 1].target = right.id;
        relations[relations.length - 1].sourceCard = left.card;
        relations[relations.length - 1].targetCard = right.card;
      }
      i++;
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
    i++;
  }
  const fallback = fileName.replace(/\.[^.]+$/, '') || 'PlantUML diagram';
  return finishDataset(title || fallback.replace(/^sample-/, '').replace(/-/g, ' ') || 'PlantUML diagram', sourceKind, title, elements, relations, warnings);
}

function parsePlantUmlJson(text: string, fileName: string): PumlDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid PlantUML JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('PlantUML JSON must be an object');
  const elRaw = (Array.isArray(obj.elements) ? obj.elements : Array.isArray(obj.nodes) ? obj.nodes : []) as unknown[];
  if (!elRaw.length) throw new Error('PlantUML JSON is missing elements');
  const elements: PumlElement[] = elRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const kindRaw = asString(rec.kind || rec.type).toLowerCase();
    const kind: PumlElementKind =
      kindRaw === 'class' ||
      kindRaw === 'interface' ||
      kindRaw === 'enum' ||
      kindRaw === 'actor' ||
      kindRaw === 'usecase' ||
      kindRaw === 'person' ||
      kindRaw === 'system' ||
      kindRaw === 'container' ||
      kindRaw === 'component' ||
      kindRaw === 'boundary'
        ? kindRaw
        : 'other';
    const members = Array.isArray(rec.members) ? rec.members.map((m) => asString(m)).filter(Boolean) : [];
    return {
      id: asString(rec.id, `e-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.label, asString(rec.id, `e-${i + 1}`)),
      kind,
      stereotype: asString(rec.stereotype),
      members,
      group: asString(rec.group),
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const relRaw = (Array.isArray(obj.relations) ? obj.relations : Array.isArray(obj.edges) ? obj.edges : []) as unknown[];
  const relations: PumlRelation[] = relRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const styleRaw = asString(rec.style).toLowerCase();
    const style: PumlRelationStyle =
      styleRaw === 'compose' || styleRaw === 'agg' || styleRaw === 'extend' || styleRaw === 'realize' || styleRaw === 'depend' || styleRaw === 'rel'
        ? styleRaw
        : 'assoc';
    return {
      id: asString(rec.id, `r-${i + 1}`),
      index: i,
      source: asString(rec.source || rec.from),
      target: asString(rec.target || rec.to),
      sourceName: '',
      targetName: '',
      label: asString(rec.label),
      style,
      sourceCard: asString(rec.sourceCard),
      targetCard: asString(rec.targetCard)
    };
  }).filter((r) => r.source && r.target);
  return finishDataset(asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'PlantUML JSON'), 'json', asString(obj.title), elements, relations, []);
}

export function parsePlantUmlText(text: string, fileName = ''): PumlDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('PlantUML file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parsePlantUmlJson(raw, fileName);
  const extracted = extractPlantUmlSource(raw);
  const sourceKind: PumlSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : 'puml';
  if (
    !/@start(uml|c4)/i.test(extracted.source) &&
    !/\b(class|interface|enum|actor|usecase|Person|System|Container|Component|Rel)\b/i.test(extracted.source)
  ) {
    throw new Error('Not a PlantUML diagram');
  }
  const cleaned = stripPlantUmlNoise(extracted.source);
  if (!cleaned.body) throw new Error('PlantUML diagram contains no elements');
  const parsed = parsePlantUmlBody(cleaned.body, fileName, sourceKind, cleaned.title, cleaned.warnings);
  if (!parsed.elements.length) throw new Error('PlantUML diagram contains no elements');
  return parsed;
}

export function parsePlantUmlBytes(bytes: Uint8Array, fileName = ''): PumlDataset {
  if (!bytes.length) throw new Error('PlantUML file is empty');
  return parsePlantUmlText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterPumlElements(elements: PumlElement[], query: string, view: 'all' | 'uml' | 'c4' = 'all'): PumlElement[] {
  let list = elements;
  if (view === 'uml') list = list.filter((e) => isUmlKind(e.kind));
  if (view === 'c4') list = list.filter((e) => isC4Kind(e.kind));
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('kind:')) return e.kind === token.slice(5);
      if (token.startsWith('node:') || token.startsWith('element:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return e.name.toLowerCase().includes(needle) || e.id.toLowerCase().includes(needle);
      }
      if (token === 'uml') return isUmlKind(e.kind);
      if (token === 'c4') return isC4Kind(e.kind);
      return `${e.id} ${e.name} ${e.kind} ${e.stereotype} ${e.members.join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterPumlRelations(relations: PumlRelation[], query: string): PumlRelation[] {
  const q = query.trim().toLowerCase();
  if (!q) return relations;
  const tokens = q.split(/\s+/).filter(Boolean);
  return relations.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('rel:') || token.startsWith('label:')) return r.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return r.sourceName.toLowerCase().includes(token.slice(5)) || r.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return r.targetName.toLowerCase().includes(token.slice(3)) || r.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('style:')) return r.style === token.slice(6);
      return `${r.source} ${r.target} ${r.sourceName} ${r.targetName} ${r.label} ${r.style}`.toLowerCase().includes(token);
    })
  );
}
