import type { DlColumn, DlDataset, DlSourceKind, DlVersion } from '../types/delta-lake-viewer.types';
import { DL_SHOP_ROWS } from '../constants/delta-lake-viewer-sample.data';
import { isGzipMagic } from './data-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const DLTA = new Uint8Array([0x44, 0x4c, 0x54, 0x41]);

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

function cell(value: unknown): string {
  return value == null ? '' : String(value);
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function magicEq(bytes: Uint8Array, offset: number, magic: Uint8Array): boolean {
  if (offset < 0 || offset + magic.length > bytes.length) return false;
  for (let i = 0; i < magic.length; i++) if (bytes[offset + i] !== magic[i]) return false;
  return true;
}

function isoFromMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  try {
    return new Date(ms).toISOString();
  } catch {
    return String(ms);
  }
}

function deltaType(raw: unknown): string {
  if (typeof raw === 'string') return raw.toUpperCase();
  const obj = rec(raw);
  const t = asString(obj.type || obj.name);
  return (t || 'STRING').toUpperCase();
}

function finishDataset(
  name: string,
  sourceKind: DlSourceKind,
  title: string,
  protocol: string,
  numRows: number,
  columns: DlColumn[],
  versions: DlVersion[],
  rows: Array<Record<string, string>>,
  warnings: string[]
): DlDataset {
  if (!columns.length) throw new Error('Delta table contains no schema columns');
  const safeVersions =
    versions.length > 0
      ? versions
      : [{ version: 0, timestamp: '—', operation: 'WRITE', numFiles: 1, numRows: numRows || rows.length }];
  return {
    name,
    sourceKind,
    title: title || name,
    protocol,
    numRows: numRows || rows.length,
    columns,
    versions: safeVersions,
    rows,
    warnings
  };
}

function ingestColumn(columns: DlColumn[], row: Record<string, unknown>, index: number): void {
  const name = asString(row.name || row.column || row.field || row.id);
  if (!name) return;
  columns.push({
    id: name,
    index,
    name,
    type: deltaType(row.type || row.dataType || 'STRING'),
    path: asString(row.path, name),
    nullable: row.nullable !== false
  });
}

