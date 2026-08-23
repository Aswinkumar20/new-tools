import type {
  PrmDataset,
  PrmField,
  PrmModel,
  PrmRelation,
  PrmRelationKind,
  PrmSourceKind
} from '../types/prisma-schema-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function unquote(value: string): string {
  return value.trim().replace(/^["'`]+|["'`]+$/g, '');
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:prisma|schema|models|model)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:prisma|graphql)?\s*([\s\S]*?)```/i.exec(text);
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

function truthy(value: unknown): boolean {
  const v = asString(value).toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function stripPrismaComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/\/\/[^\n]*/g, '');
}

function extractBraceBlock(source: string, openIdx: number): { body: string; end: number } | null {
  if (source[openIdx] !== '{') return null;
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { body: source.slice(openIdx + 1, i), end: i + 1 };
    }
  }
  return null;
}

function emptyField(): Omit<PrmField, 'name' | 'type'> {
  return { isId: false, isUnique: false, optional: false, list: false, relation: false, note: '' };
}

function upsertModel(models: PrmModel[], next: { id: string; name: string; kind?: 'model' | 'enum' }): PrmModel {
  const existing = models.find((m) => m.id === next.id || m.name === next.name);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind && next.kind !== 'model') existing.kind = next.kind;
    return existing;
  }
  const created: PrmModel = {
    id: next.id,
    index: models.length,
    name: next.name,
    kind: next.kind || 'model',
    fields: [],
    x: 0,
    y: 0
  };
  models.push(created);
  return created;
}

function parseAttrBlock(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_][\w]*)\s*:\s*(\[[^\]]*\]|"[^"]*"|'[^']*'|[^\s,)]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) out[match[1]] = match[2].trim();
  return out;
}

function firstIdentList(raw: string): string {
  const inner = raw.replace(/^\[/, '').replace(/\]$/, '');
  return unquote(inner.split(',')[0] || '');
}

function parseFieldLine(line: string, model: PrmModel, models: PrmModel[], relations: PrmRelation[]): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('@@')) {
    const composite = /^@@id\s*\(\s*\[([^\]]+)\]/.exec(trimmed);
    if (composite) {
      for (const name of composite[1].split(',').map((s) => unquote(s))) {
        const field = model.fields.find((f) => f.name === name);
        if (field) field.isId = true;
      }
      return true;
    }
    return /^@@/.test(trimmed);
  }
  const field = /^([A-Za-z_][\w]*)\s+([A-Za-z_][\w]*)(\[\])?(\?)?(?:\s+(.+))?$/.exec(trimmed);
  if (!field) return false;
  const created: PrmField = {
    name: field[1],
    type: field[2],
    ...emptyField(),
    list: !!field[3],
    optional: !!field[4]
  };
  const rest = field[5] || '';
  if (/@id\b/.test(rest)) created.isId = true;
  if (/@unique\b/.test(rest)) created.isUnique = true;
  const rel = /@relation\s*\(([^)]*)\)/.exec(rest);
  const scalars = new Set(['string', 'int', 'bigint', 'float', 'decimal', 'boolean', 'datetime', 'json', 'bytes']);
  const knownModel = models.some((m) => m.name === created.type) || (!scalars.has(created.type.toLowerCase()) && /^[A-Z]/.test(created.type));
  if (rel || knownModel) created.relation = true;
  if (rel) {
    const args = parseAttrBlock(rel[1]);
    const sourceField = firstIdentList(args.fields || '') || created.name;
    const targetField = firstIdentList(args.references || '') || 'id';
    const relName = unquote(args.name || '');
    created.relation = true;
    upsertModel(models, { id: created.type, name: created.type });
    const dup = relations.some(
      (r) => r.source === model.id && r.target === created.type && r.sourceField === sourceField && r.targetField === targetField
    );
    if (!dup) {
      relations.push({
        id: `r-${relations.length + 1}`,
        index: relations.length,
        name: relName,
        source: model.id,
        target: created.type,
        sourceName: '',
        targetName: '',
        sourceField,
        targetField,
        kind: created.list ? 'n-n' : '1-n'
      });
    }
  }
  model.fields.push(created);
  return true;
}

function inferRelationKinds(models: PrmModel[], relations: PrmRelation[]): void {
  for (const rel of relations) {
    const source = models.find((m) => m.id === rel.source || m.name === rel.source);
    const target = models.find((m) => m.id === rel.target || m.name === rel.target);
    const back = target?.fields.some((f) => f.type === rel.source && f.list);
    const forwardList = source?.fields.some((f) => f.name === rel.sourceField && f.list);
    if (forwardList && back) rel.kind = 'n-n';
    else if (back) rel.kind = '1-n';
    else rel.kind = '1-1';
  }
}

function layoutModels(models: PrmModel[], relations: PrmRelation[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const m of models) {
    incoming.set(m.id, []);
    outgoing.set(m.id, []);
  }
  for (const r of relations) {
    outgoing.get(r.source)?.push(r.target);
    incoming.get(r.target)?.push(r.source);
  }
  const rank = new Map<string, number>();
  const starts = models.filter((m) => !(incoming.get(m.id)?.length)).map((m) => m.id);
  (starts.length ? starts : models.slice(0, 1).map((m) => m.id)).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, PrmModel[]>();
  for (const m of models) {
    const r = rank.get(m.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(m);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((m, i) => {
      m.x = 48 + r * 210;
      m.y = 40 + i * 140;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: PrmSourceKind,
  title: string,
  provider: string,
  models: PrmModel[],
  relations: PrmRelation[],
  warnings: string[]
): PrmDataset {
  inferRelationKinds(models, relations);
  const nameById = new Map(models.map((m) => [m.id, m.name] as const));
  relations.forEach((r, i) => {
    r.index = i;
    r.sourceName = nameById.get(r.source) || r.source;
    r.targetName = nameById.get(r.target) || r.target;
  });
  models.forEach((m, i) => {
    m.index = i;
  });
  layoutModels(models, relations);
  if (!models.length) warnings.push('Prisma schema contains no models.');
  if (!relations.length && models.length) warnings.push('Prisma schema has models but no relations.');
  return { name, sourceKind, title: title || name, provider, models, relations, warnings };
}

function parsePrismaSource(source: string, fileName: string, sourceKind: PrmSourceKind): PrmDataset {
  const warnings: string[] = [];
  const cleaned = stripPrismaComments(source);
  const models: PrmModel[] = [];
  const relations: PrmRelation[] = [];
  let provider = '';
  let title = '';
  let i = 0;
  while (i < cleaned.length) {
    const slice = cleaned.slice(i);
    const ds = /^\s*datasource\s+(\w+)\s*\{/i.exec(slice);
    if (ds && ds.index === 0) {
      const open = i + ds[0].lastIndexOf('{');
      const block = extractBraceBlock(cleaned, open);
      if (!block) break;
      const prov = /provider\s*=\s*(.+)/i.exec(block.body);
      if (prov) provider = unquote(prov[1]);
      i = block.end;
      continue;
    }
    const gen = /^\s*generator\s+\w+\s*\{/i.exec(slice);
    if (gen && gen.index === 0) {
      const open = i + gen[0].lastIndexOf('{');
      const block = extractBraceBlock(cleaned, open);
      i = block ? block.end : i + gen[0].length;
      continue;
    }
    const enumMatch = /^\s*enum\s+([A-Za-z_][\w]*)\s*\{/i.exec(slice);
    if (enumMatch && enumMatch.index === 0) {
      const open = i + enumMatch[0].lastIndexOf('{');
      const block = extractBraceBlock(cleaned, open);
      if (!block) break;
      const model = upsertModel(models, { id: enumMatch[1], name: enumMatch[1], kind: 'enum' });
      for (const line of block.body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
        model.fields.push({ name: line.split(/\s+/)[0], type: 'enum', ...emptyField() });
      }
      i = block.end;
      continue;
    }
    const modelMatch = /^\s*model\s+([A-Za-z_][\w]*)\s*\{/i.exec(slice);
    if (modelMatch && modelMatch.index === 0) {
      const name = modelMatch[1];
      if (!title) title = name;
      const open = i + modelMatch[0].lastIndexOf('{');
      const block = extractBraceBlock(cleaned, open);
      if (!block) {
        warnings.push(`Unclosed model ${name}`);
        break;
      }
      const model = upsertModel(models, { id: name, name, kind: 'model' });
      for (const line of block.body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
        if (!parseFieldLine(line, model, models, relations)) warnings.push(`Skipped line in ${name}: ${line}`);
      }
      i = block.end;
      continue;
    }
    const nextNl = cleaned.indexOf('\n', i);
    if (nextNl < 0) break;
    const leftover = cleaned.slice(i, nextNl).trim();
    if (leftover) warnings.push(`Skipped line: ${leftover}`);
    i = nextNl + 1;
  }
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ');
  const fallback = fromFile || title || 'Prisma schema';
  return finishDataset(fallback, sourceKind, fallback, provider, models, relations, warnings);
}

function parseXml(xml: string, fileName: string): PrmDataset {
  const root = /<(?:prisma|schema)\b([^>]*)>/i.exec(xml);
  const a = attrs(root?.[1] || '');
  const name = a.name || fileName.replace(/\.[^.]+$/, '') || 'Prisma';
  const models: PrmModel[] = [];
  const relations: PrmRelation[] = [];
  const modelRe = /<(?:model|enum)\b([^>]*)>([\s\S]*?)<\/(?:model|enum)>|<(?:model|enum)\b([^>]*)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = modelRe.exec(xml))) {
    const ma = attrs(match[1] || match[3] || '');
    const id = ma.id || ma.name || `m-${models.length + 1}`;
    const kind: 'model' | 'enum' = /enum/i.test(match[0]) ? 'enum' : 'model';
    const model = upsertModel(models, { id, name: ma.name || id, kind });
    for (const fieldMatch of (match[2] || '').matchAll(/<field\b([^>]*)\/?>/gi)) {
      const f = attrs(fieldMatch[1] || '');
      if (!f.name) continue;
      model.fields.push({
        name: f.name,
        type: f.type || '',
        isId: truthy(f.isId || f.id),
        isUnique: truthy(f.isUnique || f.unique),
        optional: truthy(f.optional),
        list: truthy(f.list),
        relation: truthy(f.relation),
        note: f.note || ''
      });
    }
  }
  for (const relMatch of xml.matchAll(/<relation\b([^>]*)\/?>/gi)) {
    const r = attrs(relMatch[1] || '');
    if (!r.source || !r.target) continue;
    upsertModel(models, { id: r.source, name: r.source });
    upsertModel(models, { id: r.target, name: r.target });
    relations.push({
      id: `r-${relations.length + 1}`,
      index: relations.length,
      name: r.name || '',
      source: r.source,
      target: r.target,
      sourceName: '',
      targetName: '',
      sourceField: r.sourceField || '',
      targetField: r.targetField || '',
      kind: (r.kind as PrmRelationKind) || '1-n'
    });
  }
  if (!models.length) throw new Error('Prisma XML contains no models');
  return finishDataset(name, 'xml', name, a.provider || '', models, relations, []);
}

function parseJson(text: string, fileName: string): PrmDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid Prisma JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Prisma JSON must be an object');
  const modelRaw = (Array.isArray(obj.models) ? obj.models : []) as unknown[];
  if (!modelRaw.length) throw new Error('Prisma JSON is missing models');
  const models: PrmModel[] = modelRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const fields = (Array.isArray(rec.fields) ? rec.fields : []) as unknown[];
    return {
      id: asString(rec.id || rec.name, `m-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.id, `m-${i + 1}`),
      kind: rec.kind === 'enum' ? 'enum' : 'model',
      fields: fields
        .map((field) => {
          const f = (field ?? {}) as Record<string, unknown>;
          return {
            name: asString(f.name),
            type: asString(f.type),
            isId: Boolean(f.isId || f.id),
            isUnique: Boolean(f.isUnique || f.unique),
            optional: Boolean(f.optional),
            list: Boolean(f.list),
            relation: Boolean(f.relation),
            note: asString(f.note)
          };
        })
        .filter((f) => f.name),
      x: 0,
      y: 0
    };
  });
  const relations: PrmRelation[] = [];
  const relRaw = (Array.isArray(obj.relations) ? obj.relations : []) as unknown[];
  for (const item of relRaw) {
    const rec = (item ?? {}) as Record<string, unknown>;
    const source = asString(rec.source || rec.from);
    const target = asString(rec.target || rec.to);
    if (!source || !target) continue;
    upsertModel(models, { id: source, name: source });
    upsertModel(models, { id: target, name: target });
    relations.push({
      id: `r-${relations.length + 1}`,
      index: relations.length,
      name: asString(rec.name),
      source,
      target,
      sourceName: '',
      targetName: '',
      sourceField: asString(rec.sourceField || rec.fromField),
      targetField: asString(rec.targetField || rec.toField),
      kind: (asString(rec.kind, '1-n') as PrmRelationKind) || '1-n'
    });
  }
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'Prisma JSON'),
    'json',
    asString(obj.title || obj.name),
    asString(obj.provider),
    models,
    relations,
    []
  );
}

