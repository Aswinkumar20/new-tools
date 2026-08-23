import type {
  ErColumn,
  ErDataset,
  ErEntity,
  ErKey,
  ErKeyKind,
  ErRelation,
  ErSourceKind
} from '../types/er-diagram-viewer.types';

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
  return /<(?:er|erd|schema|entities|entity)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:er(?:d)?|mermaid|plantuml|puml|sql)?\s*([\s\S]*?)```/i.exec(text);
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
  return v === 'true' || v === '1' || v === 'yes' || v === 'pk' || v === 'fk' || v === 'uk';
}

function emptyColumn(): Omit<ErColumn, 'name' | 'type'> {
  return { pk: false, fk: false, unique: false, nullable: true, refEntity: '', refColumn: '' };
}

function parseColumnFlags(raw: string, column: ErColumn): void {
  const upper = raw.toUpperCase();
  if (/\bPK\b|<<\s*PK\s*>>|\bPRIMARY\b/.test(upper)) column.pk = true;
  if (/\bFK\b|<<\s*FK\s*>>|\bFOREIGN\b/.test(upper)) column.fk = true;
  if (/\bUK\b|<<\s*UK\s*>>|\bUNIQUE\b/.test(upper)) column.unique = true;
  if (/\bNN\b|<<\s*NN\s*>>|\bNOT\s*NULL\b/.test(upper) || raw.trim().startsWith('*')) column.nullable = false;
}

function parseColumnLine(line: string): ErColumn | null {
  const cleaned = line.replace(/^\*+\s*/, '').trim();
  if (!cleaned || cleaned === '--' || cleaned === '..') return null;
  const stereo = /<<([^>]+)>>/.exec(cleaned);
  const withoutStereo = cleaned.replace(/<<[^>]+>>/g, '').trim();
  const typed = /^([A-Za-z_][\w]*)\s*:\s*([A-Za-z_][\w.()[\]]*)(.*)$/.exec(withoutStereo);
  const mermaid = /^([A-Za-z_][\w.()[\]]*)\s+([A-Za-z_][\w]*)\s*(.*)$/.exec(withoutStereo);
  let name = '';
  let type = '';
  let rest = '';
  if (typed) {
    name = typed[1];
    type = typed[2];
    rest = typed[3] || '';
  } else if (mermaid) {
    type = mermaid[1];
    name = mermaid[2];
    rest = mermaid[3] || '';
  } else {
    const parts = withoutStereo.split(/\s+/);
    if (!parts[0]) return null;
    name = parts.length > 1 ? parts[1] : parts[0];
    type = parts.length > 1 ? parts[0] : '';
    rest = parts.slice(2).join(' ');
  }
  const column: ErColumn = { name, type, ...emptyColumn(), nullable: !line.trim().startsWith('*') };
  parseColumnFlags(`${rest} ${stereo?.[1] || ''} ${line}`, column);
  const ref = /(?:ref|references)\s*[:=]?\s*([A-Za-z_][\w]*)(?:\.([A-Za-z_][\w]*))?/i.exec(rest);
  if (ref) {
    column.fk = true;
    column.refEntity = ref[1];
    column.refColumn = ref[2] || 'id';
  }
  return column;
}

function upsertEntity(entities: ErEntity[], next: { id: string; name: string; stereotype?: string }): ErEntity {
  const existing = entities.find((e) => e.id === next.id);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.stereotype) existing.stereotype = next.stereotype;
    return existing;
  }
  const created: ErEntity = {
    id: next.id,
    index: entities.length,
    name: next.name,
    stereotype: next.stereotype || '',
    columns: [],
    x: 0,
    y: 0
  };
  entities.push(created);
  return created;
}

function inferFkRefs(entities: ErEntity[]): void {
  const byName = new Map(entities.map((e) => [e.name.toLowerCase(), e] as const));
  const byId = new Map(entities.map((e) => [e.id.toLowerCase(), e] as const));
  for (const entity of entities) {
    for (const col of entity.columns) {
      if (!col.fk || col.refEntity) continue;
      const m = /^(.+)_id$/i.exec(col.name);
      if (!m) continue;
      const target = byName.get(m[1].toLowerCase()) || byId.get(m[1].toLowerCase());
      if (!target) continue;
      col.refEntity = target.name;
      col.refColumn = target.columns.find((c) => c.pk)?.name || 'id';
    }
  }
}

function buildKeys(entities: ErEntity[]): ErKey[] {
  const keys: ErKey[] = [];
  for (const entity of entities) {
    for (const col of entity.columns) {
      const kinds: ErKeyKind[] = [];
      if (col.pk) kinds.push('pk');
      if (col.fk) kinds.push('fk');
      if (col.unique) kinds.push('unique');
      for (const kind of kinds) {
        keys.push({
          id: `${entity.id}:${col.name}:${kind}`,
          index: keys.length,
          entityId: entity.id,
          entityName: entity.name,
          column: col.name,
          type: col.type,
          kind,
          refEntity: col.refEntity,
          refColumn: col.refColumn
        });
      }
    }
  }
  return keys;
}

function layoutEntities(entities: ErEntity[], relations: ErRelation[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const e of entities) {
    incoming.set(e.id, []);
    outgoing.set(e.id, []);
  }
  for (const r of relations) {
    outgoing.get(r.source)?.push(r.target);
    incoming.get(r.target)?.push(r.source);
  }
  const rank = new Map<string, number>();
  const starts = entities.filter((e) => !(incoming.get(e.id)?.length)).map((e) => e.id);
  (starts.length ? starts : entities.slice(0, 1).map((e) => e.id)).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, ErEntity[]>();
  for (const e of entities) {
    const r = rank.get(e.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(e);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((e, i) => {
      e.x = 48 + r * 210;
      e.y = 40 + i * 140;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: ErSourceKind,
  title: string,
  entities: ErEntity[],
  relations: ErRelation[],
  warnings: string[]
): ErDataset {
  inferFkRefs(entities);
  const nameById = new Map(entities.map((e) => [e.id, e.name] as const));
  relations.forEach((r, i) => {
    r.index = i;
    r.sourceName = nameById.get(r.source) || r.source;
    r.targetName = nameById.get(r.target) || r.target;
  });
  entities.forEach((e, i) => {
    e.index = i;
  });
  layoutEntities(entities, relations);
  const keys = buildKeys(entities);
  if (!entities.length) warnings.push('ER diagram contains no entities.');
  if (!relations.length && entities.length) warnings.push('ER diagram has entities but no relationships.');
  if (!keys.length && entities.some((e) => e.columns.length)) warnings.push('ER diagram has columns but no PK/FK/unique keys.');
  return { name, sourceKind, title: title || name, entities, relations, keys, warnings };
}

function parseXml(xml: string, fileName: string): ErDataset {
  const root = /<(?:er|erd|schema)\b([^>]*)>/i.exec(xml);
  const name = attrs(root?.[1] || '').name || fileName.replace(/\.[^.]+$/, '') || 'ER diagram';
  const entities: ErEntity[] = [];
  const relations: ErRelation[] = [];
  const entityRe = /<entity\b([^>]*)>([\s\S]*?)<\/entity>|<entity\b([^>]*)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = entityRe.exec(xml))) {
    const a = attrs(match[1] || match[3] || '');
    const id = a.id || a.name || `e-${entities.length + 1}`;
    const entity = upsertEntity(entities, { id, name: a.name || id, stereotype: a.stereotype || '' });
    const body = match[2] || '';
    for (const colMatch of body.matchAll(/<column\b([^>]*)\/?>/gi)) {
      const c = attrs(colMatch[1] || '');
      if (!c.name) continue;
      entity.columns.push({
        name: c.name,
        type: c.type || '',
        pk: truthy(c.pk || c.primary),
        fk: truthy(c.fk || c.foreign),
        unique: truthy(c.unique || c.uk),
        nullable: c.nullable ? !truthy(c.nullable === 'false' ? 'true' : c.nullable) : c.nullable !== 'false',
        refEntity: c.refEntity || c.ref || '',
        refColumn: c.refColumn || ''
      });
    }
  }
  for (const relMatch of xml.matchAll(/<(?:relation|rel|fk)\b([^>]*)\/?>/gi)) {
    const a = attrs(relMatch[1] || '');
    const source = a.source || a.from || '';
    const target = a.target || a.to || '';
    if (!source || !target) continue;
    upsertEntity(entities, { id: source, name: source });
    upsertEntity(entities, { id: target, name: target });
    relations.push({
      id: `r-${relations.length + 1}`,
      index: relations.length,
      source,
      target,
      sourceName: '',
      targetName: '',
      label: a.label || a.name || '',
      sourceCard: a.sourceCard || a.fromCard || '',
      targetCard: a.targetCard || a.toCard || ''
    });
  }
  if (!entities.length) throw new Error('ER XML contains no entities');
  return finishDataset(name, 'xml', name, entities, relations, []);
}

function parseJson(text: string, fileName: string): ErDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid ER JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('ER JSON must be an object');
  const entityRaw = (Array.isArray(obj.entities) ? obj.entities : Array.isArray(obj.tables) ? obj.tables : []) as unknown[];
  if (!entityRaw.length) throw new Error('ER JSON is missing entities');
  const entities: ErEntity[] = entityRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const cols = (Array.isArray(rec.columns) ? rec.columns : Array.isArray(rec.fields) ? rec.fields : []) as unknown[];
    return {
      id: asString(rec.id || rec.name, `e-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.id, `e-${i + 1}`),
      stereotype: asString(rec.stereotype),
      columns: cols.map((col) => {
        const c = (col ?? {}) as Record<string, unknown>;
        return {
          name: asString(c.name),
          type: asString(c.type),
          pk: Boolean(c.pk || c.primary),
          fk: Boolean(c.fk || c.foreign),
          unique: Boolean(c.unique),
          nullable: c.nullable == null ? true : Boolean(c.nullable),
          refEntity: asString(c.refEntity || c.ref),
          refColumn: asString(c.refColumn)
        };
      }).filter((c) => c.name),
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const relRaw = (Array.isArray(obj.relations) ? obj.relations : Array.isArray(obj.links) ? obj.links : []) as unknown[];
  const relations: ErRelation[] = relRaw
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
        sourceCard: asString(rec.sourceCard || rec.fromCard),
        targetCard: asString(rec.targetCard || rec.toCard)
      };
    })
    .filter((r) => r.source && r.target);
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'ER JSON'),
    'json',
    asString(obj.title || obj.name),
    entities,
    relations,
    []
  );
}

