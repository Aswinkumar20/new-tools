import type {
  DbmlColumn,
  DbmlDataset,
  DbmlRef,
  DbmlRelKind,
  DbmlSourceKind,
  DbmlTable
} from '../types/dbml-viewer.types';

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
  return /<(?:dbml|schema|tables|table)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:dbml|database)?\s*([\s\S]*?)```/i.exec(text);
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

function stripDbmlComments(text: string): string {
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

function splitSettings(raw: string): string[] {
  const out: string[] = [];
  let buf = '';
  let quote = '';
  for (const ch of raw) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === ',') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function parseEndpoint(token: string): { table: string; column: string } {
  const cleaned = token.trim();
  const composite = /^(.+?)\.\(([^)]+)\)$/.exec(cleaned);
  if (composite) return { table: unquote(composite[1]), column: composite[2].split(',')[0].trim() };
  const dotted = /^(.+)\.([^.]+)$/.exec(cleaned);
  if (dotted) return { table: unquote(dotted[1]), column: unquote(dotted[2]) };
  return { table: unquote(cleaned), column: '' };
}

function parseRelToken(raw: string): DbmlRelKind {
  const v = raw.trim();
  if (v === '>' || v === '<' || v === '-' || v === '<>') return v;
  return v || '>';
}

function emptyColumn(): Omit<DbmlColumn, 'name' | 'type'> {
  return {
    pk: false,
    fk: false,
    unique: false,
    nullable: true,
    increment: false,
    note: '',
    refTable: '',
    refColumn: ''
  };
}

function upsertTable(tables: DbmlTable[], next: { id: string; name: string; alias?: string; note?: string }): DbmlTable {
  const existing = tables.find((t) => t.id === next.id || t.name === next.name || (next.alias && t.alias === next.alias));
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.alias) existing.alias = next.alias;
    if (next.note) existing.note = next.note;
    return existing;
  }
  const created: DbmlTable = {
    id: next.id,
    index: tables.length,
    name: next.name,
    alias: next.alias || '',
    note: next.note || '',
    columns: [],
    x: 0,
    y: 0
  };
  tables.push(created);
  return created;
}

function ensureColumn(table: DbmlTable, name: string): DbmlColumn {
  const existing = table.columns.find((c) => c.name === name);
  if (existing) return existing;
  const created: DbmlColumn = { name, type: '', ...emptyColumn() };
  table.columns.push(created);
  return created;
}

function applySettings(column: DbmlColumn, settings: string): { rel: DbmlRelKind; refTable: string; refColumn: string } | null {
  let inline: { rel: DbmlRelKind; refTable: string; refColumn: string } | null = null;
  for (const part of splitSettings(settings)) {
    const lower = part.toLowerCase();
    if (lower === 'pk' || lower === 'primary key') column.pk = true;
    else if (lower === 'increment' || lower === 'incremented') column.increment = true;
    else if (lower === 'unique') column.unique = true;
    else if (lower === 'not null') column.nullable = false;
    else if (lower === 'null') column.nullable = true;
    else if (lower.startsWith('note:')) column.note = unquote(part.slice(5).trim());
    else if (lower.startsWith('ref:')) {
      const expr = part.slice(4).trim();
      const relMatch = /^(<>|<|>|-)\s*(.+)$/.exec(expr);
      if (!relMatch) continue;
      const dest = parseEndpoint(relMatch[2]);
      column.fk = true;
      column.refTable = dest.table;
      column.refColumn = dest.column || 'id';
      inline = { rel: parseRelToken(relMatch[1]), refTable: column.refTable, refColumn: column.refColumn };
    }
  }
  return inline;
}

function layoutTables(tables: DbmlTable[], refs: DbmlRef[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const t of tables) {
    incoming.set(t.id, []);
    outgoing.set(t.id, []);
  }
  for (const r of refs) {
    outgoing.get(r.source)?.push(r.target);
    incoming.get(r.target)?.push(r.source);
  }
  const rank = new Map<string, number>();
  const starts = tables.filter((t) => !(incoming.get(t.id)?.length)).map((t) => t.id);
  (starts.length ? starts : tables.slice(0, 1).map((t) => t.id)).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, DbmlTable[]>();
  for (const t of tables) {
    const r = rank.get(t.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(t);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((t, i) => {
      t.x = 48 + r * 210;
      t.y = 40 + i * 140;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: DbmlSourceKind,
  title: string,
  databaseType: string,
  tables: DbmlTable[],
  refs: DbmlRef[],
  warnings: string[]
): DbmlDataset {
  const nameById = new Map(tables.map((t) => [t.id, t.name] as const));
  refs.forEach((r, i) => {
    r.index = i;
    r.sourceName = nameById.get(r.source) || r.source;
    r.targetName = nameById.get(r.target) || r.target;
  });
  tables.forEach((t, i) => {
    t.index = i;
  });
  layoutTables(tables, refs);
  if (!tables.length) warnings.push('DBML contains no tables.');
  if (!refs.length && tables.length) warnings.push('DBML has tables but no refs.');
  return { name, sourceKind, title: title || name, databaseType, tables, refs, warnings };
}

function pushRef(
  refs: DbmlRef[],
  tables: DbmlTable[],
  next: { name?: string; source: string; target: string; sourceColumn: string; targetColumn: string; rel: DbmlRelKind }
): void {
  if (!next.source || !next.target) return;
  const sourceTable = upsertTable(tables, { id: next.source, name: next.source });
  const targetTable = upsertTable(tables, { id: next.target, name: next.target });
  if (next.sourceColumn) {
    const col = ensureColumn(sourceTable, next.sourceColumn);
    col.fk = true;
    col.refTable = next.target;
    col.refColumn = next.targetColumn || 'id';
  }
  if (next.targetColumn) ensureColumn(targetTable, next.targetColumn);
  const dup = refs.some(
    (r) =>
      r.source === next.source &&
      r.target === next.target &&
      r.sourceColumn === next.sourceColumn &&
      r.targetColumn === next.targetColumn
  );
  if (dup) return;
  refs.push({
    id: `r-${refs.length + 1}`,
    index: refs.length,
    name: next.name || '',
    source: next.source,
    target: next.target,
    sourceName: '',
    targetName: '',
    sourceColumn: next.sourceColumn,
    targetColumn: next.targetColumn,
    rel: next.rel
  });
}

function parseColumnLine(line: string, table: DbmlTable, tables: DbmlTable[], refs: DbmlRef[]): boolean {
  const trimmed = line.trim();
  if (!trimmed || /^indexes\b/i.test(trimmed) || trimmed === '{' || trimmed === '}') return false;
  const note = /^Note\s*:\s*(.+)$/i.exec(trimmed);
  if (note) {
    table.note = unquote(note[1]);
    return true;
  }
  const col = /^([A-Za-z_][\w]*)\s+([A-Za-z_][\w.()[\]]*)(?:\s*\[([^\]]*)\])?\s*$/.exec(trimmed);
  if (!col) return false;
  const column: DbmlColumn = { name: col[1], type: col[2], ...emptyColumn() };
  const inline = col[3] ? applySettings(column, col[3]) : null;
  table.columns.push(column);
  if (inline) {
    pushRef(refs, tables, {
      source: table.id,
      target: inline.refTable,
      sourceColumn: column.name,
      targetColumn: inline.refColumn,
      rel: inline.rel
    });
  }
  return true;
}

function parseDbmlSource(source: string, fileName: string, sourceKind: DbmlSourceKind): DbmlDataset {
  const warnings: string[] = [];
  const cleaned = stripDbmlComments(source);
  const tables: DbmlTable[] = [];
  const refs: DbmlRef[] = [];
  let title = '';
  let databaseType = '';
  let i = 0;
  while (i < cleaned.length) {
    const slice = cleaned.slice(i);
    const project = /^\s*Project\s+([A-Za-z_][\w]*)\s*\{/i.exec(slice);
    if (project && project.index === 0) {
      title = project[1];
      const open = i + project[0].lastIndexOf('{');
      const block = extractBraceBlock(cleaned, open);
      if (!block) {
        warnings.push('Unclosed Project block');
        break;
      }
      const dbType = /database_type\s*:\s*(.+)/i.exec(block.body);
      if (dbType) databaseType = unquote(dbType[1]);
      const note = /Note\s*:\s*(.+)/i.exec(block.body);
      if (note && !title) title = unquote(note[1]);
      i = block.end;
      continue;
    }
    const tableMatch = /^\s*Table\s+((?:"[^"]+"|[\w.]+))(?:\s+as\s+(\w+))?\s*\{/i.exec(slice);
    if (tableMatch && tableMatch.index === 0) {
      const name = unquote(tableMatch[1]);
      const alias = tableMatch[2] || '';
      const open = i + tableMatch[0].lastIndexOf('{');
      const block = extractBraceBlock(cleaned, open);
      if (!block) {
        warnings.push(`Unclosed Table ${name}`);
        break;
      }
      const table = upsertTable(tables, { id: name, name, alias });
      const lines = block.body
        .replace(/\bIndexes\s*\{[\s\S]*?\}/gi, '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        if (!parseColumnLine(line, table, tables, refs) && !/^Note\b/i.test(line)) warnings.push(`Skipped line in ${name}: ${line}`);
      }
      i = block.end;
      continue;
    }
    const refMatch = /^\s*Ref(?:\s+([\w]+))?\s*:\s*(.+)$/im.exec(slice);
    if (refMatch && refMatch.index === 0) {
      const expr = refMatch[2].trim();
      const relMatch = /^(.+?)\s*(<>|<|>|-)\s*(.+)$/.exec(expr);
      if (relMatch) {
        const left = parseEndpoint(relMatch[1]);
        const right = parseEndpoint(relMatch[3]);
        pushRef(refs, tables, {
          name: refMatch[1] || '',
          source: left.table,
          target: right.table,
          sourceColumn: left.column,
          targetColumn: right.column,
          rel: parseRelToken(relMatch[2])
        });
      } else warnings.push(`Skipped Ref: ${expr}`);
      const lineEnd = cleaned.indexOf('\n', i);
      i = lineEnd < 0 ? cleaned.length : lineEnd + 1;
      continue;
    }
    const enumMatch = /^\s*Enum\s+\S+\s*\{/i.exec(slice);
    if (enumMatch && enumMatch.index === 0) {
      const open = i + enumMatch[0].lastIndexOf('{');
      const block = extractBraceBlock(cleaned, open);
      i = block ? block.end : i + enumMatch[0].length;
      continue;
    }
    const nextNl = cleaned.indexOf('\n', i);
    if (nextNl < 0) break;
    const leftover = cleaned.slice(i, nextNl).trim();
    if (leftover) warnings.push(`Skipped line: ${leftover}`);
    i = nextNl + 1;
  }
  const fallback = title || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'DBML schema';
  return finishDataset(fallback, sourceKind, title, databaseType, tables, refs, warnings);
}

function parseXml(xml: string, fileName: string): DbmlDataset {
  const root = /<(?:dbml|schema)\b([^>]*)>/i.exec(xml);
  const a = attrs(root?.[1] || '');
  const name = a.name || fileName.replace(/\.[^.]+$/, '') || 'DBML';
  const tables: DbmlTable[] = [];
  const refs: DbmlRef[] = [];
  const tableRe = /<table\b([^>]*)>([\s\S]*?)<\/table>|<table\b([^>]*)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = tableRe.exec(xml))) {
    const ta = attrs(match[1] || match[3] || '');
    const id = ta.id || ta.name || `t-${tables.length + 1}`;
    const table = upsertTable(tables, { id, name: ta.name || id, alias: ta.alias || '', note: ta.note || '' });
    const body = match[2] || '';
    for (const colMatch of body.matchAll(/<column\b([^>]*)\/?>/gi)) {
      const c = attrs(colMatch[1] || '');
      if (!c.name) continue;
      table.columns.push({
        name: c.name,
        type: c.type || '',
        pk: truthy(c.pk),
        fk: truthy(c.fk),
        unique: truthy(c.unique),
        nullable: c.nullable === 'false' ? false : true,
        increment: truthy(c.increment),
        note: c.note || '',
        refTable: c.refTable || '',
        refColumn: c.refColumn || ''
      });
    }
  }
  for (const relMatch of xml.matchAll(/<(?:ref|reference)\b([^>]*)\/?>/gi)) {
    const r = attrs(relMatch[1] || '');
    pushRef(refs, tables, {
      name: r.name || '',
      source: r.source || r.from || '',
      target: r.target || r.to || '',
      sourceColumn: r.sourceColumn || r.fromColumn || '',
      targetColumn: r.targetColumn || r.toColumn || '',
      rel: parseRelToken(r.rel || r.card || '>')
    });
  }
  if (!tables.length) throw new Error('DBML XML contains no tables');
  return finishDataset(name, 'xml', name, a.databaseType || '', tables, refs, []);
}

function parseJson(text: string, fileName: string): DbmlDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid DBML JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('DBML JSON must be an object');
  const tableRaw = (Array.isArray(obj.tables) ? obj.tables : []) as unknown[];
  if (!tableRaw.length) throw new Error('DBML JSON is missing tables');
  const tables: DbmlTable[] = tableRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const cols = (Array.isArray(rec.columns) ? rec.columns : []) as unknown[];
    return {
      id: asString(rec.id || rec.name, `t-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.id, `t-${i + 1}`),
      alias: asString(rec.alias),
      note: asString(rec.note),
      columns: cols
        .map((col) => {
          const c = (col ?? {}) as Record<string, unknown>;
          return {
            name: asString(c.name),
            type: asString(c.type),
            pk: Boolean(c.pk),
            fk: Boolean(c.fk),
            unique: Boolean(c.unique),
            nullable: c.nullable == null ? true : Boolean(c.nullable),
            increment: Boolean(c.increment),
            note: asString(c.note),
            refTable: asString(c.refTable || c.ref),
            refColumn: asString(c.refColumn)
          };
        })
        .filter((c) => c.name),
      x: 0,
      y: 0
    };
  });
  const refs: DbmlRef[] = [];
  const refRaw = (Array.isArray(obj.refs) ? obj.refs : Array.isArray(obj.references) ? obj.references : []) as unknown[];
  for (const item of refRaw) {
    const rec = (item ?? {}) as Record<string, unknown>;
    pushRef(refs, tables, {
      name: asString(rec.name),
      source: asString(rec.source || rec.from),
      target: asString(rec.target || rec.to),
      sourceColumn: asString(rec.sourceColumn || rec.fromColumn),
      targetColumn: asString(rec.targetColumn || rec.toColumn),
      rel: parseRelToken(asString(rec.rel || rec.card, '>'))
    });
  }
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'DBML JSON'),
    'json',
    asString(obj.title || obj.name),
    asString(obj.databaseType || obj.database_type),
    tables,
    refs,
    []
  );
}