export function parsePrismaSchemaText(text: string, fileName = ''): PrmDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Prisma schema file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  if (looksLikeXml(raw) || (ext === 'xml' && looksLikeXml(raw))) return parseXml(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: PrmSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : 'prisma';
  if (/\bmodel\s+[A-Za-z_][\w]*\s*\{/i.test(extracted.source) || /\benum\s+[A-Za-z_][\w]*\s*\{/i.test(extracted.source)) {
    const parsed = parsePrismaSource(extracted.source, fileName, sourceKind);
    if (!parsed.models.length) throw new Error('Prisma schema contains no models');
    return parsed;
  }
  throw new Error('Not a Prisma schema');
}

export function parsePrismaSchemaBytes(bytes: Uint8Array, fileName = ''): PrmDataset {
  if (!bytes.length) throw new Error('Prisma schema file is empty');
  return parsePrismaSchemaText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterPrmModels(models: PrmModel[], query: string): PrmModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return models;
  const tokens = q.split(/\s+/).filter(Boolean);
  return models.filter((m) =>
    tokens.every((token) => {
      if (token.startsWith('model:') || token.startsWith('table:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return m.name.toLowerCase().includes(needle) || m.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('field:') || token.startsWith('col:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return m.fields.some((f) => f.name.toLowerCase().includes(needle) || f.type.toLowerCase().includes(needle));
      }
      if (token.startsWith('kind:')) return m.kind === token.slice(5);
      return `${m.id} ${m.name} ${m.kind} ${m.fields.map((f) => `${f.name} ${f.type}`).join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterPrmRelations(relations: PrmRelation[], query: string): PrmRelation[] {
  const q = query.trim().toLowerCase();
  if (!q) return relations;
  const tokens = q.split(/\s+/).filter(Boolean);
  return relations.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('rel:') || token.startsWith('kind:')) return `${r.kind} ${r.name}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return r.sourceName.toLowerCase().includes(token.slice(5)) || r.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return r.targetName.toLowerCase().includes(token.slice(3)) || r.target.toLowerCase().includes(token.slice(3));
      return `${r.source} ${r.target} ${r.sourceName} ${r.targetName} ${r.sourceField} ${r.targetField} ${r.kind} ${r.name}`.toLowerCase().includes(token);
    })
  );
}