const CARD = '\\|\\||\\|o|o\\||\\}\\||\\|\\{|\\}o|o\\{';

function parseRelationLine(line: string): { left: string; right: string; sourceCard: string; targetCard: string; label: string } | null {
  const re = new RegExp(`^([A-Za-z_][\\w]*)\\s+(${CARD})\\s*--\\s*(${CARD})\\s+([A-Za-z_][\\w]*)(?:\\s*:\\s*(.+))?$`);
  const m = re.exec(line);
  if (!m) return null;
  return { left: m[1], sourceCard: m[2], targetCard: m[3], right: m[4], label: (m[5] || '').trim() };
}

function parseMermaidEr(source: string, fileName: string, sourceKind: ErSourceKind): ErDataset {
  const warnings: string[] = [];
  let title = '';
  const entities: ErEntity[] = [];
  const relations: ErRelation[] = [];
  const lines = source.split(/\r?\n/).map((l) => l.trimEnd());
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    i += 1;
    if (!line || line.startsWith('%%') || /^erDiagram\b/i.test(line)) continue;
    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      title = unquote(titleMatch[1]);
      continue;
    }
    const block = /^([A-Za-z_][\w]*)\s*\{$/.exec(line);
    if (block) {
      const id = block[1];
      const entity = upsertEntity(entities, { id, name: id });
      while (i < lines.length) {
        const inner = lines[i].trim();
        i += 1;
        if (inner === '}') break;
        const col = parseColumnLine(inner);
        if (col) entity.columns.push(col);
      }
      continue;
    }
    const rel = parseRelationLine(line);
    if (rel) {
      upsertEntity(entities, { id: rel.left, name: rel.left });
      upsertEntity(entities, { id: rel.right, name: rel.right });
      relations.push({
        id: `r-${relations.length + 1}`,
        index: relations.length,
        source: rel.left,
        target: rel.right,
        sourceName: '',
        targetName: '',
        label: rel.label,
        sourceCard: rel.sourceCard,
        targetCard: rel.targetCard
      });
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
  }
  const fallback = title || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'ER diagram';
  return finishDataset(fallback, sourceKind, title, entities, relations, warnings);
}

