import type {
  SqlsColumn,
  SqlsDataset,
  SqlsFk,
  SqlsSourceKind,
  SqlsTable
} from '../types/sql-schema-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function unquote(value: string): string {
  return value.trim().replace(/^["'`\[]+|[\]"'`]+$/g, '');
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:schema|sql|tables|table)\b/i.test(text) && !/<dbml\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:sql|ddl|postgres|mysql|sqlite)?\s*([\s\S]*?)```/i.exec(text);
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

function stripSqlComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/--[^\n]*/g, '');
}

function extractParenBlock(source: string, openIdx: number): { body: string; end: number } | null {
  if (source[openIdx] !== '(') return null;
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return { body: source.slice(openIdx + 1, i), end: i + 1 };
    }
  }
  return null;
}

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  for (const ch of body) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function emptyColumn(): Omit<SqlsColumn, 'name' | 'type'> {
  return { pk: false, fk: false, unique: false, nullable: true, refTable: '', refColumn: '' };
}

function upsertTable(tables: SqlsTable[], next: { id: string; name: string }): SqlsTable {
  const existing = tables.find((t) => t.id === next.id || t.name.toLowerCase() === next.name.toLowerCase());
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    return existing;
  }
  const created: SqlsTable = { id: next.id, index: tables.length, name: next.name, columns: [], x: 0, y: 0 };
  tables.push(created);
  return created;
}

function ensureColumn(table: SqlsTable, name: string): SqlsColumn {
  const existing = table.columns.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const created: SqlsColumn = { name, type: '', ...emptyColumn() };
  table.columns.push(created);
  return created;
}

function layoutTables(tables: SqlsTable[], fks: SqlsFk[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const t of tables) {
    incoming.set(t.id, []);
    outgoing.set(t.id, []);
  }
  for (const fk of fks) {
    outgoing.get(fk.source)?.push(fk.target);
    incoming.get(fk.target)?.push(fk.source);
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
  const buckets = new Map<number, SqlsTable[]>();
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
  sourceKind: SqlsSourceKind,
  title: string,
  tables: SqlsTable[],
  fks: SqlsFk[],
  warnings: string[]
): SqlsDataset {
  const nameById = new Map(tables.map((t) => [t.id, t.name] as const));
  const nameByLower = new Map(tables.map((t) => [t.name.toLowerCase(), t.name] as const));
  fks.forEach((fk, i) => {
    fk.index = i;
    fk.sourceName = nameById.get(fk.source) || nameByLower.get(fk.source.toLowerCase()) || fk.source;
    fk.targetName = nameById.get(fk.target) || nameByLower.get(fk.target.toLowerCase()) || fk.target;
  });
  tables.forEach((t, i) => {
    t.index = i;
  });
  layoutTables(tables, fks);
  if (!tables.length) warnings.push('SQL schema contains no tables.');
  if (!fks.length && tables.length) warnings.push('SQL schema has tables but no foreign keys.');
  return { name, sourceKind, title: title || name, tables, fks, warnings };
}

function pushFk(
  fks: SqlsFk[],
  tables: SqlsTable[],
  next: { name?: string; source: string; target: string; sourceColumn: string; targetColumn: string }
): void {
  if (!next.source || !next.target) return;
  const sourceTable = upsertTable(tables, { id: next.source, name: next.source });
  upsertTable(tables, { id: next.target, name: next.target });
  if (next.sourceColumn) {
    const col = ensureColumn(sourceTable, next.sourceColumn);
    col.fk = true;
    col.refTable = next.target;
    col.refColumn = next.targetColumn || 'id';
  }
  const dup = fks.some(
    (fk) =>
      fk.source.toLowerCase() === next.source.toLowerCase() &&
      fk.target.toLowerCase() === next.target.toLowerCase() &&
      fk.sourceColumn.toLowerCase() === next.sourceColumn.toLowerCase() &&
      fk.targetColumn.toLowerCase() === next.targetColumn.toLowerCase()
  );
  if (dup) return;
  fks.push({
    id: `fk-${fks.length + 1}`,
    index: fks.length,
    name: next.name || '',
    source: next.source,
    target: next.target,
    sourceName: '',
    targetName: '',
    sourceColumn: next.sourceColumn,
    targetColumn: next.targetColumn
  });
}

function parseColumnDef(def: string, table: SqlsTable, tables: SqlsTable[], fks: SqlsFk[]): void {
  const pkTable = /^(?:CONSTRAINT\s+\S+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(def);
  if (pkTable) {
    for (const name of pkTable[1].split(',').map((s) => unquote(s))) {
      if (name) ensureColumn(table, name).pk = true;
    }
    return;
  }
  const uniqueTable = /^(?:CONSTRAINT\s+\S+\s+)?UNIQUE\s*\(([^)]+)\)/i.exec(def);
  if (uniqueTable) {
    for (const name of uniqueTable[1].split(',').map((s) => unquote(s))) {
      if (name) ensureColumn(table, name).unique = true;
    }
    return;
  }
  const fkTable =
    /^(?:CONSTRAINT\s+(\S+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w.]+))\s*\(([^)]+)\)/i.exec(
      def
    );
  if (fkTable) {
    const srcCols = fkTable[2].split(',').map((s) => unquote(s)).filter(Boolean);
    const tgtCols = fkTable[4].split(',').map((s) => unquote(s)).filter(Boolean);
    srcCols.forEach((col, i) => {
      pushFk(fks, tables, {
        name: fkTable[1] || '',
        source: table.id,
        target: unquote(fkTable[3]),
        sourceColumn: col,
        targetColumn: tgtCols[i] || tgtCols[0] || 'id'
      });
    });
    return;
  }
  const colMatch = /^((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w]*))\s+([A-Za-z_][\w]*(?:\s*\([^)]*\))?)\s*(.*)$/i.exec(def);
  if (!colMatch) return;
  const column: SqlsColumn = { name: unquote(colMatch[1]), type: colMatch[2].replace(/\s+/g, ''), ...emptyColumn() };
  const rest = colMatch[3] || '';
  const upper = rest.toUpperCase();
  if (/\bPRIMARY\s+KEY\b/.test(upper)) column.pk = true;
  if (/\bUNIQUE\b/.test(upper)) column.unique = true;
  if (/\bNOT\s+NULL\b/.test(upper)) column.nullable = false;
  const ref = /\bREFERENCES\s+((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w.]+))\s*(?:\(([^)]+)\))?/i.exec(rest);
  if (ref) {
    column.fk = true;
    column.refTable = unquote(ref[1]);
    column.refColumn = unquote(ref[2] || 'id');
    pushFk(fks, tables, {
      source: table.id,
      target: column.refTable,
      sourceColumn: column.name,
      targetColumn: column.refColumn
    });
  }
  table.columns.push(column);
}

function parseSqlSource(source: string, fileName: string, sourceKind: SqlsSourceKind): SqlsDataset {
  const warnings: string[] = [];
  const cleaned = stripSqlComments(source);
  const tables: SqlsTable[] = [];
  const fks: SqlsFk[] = [];
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w.]+))\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = createRe.exec(cleaned))) {
    const name = unquote(match[1]);
    const openIdx = match.index + match[0].length - 1;
    const block = extractParenBlock(cleaned, openIdx);
    if (!block) {
      warnings.push(`Unclosed CREATE TABLE ${name}`);
      continue;
    }
    const table = upsertTable(tables, { id: name, name });
    for (const def of splitTopLevel(block.body)) parseColumnDef(def, table, tables, fks);
    createRe.lastIndex = block.end;
  }
  const alterRe =
    /ALTER\s+TABLE\s+((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w.]+))\s+ADD\s+(?:CONSTRAINT\s+(\S+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w.]+))\s*\(([^)]+)\)/gi;
  while ((match = alterRe.exec(cleaned))) {
    const sourceName = unquote(match[1]);
    const srcCols = match[3].split(',').map((s) => unquote(s)).filter(Boolean);
    const tgtCols = match[5].split(',').map((s) => unquote(s)).filter(Boolean);
    srcCols.forEach((col, i) => {
      pushFk(fks, tables, {
        name: match?.[2] || '',
        source: sourceName,
        target: unquote(match?.[4] || ''),
        sourceColumn: col,
        targetColumn: tgtCols[i] || tgtCols[0] || 'id'
      });
    });
  }
  const fallback = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'SQL schema';
  return finishDataset(fallback, sourceKind, fallback, tables, fks, warnings);
}

function parseXml(xml: string, fileName: string): SqlsDataset {
  const root = /<(?:schema|sql)\b([^>]*)>/i.exec(xml);
  const name = attrs(root?.[1] || '').name || fileName.replace(/\.[^.]+$/, '') || 'SQL schema';
  const tables: SqlsTable[] = [];
  const fks: SqlsFk[] = [];
  const tableRe = /<table\b([^>]*)>([\s\S]*?)<\/table>|<table\b([^>]*)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = tableRe.exec(xml))) {
    const a = attrs(match[1] || match[3] || '');
    const id = a.id || a.name || `t-${tables.length + 1}`;
    const table = upsertTable(tables, { id, name: a.name || id });
    for (const colMatch of (match[2] || '').matchAll(/<column\b([^>]*)\/?>/gi)) {
      const c = attrs(colMatch[1] || '');
      if (!c.name) continue;
      table.columns.push({
        name: c.name,
        type: c.type || '',
        pk: truthy(c.pk),
        fk: truthy(c.fk),
        unique: truthy(c.unique),
        nullable: c.nullable === 'false' ? false : true,
        refTable: c.refTable || '',
        refColumn: c.refColumn || ''
      });
    }
  }
  for (const fkMatch of xml.matchAll(/<(?:fk|foreign[-_]?key)\b([^>]*)\/?>/gi)) {
    const a = attrs(fkMatch[1] || '');
    pushFk(fks, tables, {
      name: a.name || '',
      source: a.source || a.from || '',
      target: a.target || a.to || '',
      sourceColumn: a.sourceColumn || a.fromColumn || '',
      targetColumn: a.targetColumn || a.toColumn || ''
    });
  }
  if (!tables.length) throw new Error('SQL schema XML contains no tables');
  return finishDataset(name, 'xml', name, tables, fks, []);
}

function parseJson(text: string, fileName: string): SqlsDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid SQL schema JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('SQL schema JSON must be an object');
  const tableRaw = (Array.isArray(obj.tables) ? obj.tables : []) as unknown[];
  if (!tableRaw.length) throw new Error('SQL schema JSON is missing tables');
  const tables: SqlsTable[] = tableRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const cols = (Array.isArray(rec.columns) ? rec.columns : []) as unknown[];
    return {
      id: asString(rec.id || rec.name, `t-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.id, `t-${i + 1}`),
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
            refTable: asString(c.refTable || c.ref),
            refColumn: asString(c.refColumn)
          };
        })
        .filter((c) => c.name),
      x: 0,
      y: 0
    };
  });
  const fks: SqlsFk[] = [];
  const fkRaw = (Array.isArray(obj.fks) ? obj.fks : Array.isArray(obj.foreignKeys) ? obj.foreignKeys : []) as unknown[];
  for (const item of fkRaw) {
    const rec = (item ?? {}) as Record<string, unknown>;
    pushFk(fks, tables, {
      name: asString(rec.name),
      source: asString(rec.source || rec.from),
      target: asString(rec.target || rec.to),
      sourceColumn: asString(rec.sourceColumn || rec.fromColumn),
      targetColumn: asString(rec.targetColumn || rec.toColumn)
    });
  }
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'SQL schema JSON'),
    'json',
    asString(obj.title || obj.name),
    tables,
    fks,
    []
  );
}