export function parseDbmlText(text: string, fileName = ''): DbmlDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('DBML file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  if (looksLikeXml(raw) || (ext === 'xml' && looksLikeXml(raw))) return parseXml(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: DbmlSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : 'dbml';
  if (
    /\bTable\b/i.test(extracted.source) ||
    /\bRef\s*:/i.test(extracted.source) ||
    /\bProject\b/i.test(extracted.source)
  ) {
    const parsed = parseDbmlSource(extracted.source, fileName, sourceKind);
    if (!parsed.tables.length) throw new Error('DBML contains no tables');
    return parsed;
  }
  throw new Error('Not a DBML schema');
}

export function parseDbmlBytes(bytes: Uint8Array, fileName = ''): DbmlDataset {
  if (!bytes.length) throw new Error('DBML file is empty');
  return parseDbmlText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterDbmlTables(tables: DbmlTable[], query: string): DbmlTable[] {
  const q = query.trim().toLowerCase();
  if (!q) return tables;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tables.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('table:')) {
        const needle = token.slice(6);
        return t.name.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle) || t.alias.toLowerCase().includes(needle);
      }
      if (token.startsWith('col:') || token.startsWith('attr:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return t.columns.some((c) => c.name.toLowerCase().includes(needle) || c.type.toLowerCase().includes(needle));
      }
      return `${t.id} ${t.name} ${t.alias} ${t.note} ${t.columns.map((c) => `${c.name} ${c.type}`).join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterDbmlRefs(refs: DbmlRef[], query: string): DbmlRef[] {
  const q = query.trim().toLowerCase();
  if (!q) return refs;
  const tokens = q.split(/\s+/).filter(Boolean);
  return refs.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('ref:') || token.startsWith('rel:')) return `${r.rel} ${r.name}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return r.sourceName.toLowerCase().includes(token.slice(5)) || r.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return r.targetName.toLowerCase().includes(token.slice(3)) || r.target.toLowerCase().includes(token.slice(3));
      return `${r.source} ${r.target} ${r.sourceName} ${r.targetName} ${r.sourceColumn} ${r.targetColumn} ${r.rel} ${r.name}`.toLowerCase().includes(token);
    })
  );
}
