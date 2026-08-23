import type { FtColumn, FtDataset, FtSourceKind } from '../types/feather-viewer.types';
import { FT_SHOP_ROWS } from '../constants/feather-viewer-sample.data';
import { isGzipMagic } from './data-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const FEA1 = new Uint8Array([0x46, 0x45, 0x41, 0x31]);
const ARROW1 = te.encode('ARROW1\0\0');

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

function writeI64le(value: number, out: number[]): void {
  let n = BigInt(value);
  for (let i = 0; i < 8; i++) {
    out.push(Number(n & 0xffn));
    n >>= 8n;
  }
}

function readI64le(bytes: Uint8Array, offset: number): string {
  let n = 0n;
  for (let b = 0; b < 8; b++) n |= BigInt(bytes[offset + b]) << BigInt(8 * b);
  if (n & (1n << 63n)) n -= 1n << 64n;
  return String(n);
}

function writeF64le(value: number, out: number[]): void {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, value, true);
  out.push(...new Uint8Array(buf));
}

function readF64le(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getFloat64(0, true);
}

function pad8(out: number[]): void {
  while (out.length % 8) out.push(0);
}

function layoutColumns(columns: FtColumn[]): void {
  columns.forEach((c, i) => {
    c.index = i;
    c.x = 220;
    c.y = 40 + i * 70;
  });
}

function finishDataset(
  name: string,
  sourceKind: FtSourceKind,
  title: string,
  version: string,
  numRows: number,
  columns: FtColumn[],
  rows: Array<Record<string, string>>,
  warnings: string[]
): FtDataset {
  if (!columns.length) throw new Error('Feather file contains no schema columns');
  layoutColumns(columns);
  return { name, sourceKind, title: title || name, version, numRows: numRows || rows.length, columns, rows, warnings };
}

interface ColSpec {
  name: string;
  type: string;
  offset: number;
  byteLength: number;
}

function encodeUtf8Column(values: string[]): Uint8Array {
  const encoded = values.map((v) => te.encode(v));
  const out: number[] = [];
  let cursor = 0;
  for (const part of encoded) {
    writeU32le(cursor, out);
    cursor += part.length;
  }
  writeU32le(cursor, out);
  for (const part of encoded) out.push(...part);
  pad8(out);
  return Uint8Array.from(out);
}

function decodeUtf8Column(bytes: Uint8Array, numRows: number): string[] {
  const offsets: number[] = [];
  for (let i = 0; i <= numRows; i++) offsets.push(u32le(bytes, i * 4));
  const base = (numRows + 1) * 4;
  return Array.from({ length: numRows }, (_, i) => td.decode(bytes.subarray(base + offsets[i], base + offsets[i + 1])));
}

export function buildSampleFeatherBytes(rows: ReadonlyArray<Record<string, string | number>> = FT_SHOP_ROWS): Uint8Array {
  const orderIds = rows.map((r) => Number(r.orderId));
  const skus = rows.map((r) => String(r.sku));
  const totals = rows.map((r) => Number(r.total));
  const counts = rows.map((r) => Number(r.itemCount));
  const body: number[] = [...FEA1];
  const cols: ColSpec[] = [];

  const add = (name: string, type: string, data: Uint8Array): void => {
    pad8(body);
    const offset = body.length - FEA1.length;
    body.push(...data);
    cols.push({ name, type, offset, byteLength: data.length });
  };

  const i64: number[] = [];
  orderIds.forEach((n) => writeI64le(n, i64));
  add('orderId', 'INT64', Uint8Array.from(i64));
  add('sku', 'UTF8', encodeUtf8Column(skus));
  const f64: number[] = [];
  totals.forEach((n) => writeF64le(n, f64));
  add('total', 'DOUBLE', Uint8Array.from(f64));
  const i32: number[] = [];
  counts.forEach((n) => writeU32le(n, i32));
  add('itemCount', 'INT32', Uint8Array.from(i32));

  const meta = te.encode(
    JSON.stringify({
      format: 'feather-v1',
      name: 'PandasMetrics',
      numRows: rows.length,
      columns: cols,
      rows
    })
  );
  pad8(body);
  body.push(...meta);
  writeU32le(meta.length, body);
  body.push(...FEA1);
  return Uint8Array.from(body);
}