export function parseSqlSchemaText(text: string, fileName = ''): SqlsDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('SQL schema file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  if (looksLikeXml(raw) || (ext === 'xml' && looksLikeXml(raw))) return parseXml(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: SqlsSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : 'sql';
  if (/\bCREATE\s+TABLE\b/i.test(extracted.source) || /\bALTER\s+TABLE\b/i.test(extracted.source)) {
    const parsed = parseSqlSource(extracted.source, fileName, sourceKind);
    if (!parsed.tables.length) throw new Error('SQL schema contains no tables');
    return parsed;
  }
  throw new Error('Not a SQL schema');
}

export function parseSqlSchemaBytes(bytes: Uint8Array, fileName = ''): SqlsDataset {
  if (!bytes.length) throw new Error('SQL schema file is empty');
  return parseSqlSchemaText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterSqlsTables(tables: SqlsTable[], query: string): SqlsTable[] {
  const q = query.trim().toLowerCase();
  if (!q) return tables;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tables.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('table:')) {
        const needle = token.slice(6);
        return t.name.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('col:') || token.startsWith('attr:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return t.columns.some((c) => c.name.toLowerCase().includes(needle) || c.type.toLowerCase().includes(needle));
      }
      if (token.startsWith('fk:')) {
        const needle = token.slice(3);
        return t.columns.some((c) => c.fk && (`${c.name} ${c.refTable}`.toLowerCase().includes(needle)));
      }
      return `${t.id} ${t.name} ${t.columns.map((c) => `${c.name} ${c.type}`).join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterSqlsFks(fks: SqlsFk[], query: string): SqlsFk[] {
  const q = query.trim().toLowerCase();
  if (!q) return fks;
  const tokens = q.split(/\s+/).filter(Boolean);
  return fks.filter((fk) =>
    tokens.every((token) => {
      if (token.startsWith('fk:') || token.startsWith('rel:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return `${fk.name} ${fk.sourceColumn} ${fk.target}`.toLowerCase().includes(needle);
      }
      if (token.startsWith('from:')) return fk.sourceName.toLowerCase().includes(token.slice(5)) || fk.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return fk.targetName.toLowerCase().includes(token.slice(3)) || fk.target.toLowerCase().includes(token.slice(3));
      return `${fk.source} ${fk.target} ${fk.sourceName} ${fk.targetName} ${fk.sourceColumn} ${fk.targetColumn} ${fk.name}`.toLowerCase().includes(token);
    })
  );
}