function parseSchemaString(schemaString: string, columns: DlColumn[]): void {
  if (!schemaString) return;
  try {
    const parsed = JSON.parse(schemaString) as unknown;
    const root = rec(parsed);
    const fields = Array.isArray(root.fields) ? root.fields : Array.isArray(parsed) ? parsed : [];
    fields.forEach((item, i) => ingestColumn(columns, rec(item), i));
  } catch {
    const names = [...schemaString.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    const types = [...schemaString.matchAll(/"type"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    names.forEach((name, i) => {
      if (name === 'struct') return;
      ingestColumn(columns, { name, type: types[i + 1] || types[i] || 'STRING' }, columns.length);
    });
  }
}

export function buildSampleDeltaBytes(rows: ReadonlyArray<Record<string, string | number>> = DL_SHOP_ROWS): Uint8Array {
  const payload = te.encode(
    JSON.stringify({
      format: 'delta',
      name: 'EventLog',
      protocol: { minReaderVersion: 1, minWriterVersion: 2 },
      versions: [
        { version: 0, timestamp: '2024-03-01T10:00:00Z', operation: 'CREATE TABLE', numFiles: 1, numRows: rows.length },
        { version: 1, timestamp: '2024-03-02T12:00:00Z', operation: 'WRITE', numFiles: 1, numRows: rows.length }
      ],
      schema: [
        { name: 'orderId', type: 'LONG' },
        { name: 'sku', type: 'STRING' },
        { name: 'total', type: 'DOUBLE' },
        { name: 'itemCount', type: 'INT' }
      ],
      rows
    })
  );
  const out: number[] = [...DLTA];
  writeU32le(payload.length, out);
  out.push(...payload);
  out.push(...DLTA);
  return Uint8Array.from(out);
}

function parseDeltaBinary(bytes: Uint8Array, fileName: string): DlDataset {
  if (bytes.length < 12) throw new Error('Delta file is too small');
  if (!magicEq(bytes, 0, DLTA) || !magicEq(bytes, bytes.length - 4, DLTA)) {
    throw new Error('Not a Delta dump (missing DLTA magic)');
  }
  const jsonLen = u32le(bytes, 4);
  if (jsonLen <= 0 || 8 + jsonLen > bytes.length - 4) throw new Error('Invalid Delta payload length');
  const text = td.decode(bytes.subarray(8, 8 + jsonLen));
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Delta payload JSON is malformed');
  }
  return parseJson(parsed, fileName, 'delta');
}

function looksLikeDeltaLog(text: string): boolean {
  return (
    /"protocol"\s*:/.test(text) &&
    (/"metaData"\s*:/.test(text) || /"commitInfo"\s*:/.test(text) || /"add"\s*:/.test(text))
  );
}

function parseDeltaLog(text: string, fileName: string): DlDataset {
  const warnings: string[] = ['Parquet data files referenced by the log are not inflated in this preview'];
  const columns: DlColumn[] = [];
  const versions: DlVersion[] = [];
  const rows: Array<Record<string, string>> = [];
  let protocol = '1/2';
  let name = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Delta table';
  let versionCursor = 0;
  let totalRecords = 0;
  let fileCount = 0;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith('{')) continue;
    let obj: Record<string, unknown>;
    try {
      obj = rec(JSON.parse(line));
    } catch {
      warnings.push('Skipped a malformed delta log line');
      continue;
    }
    if (obj.protocol) {
      const p = rec(obj.protocol);
      protocol = `${Number(p.minReaderVersion || 1) || 1}/${Number(p.minWriterVersion || 2) || 2}`;
    }
    if (obj.metaData) {
      const meta = rec(obj.metaData);
      name = asString(meta.name || meta.id, name);
      parseSchemaString(asString(meta.schemaString), columns);
      if (Array.isArray(meta.schema)) meta.schema.forEach((item, i) => ingestColumn(columns, rec(item), i));
    }
    if (obj.commitInfo) {
      const info = rec(obj.commitInfo);
      const ts = Number(info.timestamp || 0) || 0;
      versions.push({
        version: Number(info.version ?? versionCursor) || versionCursor,
        timestamp: ts ? isoFromMs(ts) : asString(info.timestamp, '—'),
        operation: asString(info.operation, 'WRITE'),
        numFiles: 0,
        numRows: 0
      });
      versionCursor += 1;
    }
    if (obj.add) {
      const add = rec(obj.add);
      fileCount += 1;
      let n = 0;
      const statsRaw = asString(add.stats);
      if (statsRaw) {
        try {
          n = Number(rec(JSON.parse(statsRaw)).numRecords || 0) || 0;
        } catch {
          n = 0;
        }
      }
      totalRecords += n;
      const last = versions[versions.length - 1];
      if (last) {
        last.numFiles += 1;
        last.numRows += n;
      }
    }
    if (Array.isArray(obj.rows)) {
      for (const item of obj.rows) {
        const row = rec(item);
        if (!columns.length) Object.keys(row).forEach((key, i) => ingestColumn(columns, { name: key, type: 'STRING' }, i));
        const out: Record<string, string> = {};
        for (const c of columns) out[c.name] = cell(row[c.name]);
        rows.push(out);
      }
    }
  }

  if (!versions.length) {
    versions.push({
      version: 0,
      timestamp: '—',
      operation: 'WRITE',
      numFiles: fileCount || 1,
      numRows: totalRecords || rows.length
    });
  }
  if (!columns.length) throw new Error('Delta log contains no schema');
  if (!rows.length) warnings.push('No preview rows — schema and versions only');
  return finishDataset(name, 'delta', name, protocol, totalRecords || rows.length, columns, versions, rows, warnings);
}

function parseJson(raw: unknown, fileName: string, sourceKind: DlSourceKind = 'json'): DlDataset {
  if (typeof raw === 'string') return parseDeltaLog(raw, fileName);
  const root = rec(Array.isArray(raw) ? { rows: raw } : raw);
  if (root.protocol && (root.metaData || root.add || root.commitInfo) && !root.schema && !root.rows) {
    return parseDeltaLog(JSON.stringify(raw), fileName);
  }
  const name = asString(root.name || root.title || rec(root.metaData).id, fileName.replace(/\.[^.]+$/, '') || 'Delta table');
  const proto = rec(root.protocol);
  const protocol = proto.minReaderVersion || proto.minWriterVersion
    ? `${Number(proto.minReaderVersion || 1) || 1}/${Number(proto.minWriterVersion || 2) || 2}`
    : asString(root.protocol, '1/2');
  const columns: DlColumn[] = [];
  if (typeof root.schemaString === 'string') parseSchemaString(root.schemaString, columns);
  const schemaList = Array.isArray(root.schema)
    ? root.schema
    : Array.isArray(root.columns)
      ? root.columns
      : Array.isArray(root.fields)
        ? root.fields
        : [];
  schemaList.forEach((item, i) => ingestColumn(columns, rec(item), columns.length || i));
  const rowList = Array.isArray(root.rows) ? root.rows : Array.isArray(root.data) ? root.data : [];
  const rows: Array<Record<string, string>> = [];
  for (const item of rowList) {
    const row = rec(item);
    if (!columns.length) Object.keys(row).forEach((key, i) => ingestColumn(columns, { name: key, type: 'STRING' }, i));
    const out: Record<string, string> = {};
    for (const c of columns) out[c.name] = cell(row[c.name]);
    rows.push(out);
  }
  if (!columns.length) throw new Error('Delta JSON contains no schema');
  const versionList = Array.isArray(root.versions) ? root.versions : Array.isArray(root.history) ? root.history : [];
  const versions: DlVersion[] = versionList.map((item, i) => {
    const v = rec(item);
    return {
      version: Number(v.version ?? i) || i,
      timestamp: asString(v.timestamp || v.ts, '—'),
      operation: asString(v.operation || v.op, 'WRITE'),
      numFiles: Number(v.numFiles || v.files || 1) || 1,
      numRows: Number(v.numRows || v.rows || 0) || 0
    };
  });
  const warnings: string[] = [];
  if (sourceKind === 'delta') warnings.push('Parquet data files in the table are not inflated — preview uses log metadata');
  return finishDataset(
    name,
    sourceKind,
    asString(root.title || root.name, name),
    protocol,
    Number(root.numRows || rows.length) || rows.length,
    columns,
    versions,
    rows,
    warnings
  );
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string, fileName: string): DlDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Delta CSV contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('Delta CSV contains no schema');
  const columns: DlColumn[] = header.map((name, i) => ({ id: name, index: i, name, type: 'STRING', path: name, nullable: true }));
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] || ''));
    rows.push(row);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'Delta table';
  return finishDataset(name, 'csv', name, '1/2', rows.length, columns, [], rows, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: DlSourceKind): DlDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'Delta table').trim();
  const columns: DlColumn[] = [];
  const rows: Array<Record<string, string>> = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      columns.push({
        id: schema[1],
        index: columns.length,
        name: schema[1],
        type: schema[2].toUpperCase(),
        path: schema[1],
        nullable: true
      });
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!columns.length) {
        parts.forEach((p, i) => columns.push({ id: p, index: i, name: p, type: 'STRING', path: p, nullable: true }));
        continue;
      }
      const row: Record<string, string> = {};
      columns.forEach((c, i) => (row[c.name] = parts[i] || ''));
      rows.push(row);
    }
  }
  if (!columns.length) throw new Error('Delta markdown contains no schema');
  return finishDataset(name, sourceKind, name, '1/2', rows.length, columns, [], rows, []);
}