function decodeColumn(type: string, chunk: Uint8Array, numRows: number): string[] {
  const t = type.toUpperCase();
  if (t === 'INT64' || t === 'LONG' || t === 'UINT64') {
    return Array.from({ length: numRows }, (_, i) => (i * 8 + 8 <= chunk.length ? readI64le(chunk, i * 8) : ''));
  }
  if (t === 'INT32' || t === 'UINT32' || t === 'INT' || t === 'DATE') {
    return Array.from({ length: numRows }, (_, i) => {
      if (i * 4 + 4 > chunk.length) return '';
      const n = chunk[i * 4] | (chunk[i * 4 + 1] << 8) | (chunk[i * 4 + 2] << 16) | (chunk[i * 4 + 3] << 24);
      return String(n);
    });
  }
  if (t === 'DOUBLE' || t === 'FLOAT64') {
    return Array.from({ length: numRows }, (_, i) => (i * 8 + 8 <= chunk.length ? String(readF64le(chunk, i * 8)) : ''));
  }
  if (t === 'FLOAT' || t === 'FLOAT32') {
    return Array.from({ length: numRows }, (_, i) =>
      i * 4 + 4 <= chunk.length ? String(new DataView(chunk.buffer, chunk.byteOffset + i * 4, 4).getFloat32(0, true)) : ''
    );
  }
  if (t === 'UTF8' || t === 'STRING' || t === 'BINARY') {
    try {
      return decodeUtf8Column(chunk, numRows);
    } catch {
      return Array.from({ length: numRows }, () => '');
    }
  }
  if (t === 'BOOL' || t === 'BOOLEAN') {
    return Array.from({ length: numRows }, (_, i) => (((chunk[i >> 3] >> (i & 7)) & 1) === 1 ? 'true' : 'false'));
  }
  return Array.from({ length: numRows }, () => '');
}

