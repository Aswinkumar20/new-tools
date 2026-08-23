import type {
  CdgDataset,
  CdgMember,
  CdgRelation,
  CdgRelationStyle,
  CdgSourceKind,
  CdgType,
  CdgTypeKind,
  CdgVisibility
} from '../types/class-diagram-viewer.types';

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

function looksLikeXmi(text: string): boolean {
  return /<(?:[\w.-]+:)?(XMI|Model|packagedElement)\b/i.test(text) && /uml|xmi/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:uml|plantuml|puml|class)?\s*([\s\S]*?)```/i.exec(text);
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

function visibilityFrom(raw: string): CdgVisibility {
  const v = raw.trim().toLowerCase();
  if (v === 'private' || v === '-') return 'private';
  if (v === 'protected' || v === '#') return 'protected';
  if (v === 'package' || v === 'packagevisible' || v === '~') return 'package';
  return 'public';
}

function parseMemberLine(line: string): CdgMember | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '{' || trimmed === '}') return null;
  let visibility: CdgVisibility = 'public';
  let rest = trimmed;
  const vis = /^([+\-#~])\s*(.*)$/.exec(trimmed);
  if (vis) {
    visibility = vis[1] === '+' ? 'public' : vis[1] === '-' ? 'private' : vis[1] === '#' ? 'protected' : 'package';
    rest = vis[2].trim();
  }
  if (!rest) return null;
  const op = /^([A-Za-z_][\w]*)\s*\(([^)]*)\)\s*(?::\s*(.+))?$/.exec(rest);
  if (op) return { name: op[1], type: (op[3] || '').trim(), visibility, kind: 'operation' };
  const attr = /^([A-Za-z_][\w]*)\s*(?::\s*(.+))?$/.exec(rest);
  if (attr) return { name: attr[1], type: (attr[2] || '').trim(), visibility, kind: 'attribute' };
  return { name: rest, type: '', visibility, kind: 'attribute' };
}

function upsertType(
  types: CdgType[],
  next: { id: string; name: string; kind: CdgTypeKind; stereotype?: string; attributes?: CdgMember[]; operations?: CdgMember[] }
): CdgType {
  const existing = types.find((t) => t.id === next.id);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind && next.kind !== 'class') existing.kind = next.kind;
    if (next.stereotype) existing.stereotype = next.stereotype;
    if (next.attributes?.length) existing.attributes = [...existing.attributes, ...next.attributes];
    if (next.operations?.length) existing.operations = [...existing.operations, ...next.operations];
    return existing;
  }
  const created: CdgType = {
    id: next.id,
    index: types.length,
    name: next.name,
    kind: next.kind,
    stereotype: next.stereotype || '',
    attributes: next.attributes ? [...next.attributes] : [],
    operations: next.operations ? [...next.operations] : [],
    x: 0,
    y: 0
  };
  types.push(created);
  return created;
}

const REL_OPS: Array<{ op: string; style: CdgRelationStyle }> = [
  { op: '<|--', style: 'inherit' },
  { op: '--|>', style: 'inherit' },
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

function parseClassRel(line: string): { left: string; right: string; op: string; style: CdgRelationStyle; label: string } | null {
  const rels = [...REL_OPS].sort((a, b) => b.op.length - a.op.length);
  const labeled = /^(.*?)\s*:\s*(.+)$/.exec(line);
  const main = labeled && rels.some((r) => labeled[1].includes(r.op)) ? labeled[1].trim() : line;
  const label = labeled && rels.some((r) => labeled[1].includes(r.op)) ? labeled[2].trim() : '';
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

function flipRel(op: string): boolean {
  return op.startsWith('<') || op.endsWith('--*') || op === '<--' || op.endsWith('--o');
}

function layoutTypes(types: CdgType[], relations: CdgRelation[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const t of types) {
    incoming.set(t.id, []);
    outgoing.set(t.id, []);
  }
  for (const r of relations) {
    outgoing.get(r.source)?.push(r.target);
    incoming.get(r.target)?.push(r.source);
  }
  const rank = new Map<string, number>();
  const starts = types.filter((t) => !(incoming.get(t.id)?.length)).map((t) => t.id);
  (starts.length ? starts : types.slice(0, 1).map((t) => t.id)).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, CdgType[]>();
  for (const t of types) {
    const r = rank.get(t.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(t);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((t, i) => {
      t.x = 56 + r * 170;
      t.y = 48 + i * 110;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: CdgSourceKind,
  title: string,
  types: CdgType[],
  relations: CdgRelation[],
  warnings: string[]
): CdgDataset {
  const nameById = new Map(types.map((t) => [t.id, t.name] as const));
  relations.forEach((r, i) => {
    r.index = i;
    r.sourceName = nameById.get(r.source) || r.source;
    r.targetName = nameById.get(r.target) || r.target;
  });
  types.forEach((t, i) => {
    t.index = i;
  });
  layoutTypes(types, relations);
  if (!types.length) warnings.push('Class diagram contains no types.');
  if (!relations.length && types.length) warnings.push('Class diagram has types but no relations.');
  return { name, sourceKind, title: title || name, types, relations, warnings };
}

function parseXmi(xml: string, fileName: string): CdgDataset {
  const modelName = attrs(/<(?:[\w.-]+:)?Model\b([^>]*)/i.exec(xml)?.[1] ?? '').name || fileName.replace(/\.[^.]+$/, '') || 'Class model';
  const types: CdgType[] = [];
  const relations: CdgRelation[] = [];
  const elRe =
    /<(?:[\w.-]+:)?packagedElement\b([^>]*?)\/>|<(?:[\w.-]+:)?packagedElement\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?packagedElement>/gi;
  let match: RegExpExecArray | null;
  while ((match = elRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const inner = match[3] || '';
    const type = (a['xmi:type'] || a.type || '').toLowerCase();
    const id = a['xmi:id'] || a.id || a.name || `t-${types.length + 1}`;
    const name = a.name || id;
    if (/class$/i.test(type) || type === 'uml:class') {
      const kind: CdgTypeKind = /true/i.test(a.isAbstract || '') ? 'abstract' : 'class';
      const attributes: CdgMember[] = [];
      const operations: CdgMember[] = [];
      for (const m of inner.matchAll(/<(?:[\w.-]+:)?owned(Attribute|Operation)\b([^>]*)\/?>/gi)) {
        const ma = attrs(m[2] || '');
        const member: CdgMember = {
          name: ma.name || 'member',
          type: ma.type || '',
          visibility: visibilityFrom(ma.visibility || 'public'),
          kind: /operation/i.test(m[1]) ? 'operation' : 'attribute'
        };
        if (member.kind === 'operation') operations.push(member);
        else attributes.push(member);
      }
      upsertType(types, { id, name, kind, attributes, operations });
    } else if (/interface$/i.test(type)) {
      upsertType(types, { id, name, kind: 'interface' });
    } else if (/enumeration|enum$/i.test(type)) {
      upsertType(types, { id, name, kind: 'enum' });
    } else if (/association$/i.test(type)) {
      const ends = [...inner.matchAll(/<(?:[\w.-]+:)?memberEnd\b([^>]*)\/?>/gi)].map(
        (m) => attrs(m[1] || '')['xmi:idref'] || attrs(m[1] || '').idref || ''
      );
      if (ends[0] && ends[1]) {
        relations.push({
          id: `r-${relations.length + 1}`,
          index: relations.length,
          source: ends[0],
          target: ends[1],
          sourceName: '',
          targetName: '',
          label: name === id ? '' : name,
          style: 'assoc',
          sourceCard: '',
          targetCard: ''
        });
      }
    } else if (/generalization$/i.test(type)) {
      const general = a.general || '';
      if (general) {
        relations.push({
          id: `r-${relations.length + 1}`,
          index: relations.length,
          source: id,
          target: general,
          sourceName: '',
          targetName: '',
          label: '',
          style: 'inherit',
          sourceCard: '',
          targetCard: ''
        });
      }
    } else if (/realization$/i.test(type)) {
      const client = a.client || '';
      const supplier = a.supplier || '';
      if (client && supplier) {
        relations.push({
          id: `r-${relations.length + 1}`,
          index: relations.length,
          source: client,
          target: supplier,
          sourceName: '',
          targetName: '',
          label: name === id ? '' : name,
          style: 'realize',
          sourceCard: '',
          targetCard: ''
        });
      }
    }
  }
  if (!types.length) throw new Error('XMI contains no class types');
  return finishDataset(modelName, 'xmi', modelName, types, relations, []);
}

function parsePlantLike(source: string, fileName: string, sourceKind: CdgSourceKind): CdgDataset {
  const warnings: string[] = [];
  let title = '';
  const lines = source
    .replace(/\/'[\s\S]*?'\//g, '\n')
    .split(/\r?\n/)
    .map((l) => l.replace(/'.*$/, '').trim())
    .filter((l) => l && !/^@(start|end)uml\b/i.test(l) && !/^skinparam\b|^hide\b|^show\b|^!include\b/i.test(l));
  const types: CdgType[] = [];
  const relations: CdgRelation[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      title = unquote(titleMatch[1]);
      i++;
      continue;
    }
    const decl =
      /^(abstract\s+)?(class|interface|enum)\s+([A-Za-z][\w.-]*)(?:\s+<<([^>]+)>>)?(?:\s*\{)?\s*$/i.exec(line);
    if (decl) {
      const kindRaw = decl[2].toLowerCase();
      const kind: CdgTypeKind = decl[1] ? 'abstract' : kindRaw === 'interface' || kindRaw === 'enum' ? kindRaw : 'class';
      const name = decl[3];
      const stereotype = (decl[4] || (decl[1] ? 'abstract' : '')).trim();
      const attributes: CdgMember[] = [];
      const operations: CdgMember[] = [];
      if (line.includes('{') || (lines[i + 1] || '').startsWith('{')) {
        if (!line.includes('{')) i++;
        i++;
        while (i < lines.length && lines[i] !== '}') {
          const member = parseMemberLine(lines[i]);
          if (member) {
            if (member.kind === 'operation') operations.push(member);
            else attributes.push(member);
          }
          i++;
        }
      }
      upsertType(types, { id: name, name, kind, stereotype, attributes, operations });
      i++;
      continue;
    }
    const rel = parseClassRel(line);
    if (rel) {
      const left = idFromToken(rel.left);
      const right = idFromToken(rel.right);
      upsertType(types, { id: left.id, name: left.name, kind: 'class' });
      upsertType(types, { id: right.id, name: right.name, kind: 'class' });
      const flipped = flipRel(rel.op);
      relations.push({
        id: `r-${relations.length + 1}`,
        index: relations.length,
        source: flipped ? right.id : left.id,
        target: flipped ? left.id : right.id,
        sourceName: '',
        targetName: '',
        label: rel.label,
        style: rel.style,
        sourceCard: flipped ? right.card : left.card,
        targetCard: flipped ? left.card : right.card
      });
      i++;
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
    i++;
  }
  const fallback = title || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Class diagram';
  return finishDataset(fallback, sourceKind, title, types, relations, warnings);
}

function parseCdgJson(text: string, fileName: string): CdgDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid class diagram JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Class diagram JSON must be an object');
  const typeRaw = (Array.isArray(obj.types) ? obj.types : Array.isArray(obj.classes) ? obj.classes : []) as unknown[];
  if (!typeRaw.length) throw new Error('Class diagram JSON is missing types');
  const types: CdgType[] = typeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const kindRaw = asString(rec.kind || rec.type).toLowerCase();
    const kind: CdgTypeKind =
      kindRaw === 'interface' || kindRaw === 'enum' || kindRaw === 'abstract' ? kindRaw : 'class';
    const toMembers = (list: unknown, kindHint: CdgMember['kind']): CdgMember[] =>
      Array.isArray(list)
        ? list
            .map((m) => {
              if (typeof m === 'string') return parseMemberLine(m);
              const mr = (m ?? {}) as Record<string, unknown>;
              const vis = visibilityFrom(asString(mr.visibility, 'public'));
              const mk = asString(mr.kind).toLowerCase() === 'operation' ? 'operation' : kindHint;
              return {
                name: asString(mr.name, 'member'),
                type: asString(mr.type),
                visibility: vis,
                kind: mk as CdgMember['kind']
              };
            })
            .filter((m): m is CdgMember => !!m)
        : [];
    return {
      id: asString(rec.id, `t-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.label, asString(rec.id, `t-${i + 1}`)),
      kind,
      stereotype: asString(rec.stereotype),
      attributes: toMembers(rec.attributes, 'attribute'),
      operations: toMembers(rec.operations, 'operation'),
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const relRaw = (Array.isArray(obj.relations) ? obj.relations : Array.isArray(obj.links) ? obj.links : []) as unknown[];
  const relations: CdgRelation[] = relRaw
    .map((item, i) => {
      const rec = (item ?? {}) as Record<string, unknown>;
      const styleRaw = asString(rec.style).toLowerCase();
      const style: CdgRelationStyle =
        styleRaw === 'inherit' ||
        styleRaw === 'compose' ||
        styleRaw === 'agg' ||
        styleRaw === 'realize' ||
        styleRaw === 'depend'
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
        sourceCard: asString(rec.sourceCard || rec.source_card),
        targetCard: asString(rec.targetCard || rec.target_card)
      };
    })
    .filter((r) => r.source && r.target);
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'Class JSON'),
    'json',
    asString(obj.title),
    types,
    relations,
    []
  );
}