export function parseDeltaText(text: string, fileName = ''): DlDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Delta file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeDeltaLog(raw) || ext === 'ndjson') return parseDeltaLog(raw, fileName);
  if (looksLikeJson(raw) || ext === 'json' || ext === 'delta') {
    if (raw.includes('\n{') && looksLikeDeltaLog(raw)) return parseDeltaLog(raw, fileName);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (looksLikeDeltaLog(raw)) return parseDeltaLog(raw, fileName);
      throw new Error('Invalid Delta JSON');
    }
    return parseJson(parsed, fileName, ext === 'delta' ? 'delta' : 'json');
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsv(raw, fileName);
  const sourceKind: DlSourceKind = ext === 'md' ? 'markdown' : 'txt';
  if (/^#\s+/m.test(raw) || /:\s+[A-Za-z]/.test(raw) || raw.includes('|')) return parseMarkdown(raw, fileName, sourceKind);
  throw new Error('Not a Delta table dump');
}

export function parseDeltaBytes(bytes: Uint8Array, fileName = ''): DlDataset {
  if (!bytes.length) throw new Error('Delta file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Delta files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (magicEq(bytes, 0, DLTA) || magicEq(bytes, bytes.length - 4, DLTA) || ext === 'delta') {
    try {
      return parseDeltaBinary(bytes, fileName);
    } catch (error) {
      if (magicEq(bytes, 0, DLTA)) throw error;
    }
  }
  return parseDeltaText(td.decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterDlColumns(columns: DlColumn[], query: string): DlColumn[] {
  const q = query.trim().toLowerCase();
  if (!q) return columns;
  const tokens = q.split(/\s+/).filter(Boolean);
  return columns.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('col:') || token.startsWith('name:')) return c.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return c.type.toLowerCase().includes(token.slice(5));
      return `${c.name} ${c.type}`.toLowerCase().includes(token);
    })
  );
}

export function filterDlRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:')) return Object.values(row).some((v) => v.toLowerCase().includes(token.slice(4)));
      const colon = token.indexOf(':');
      if (colon > 0 && !token.startsWith('col:') && !token.startsWith('type:') && !token.startsWith('name:') && !token.startsWith('ver:') && !token.startsWith('op:')) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        const hit = Object.entries(row).find(([k]) => k.toLowerCase() === key.toLowerCase());
        return hit ? hit[1].toLowerCase().includes(needle) : false;
      }
      return Object.values(row).some((v) => v.toLowerCase().includes(token));
    })
  );
}

export function filterDlVersions(versions: DlVersion[], query: string): DlVersion[] {
  const q = query.trim().toLowerCase();
  if (!q) return versions;
  const tokens = q.split(/\s+/).filter(Boolean);
  return versions.filter((v) =>
    tokens.every((token) => {
      if (token.startsWith('ver:')) return String(v.version).includes(token.slice(4));
      if (token.startsWith('op:')) return v.operation.toLowerCase().includes(token.slice(3));
      return `${v.version} ${v.operation} ${v.timestamp}`.toLowerCase().includes(token);
    })
  );
}