function parseFeatherBinary(bytes: Uint8Array, fileName: string): FtDataset {
  if (bytes.length < 12) throw new Error('Feather file is too small');
  const startOk = bytes[0] === 0x46 && bytes[1] === 0x45 && bytes[2] === 0x41 && bytes[3] === 0x31;
  const endOk =
    bytes[bytes.length - 4] === 0x46 &&
    bytes[bytes.length - 3] === 0x45 &&
    bytes[bytes.length - 2] === 0x41 &&
    bytes[bytes.length - 1] === 0x31;
  if (!startOk || !endOk) throw new Error('Not a Feather V1 file (missing FEA1 magic)');
  const metaLen = u32le(bytes, bytes.length - 8);
  if (metaLen <= 0 || metaLen > bytes.length - 12) throw new Error('Invalid Feather metadata length');
  const metaStart = bytes.length - 8 - metaLen;
  const metaBytes = bytes.subarray(metaStart, metaStart + metaLen);
  const warnings: string[] = [];
  let metaObj: Record<string, unknown> | null = null;
  const metaText = td.decode(metaBytes).replace(/^\uFEFF/, '').trim();
  if (metaText.startsWith('{')) {
    try {
      metaObj = rec(JSON.parse(metaText));
    } catch {
      warnings.push('Feather metadata JSON is malformed');
    }
  } else {
    warnings.push('FlatBuffers Feather metadata is not fully expanded — showing extracted names when possible');
    const names = [...metaText.matchAll(/[\x20-\x7e]{2,}/g)].map((m) => m[0]).filter((s) => /^[A-Za-z_][\w.]*$/.test(s));
    const uniq = [...new Set(names)].filter((n) => !/^(description|columns|values|metadata|CTable|Column)$/i.test(n));
    if (uniq.length) {
      metaObj = {
        name: fileName.replace(/\.[^.]+$/, ''),
        numRows: 0,
        columns: uniq.map((name) => ({ name, type: 'BYTE' }))
      };
    }
  }
  if (!metaObj) throw new Error('Feather metadata could not be parsed');
  const numRows = Number(metaObj.numRows || rec(metaObj).n || 0) || 0;
  const colRaw = Array.isArray(metaObj.columns) ? metaObj.columns : Array.isArray(metaObj.schema) ? metaObj.schema : [];
  const specs: ColSpec[] = colRaw.map((item, i) => {
    const r = rec(item);
    return {
      name: asString(r.name || r.field || `c${i}`),
      type: asString(r.type || r.dataType, 'UTF8').toUpperCase(),
      offset: Number(r.offset || 0) || 0,
      byteLength: Number(r.byteLength || r.length || 0) || 0
    };
  });
  if (!specs.length) throw new Error('Feather file contains no columns');
  const dataStart = 4;
  const dataEnd = metaStart;
  const data = bytes.subarray(dataStart, dataEnd);
  let rows: Array<Record<string, string>> = [];
  const dumped = Array.isArray(metaObj.rows) ? metaObj.rows : Array.isArray(metaObj.data) ? metaObj.data : [];
  if (dumped.length) {
    rows = dumped.map((item) => {
      const row = rec(item);
      const out: Record<string, string> = {};
      for (const s of specs) out[s.name] = cell(row[s.name]);
      return out;
    });
  } else if (numRows && specs.some((s) => s.byteLength > 0)) {
    const values: string[][] = specs.map((s) => {
      const chunk = data.subarray(s.offset, s.offset + (s.byteLength || data.length - s.offset));
      try {
        return decodeColumn(s.type, chunk, numRows);
      } catch {
        warnings.push(`${s.name}: column decode failed`);
        return Array.from({ length: numRows }, () => '');
      }
    });
    for (let i = 0; i < numRows; i++) {
      const row: Record<string, string> = {};
      specs.forEach((s, ci) => (row[s.name] = values[ci]?.[i] ?? ''));
      rows.push(row);
    }
  } else warnings.push('No preview rows — schema only');
  const columns: FtColumn[] = specs.map((s, i) => ({
    id: s.name,
    index: i,
    name: s.name,
    type: s.type,
    offset: s.offset,
    byteLength: s.byteLength,
    x: 0,
    y: 0
  }));
  const fromFile = asString(metaObj.name, fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Feather table');
  return finishDataset(fromFile, 'feather', fromFile, 'v1', rows.length || numRows, columns, rows, warnings);
}

function parseArrowMagic(bytes: Uint8Array, fileName: string): FtDataset {
  const warnings = ['Arrow IPC / Feather V2 bodies are not fully inflated — use a JSON dump for row preview'];
  const text = td.decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)));
  const names = [...text.matchAll(/[A-Za-z_][A-Za-z0-9_]{1,40}/g)].map((m) => m[0]);
  const skip = new Set(['ARROW', 'FEA', 'schema', 'field', 'utf8', 'int64', 'int32', 'double', 'null', 'list', 'struct']);
  const uniq = [...new Set(names)].filter((n) => !skip.has(n.toLowerCase())).slice(0, 12);
  const columns: FtColumn[] = (uniq.length ? uniq : ['value']).map((name, i) => ({
    id: name,
    index: i,
    name,
    type: 'BYTE',
    offset: 0,
    byteLength: 0,
    x: 0,
    y: 0
  }));
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Arrow table';
  return finishDataset(fromFile, 'arrow', fromFile, 'ipc', 0, columns, [], warnings);
}

function ingestSchema(columns: FtColumn[], row: Record<string, unknown>, index: number): void {
  const name = asString(row.name || row.column || row.field || row.id);
  if (!name) return;
  columns.push({
    id: name,
    index,
    name,
    type: asString(row.type || row.dataType, 'UTF8').toUpperCase(),
    offset: Number(row.offset || 0) || 0,
    byteLength: Number(row.byteLength || row.length || 0) || 0,
    x: 0,
    y: 0
  });
}