export function parseClassDiagramText(text: string, fileName = ''): CdgDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Class diagram file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseCdgJson(raw, fileName);
  if (looksLikeXmi(raw) || ext === 'xmi') return parseXmi(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: CdgSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : ext === 'xml' ? 'xmi' : 'puml';
  if (
    /@startuml\b/i.test(extracted.source) ||
    /\b(class|interface|enum|abstract)\b/i.test(extracted.source)
  ) {
    const parsed = parsePlantLike(extracted.source, fileName, sourceKind);
    if (!parsed.types.length) throw new Error('Class diagram contains no types');
    return parsed;
  }
  throw new Error('Not a class diagram');
}

export function parseClassDiagramBytes(bytes: Uint8Array, fileName = ''): CdgDataset {
  if (!bytes.length) throw new Error('Class diagram file is empty');
  return parseClassDiagramText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterCdgTypes(types: CdgType[], query: string, view: 'all' | CdgTypeKind = 'all'): CdgType[] {
  let list = view === 'all' ? types : types.filter((t) => t.kind === view);
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('kind:')) return t.kind === token.slice(5);
      if (token.startsWith('type:') || token.startsWith('class:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return t.name.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('vis:')) {
        const vis = token.slice(4);
        return [...t.attributes, ...t.operations].some((m) => m.visibility === vis);
      }
      const blob = `${t.id} ${t.name} ${t.kind} ${t.stereotype} ${t.attributes.map((m) => m.name).join(' ')} ${t.operations.map((m) => m.name).join(' ')}`.toLowerCase();
      return blob.includes(token);
    })
  );
}

export function filterCdgRelations(relations: CdgRelation[], query: string): CdgRelation[] {
  const q = query.trim().toLowerCase();
  if (!q) return relations;
  const tokens = q.split(/\s+/).filter(Boolean);
  return relations.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('rel:') || token.startsWith('label:')) return r.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return r.sourceName.toLowerCase().includes(token.slice(5)) || r.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return r.targetName.toLowerCase().includes(token.slice(3)) || r.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('style:')) return r.style === token.slice(6);
      return `${r.source} ${r.target} ${r.sourceName} ${r.targetName} ${r.label} ${r.style} ${r.sourceCard} ${r.targetCard}`.toLowerCase().includes(token);
    })
  );
}