function parsePlantEr(source: string, fileName: string, sourceKind: ErSourceKind): ErDataset {
  const warnings: string[] = [];
  let title = '';
  const entities: ErEntity[] = [];
  const relations: ErRelation[] = [];
  const cleaned = source.replace(/\/'[\s\S]*?'\//g, '\n');
  const lines = cleaned.split(/\r?\n/).map((l) => l.replace(/'.*$/, ''));
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    i += 1;
    if (!line || /^@(start|end)uml\b/i.test(line) || /^skinparam\b|^hide\b|^show\b|^!include\b/i.test(line)) continue;
    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      title = unquote(titleMatch[1]);
      continue;
    }
    const decl = /^(?:entity|table)\s+(?:"([^"]+)"|(\S+))(?:\s+as\s+(\S+))?\s*\{?$/i.exec(line);
    if (decl) {
      const display = decl[1] || unquote(decl[2]);
      const id = decl[3] ? unquote(decl[3]) : display.replace(/\s+/g, '');
      const entity = upsertEntity(entities, { id, name: display });
      const opened = line.includes('{');
      if (opened) {
        while (i < lines.length) {
          const inner = lines[i].trim();
          i += 1;
          if (inner === '}') break;
          const col = parseColumnLine(inner);
          if (col) entity.columns.push(col);
        }
      }
      continue;
    }
    const rel = parseRelationLine(line.replace(/\s*:\s*/, ' : '));
    if (rel) {
      upsertEntity(entities, { id: rel.left, name: rel.left });
      upsertEntity(entities, { id: rel.right, name: rel.right });
      relations.push({
        id: `r-${relations.length + 1}`,
        index: relations.length,
        source: rel.left,
        target: rel.right,
        sourceName: '',
        targetName: '',
        label: rel.label,
        sourceCard: rel.sourceCard,
        targetCard: rel.targetCard
      });
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
  }
  const fallback = title || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'ER diagram';
  return finishDataset(fallback, sourceKind, title, entities, relations, warnings);
}

export function parseErDiagramText(text: string, fileName = ''): ErDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('ER diagram file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  if (looksLikeXml(raw) || (ext === 'xml' && looksLikeXml(raw))) return parseXml(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: ErSourceKind =
    extracted.fenced || ext === 'md'
      ? 'markdown'
      : ext === 'mmd' || /^erDiagram\b/i.test(extracted.source)
        ? 'mermaid'
        : ext === 'txt'
          ? 'txt'
          : 'puml';
  if (/^erDiagram\b/i.test(extracted.source)) {
    const parsed = parseMermaidEr(extracted.source, fileName, sourceKind);
    if (!parsed.entities.length) throw new Error('ER diagram contains no entities');
    return parsed;
  }
  if (
    /@startuml\b/i.test(extracted.source) ||
    /\b(entity|table)\b/i.test(extracted.source) ||
    new RegExp(`\\b(?:${CARD})\\s*--\\s*(?:${CARD})\\b`).test(extracted.source)
  ) {
    const parsed = parsePlantEr(extracted.source, fileName, sourceKind);
    if (!parsed.entities.length) throw new Error('ER diagram contains no entities');
    return parsed;
  }
  throw new Error('Not an ER diagram');
}

export function parseErDiagramBytes(bytes: Uint8Array, fileName = ''): ErDataset {
  if (!bytes.length) throw new Error('ER diagram file is empty');
  return parseErDiagramText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterErEntities(entities: ErEntity[], query: string): ErEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return entities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return entities.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('entity:') || token.startsWith('table:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return e.name.toLowerCase().includes(needle) || e.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('attr:') || token.startsWith('col:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return e.columns.some((c) => c.name.toLowerCase().includes(needle) || c.type.toLowerCase().includes(needle));
      }
      if (token.startsWith('key:')) {
        const kind = token.slice(4);
        return e.columns.some((c) => (kind === 'pk' && c.pk) || (kind === 'fk' && c.fk) || ((kind === 'uk' || kind === 'unique') && c.unique));
      }
      return `${e.id} ${e.name} ${e.stereotype} ${e.columns.map((c) => `${c.name} ${c.type}`).join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterErKeys(keys: ErKey[], query: string): ErKey[] {
  const q = query.trim().toLowerCase();
  if (!q) return keys;
  const tokens = q.split(/\s+/).filter(Boolean);
  return keys.filter((k) =>
    tokens.every((token) => {
      if (token.startsWith('key:')) {
        const kind = token.slice(4);
        return k.kind === kind || ((kind === 'uk' || kind === 'unique') && k.kind === 'unique');
      }
      if (token.startsWith('entity:')) return k.entityName.toLowerCase().includes(token.slice(7)) || k.entityId.toLowerCase().includes(token.slice(7));
      if (token.startsWith('attr:') || token.startsWith('col:')) return k.column.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      return `${k.entityName} ${k.column} ${k.type} ${k.kind} ${k.refEntity} ${k.refColumn}`.toLowerCase().includes(token);
    })
  );
}

export function filterErRelations(relations: ErRelation[], query: string): ErRelation[] {
  const q = query.trim().toLowerCase();
  if (!q) return relations;
  const tokens = q.split(/\s+/).filter(Boolean);
  return relations.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('rel:') || token.startsWith('label:')) return r.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return r.sourceName.toLowerCase().includes(token.slice(5)) || r.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return r.targetName.toLowerCase().includes(token.slice(3)) || r.target.toLowerCase().includes(token.slice(3));
      return `${r.source} ${r.target} ${r.sourceName} ${r.targetName} ${r.label} ${r.sourceCard} ${r.targetCard}`.toLowerCase().includes(token);
    })
  );
}