function parseJson(raw: unknown, fileName: string): FtDataset {
  const root = rec(Array.isArray(raw) ? { rows: raw } : raw);
  const name = asString(root.name || root.title, fileName.replace(/\.[^.]+$/, '') || 'Feather table');
  const columns: FtColumn[] = [];
  const schemaList = Array.isArray(root.columns) ? root.columns : Array.isArray(root.schema) ? root.schema : Array.isArray(root.fields) ? root.fields : [];
  schemaList.forEach((item, i) => ingestSchema(columns, rec(item), i));
  const rowList = Array.isArray(root.rows) ? root.rows : Array.isArray(root.data) ? root.data : [];
  const rows: Array<Record<string, string>> = [];
  for (const item of rowList) {
    const row = rec(item);
    if (!columns.length) Object.keys(row).forEach((key, i) => ingestSchema(columns, { name: key, type: 'UTF8' }, i));
    const out: Record<string, string> = {};
    for (const c of columns) out[c.name] = cell(row[c.name]);
    rows.push(out);
  }
  if (!columns.length) throw new Error('Feather JSON contains no schema');
  return finishDataset(name, 'json', asString(root.title || root.name, name), asString(root.version, 'v1'), Number(root.numRows || rows.length) || rows.length, columns, rows, []);
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

function parseCsv(text: string, fileName: string): FtDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Feather CSV contains no rows');
  const header = parseCsvLine(lines[0]);
  const columns: FtColumn[] = header.map((name, i) => ({ id: name, index: i, name, type: 'UTF8', offset: 0, byteLength: 0, x: 0, y: 0 }));
  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] || ''));
    return row;
  });
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Feather table';
  return finishDataset(fromFile, 'csv', fromFile, 'v1', rows.length, columns, rows, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: FtSourceKind): FtDataset {
  let name = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Feather table';
  const columns: FtColumn[] = [];
  const rows: Array<Record<string, string>> = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('```')) continue;
    const heading = /^#\s+(.+)$/.exec(trimmed);
    if (heading) {
      name = heading[1].trim();
      continue;
    }
    const schema = /^([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)$/.exec(trimmed);
    if (schema && !trimmed.includes('|')) {
      columns.push({ id: schema[1], index: columns.length, name: schema[1], type: schema[2].toUpperCase(), offset: 0, byteLength: 0, x: 0, y: 0 });
      continue;
    }
    if (trimmed.includes('|')) {
      const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
      if (!columns.length) {
        parts.forEach((p, i) => columns.push({ id: p, index: i, name: p, type: 'UTF8', offset: 0, byteLength: 0, x: 0, y: 0 }));
        continue;
      }
      const row: Record<string, string> = {};
      columns.forEach((c, i) => (row[c.name] = parts[i] || ''));
      rows.push(row);
    }
  }
  if (!columns.length) throw new Error('Feather markdown contains no schema');
  return finishDataset(name, sourceKind, name, 'v1', rows.length, columns, rows, []);
}

export function parseFeatherText(text: string, fileName = ''): FtDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Feather file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Feather JSON');
    }
    return parseJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsv(raw, fileName);
  const sourceKind: FtSourceKind = ext === 'md' ? 'markdown' : 'txt';
  if (/^#\s+/m.test(raw) || /:\s+[A-Za-z]/.test(raw) || raw.includes('|')) return parseMarkdown(raw, fileName, sourceKind);
  throw new Error('Not a Feather table dump');
}

export function parseFeatherBytes(bytes: Uint8Array, fileName = ''): FtDataset {
  if (!bytes.length) throw new Error('Feather file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Feather files are not supported — decompress first');
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x46 &&
    bytes[1] === 0x45 &&
    bytes[2] === 0x41 &&
    bytes[3] === 0x31
  ) {
    return parseFeatherBinary(bytes, fileName);
  }
  if (bytes.length >= 8 && bytes[0] === 0x41 && bytes[1] === 0x52 && bytes[2] === 0x52 && bytes[3] === 0x4f && bytes[4] === 0x57) {
    return parseArrowMagic(bytes, fileName);
  }
  return parseFeatherText(td.decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterFtColumns(columns: FtColumn[], query: string): FtColumn[] {
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

export function filterFtRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:')) return Object.values(row).some((v) => v.toLowerCase().includes(token.slice(4)));
      const colon = token.indexOf(':');
      if (colon > 0 && !token.startsWith('col:') && !token.startsWith('type:') && !token.startsWith('name:')) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        const hit = Object.entries(row).find(([k]) => k.toLowerCase() === key.toLowerCase());
        return hit ? hit[1].toLowerCase().includes(needle) : false;
      }
      return Object.values(row).some((v) => v.toLowerCase().includes(token));
    })
  );
}
