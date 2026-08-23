import type { ArBatch, ArColumn, ArDataset, ArSourceKind } from '../types/arrow-viewer.types';
import { AR_SHOP_ROWS } from '../constants/arrow-viewer-sample.data';
import { isGzipMagic } from './data-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const ARROW1 = new Uint8Array([0x41, 0x52, 0x52, 0x4f, 0x57, 0x31, 0x00, 0x00]);
const FEA1 = new Uint8Array([0x46, 0x45, 0x41, 0x31]);

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

function magicEq(bytes: Uint8Array, offset: number, magic: Uint8Array): boolean {
  if (offset < 0 || offset + magic.length > bytes.length) return false;
  for (let i = 0; i < magic.length; i++) if (bytes[offset + i] !== magic[i]) return false;
  return true;
}

function finishDataset(
  name: string,
  sourceKind: ArSourceKind,
  title: string,
  version: string,
  numRows: number,
  columns: ArColumn[],
  batches: ArBatch[],
  rows: Array<Record<string, string>>,
  warnings: string[]
): ArDataset {
  if (!columns.length) throw new Error('Arrow file contains no schema columns');
  const safeBatches =
    batches.length > 0
      ? batches
      : [{ index: 0, numRows: numRows || rows.length, bodyOffset: 0, bodyLength: 0 }];
  return {
    name,
    sourceKind,
    title: title || name,
    version,
    numRows: numRows || rows.length,
    columns,
    batches: safeBatches,
    rows,
    warnings
  };
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

export function buildSampleArrowBytes(rows: ReadonlyArray<Record<string, string | number>> = AR_SHOP_ROWS): Uint8Array {
  const batchA = rows.slice(0, 2);
  const batchB = rows.slice(2);
  const body: number[] = [...ARROW1];
  const cols: ColSpec[] = [];
  const batches: ArBatch[] = [];

  const writeBatch = (slice: ReadonlyArray<Record<string, string | number>>, index: number): void => {
    pad8(body);
    const start = body.length;
    const orderIds = slice.map((r) => Number(r.orderId));
    const skus = slice.map((r) => String(r.sku));
    const totals = slice.map((r) => Number(r.total));
    const counts = slice.map((r) => Number(r.itemCount));
    const add = (name: string, type: string, data: Uint8Array): void => {
      pad8(body);
      if (index === 0) {
        cols.push({ name, type, offset: body.length - ARROW1.length, byteLength: data.length });
      }
      body.push(...data);
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
    pad8(body);
    batches.push({ index, numRows: slice.length, bodyOffset: start - ARROW1.length, bodyLength: body.length - start });
  };

  writeBatch(batchA, 0);
  if (batchB.length) writeBatch(batchB, 1);

  const meta = te.encode(
    JSON.stringify({
      format: 'arrow-ipc',
      name: 'DeviceTelemetry',
      numRows: rows.length,
      columns: cols,
      batches,
      rows
    })
  );
  pad8(body);
  body.push(...meta);
  writeU32le(meta.length, body);
  body.push(...ARROW1);
  return Uint8Array.from(body);
}

function ingestColumn(columns: ArColumn[], row: Record<string, unknown>, index: number): void {
  const name = asString(row.name || row.column || row.field || row.id);
  if (!name) return;
  columns.push({
    id: name,
    index,
    name,
    type: asString(row.type || row.dataType, 'UTF8').toUpperCase(),
    path: asString(row.path, name)
  });
}

function parseArrowBinary(bytes: Uint8Array, fileName: string): ArDataset {
  if (bytes.length < 20) throw new Error('Arrow file is too small');
  if (!magicEq(bytes, 0, ARROW1) || !magicEq(bytes, bytes.length - 8, ARROW1)) {
    throw new Error('Not an Arrow IPC file (missing ARROW1 magic)');
  }
  const metaLen = u32le(bytes, bytes.length - 12);
  if (metaLen <= 0 || metaLen > bytes.length - 20) throw new Error('Invalid Arrow metadata length');
  const metaStart = bytes.length - 12 - metaLen;
  const metaBytes = bytes.subarray(metaStart, metaStart + metaLen);
  const warnings: string[] = [];
  let metaObj: Record<string, unknown> | null = null;
  const metaText = td.decode(metaBytes).replace(/^\uFEFF/, '').trim();
  if (metaText.startsWith('{')) {
    try {
      metaObj = rec(JSON.parse(metaText));
    } catch {
      warnings.push('Arrow metadata JSON is malformed');
    }
  } else {
    warnings.push('FlatBuffers Arrow IPC metadata is not fully expanded — showing extracted names when possible');
    const names = [...metaText.matchAll(/[\x20-\x7e]{2,}/g)].map((m) => m[0]).filter((s) => /^[A-Za-z_][\w.]*$/.test(s));
    const uniq = [...new Set(names)].filter((n) => !/^(schema|field|utf8|int64|int32|double|null|list|struct|ARROW)$/i.test(n));
    if (uniq.length) metaObj = { name: fileName.replace(/\.[^.]+$/, ''), numRows: 0, columns: uniq.map((name) => ({ name, type: 'BYTE' })) };
  }
  if (!metaObj) throw new Error('Arrow metadata could not be parsed');

  const specs = (Array.isArray(metaObj.columns) ? metaObj.columns : Array.isArray(metaObj.schema) ? metaObj.schema : [])
    .map((item) => rec(item))
    .map((row) => ({
      name: asString(row.name || row.column || row.field),
      type: asString(row.type || row.dataType, 'UTF8').toUpperCase(),
      offset: Number(row.offset || 0) || 0,
      byteLength: Number(row.byteLength || row.length || 0) || 0
    }))
    .filter((s) => s.name);
  if (!specs.length) throw new Error('Arrow file contains no columns');

  const numRows = Number(metaObj.numRows || 0) || 0;
  const data = bytes.subarray(8, metaStart);
  const rows: Array<Record<string, string>> = [];
  const metaRows = Array.isArray(metaObj.rows) ? metaObj.rows : [];
  if (metaRows.length) {
    for (const item of metaRows) {
      const row = rec(item);
      const out: Record<string, string> = {};
      for (const s of specs) out[s.name] = cell(row[s.name]);
      rows.push(out);
    }
  } else if (numRows > 0 && specs.every((s) => s.byteLength > 0 || s.offset >= 0)) {
    const values = specs.map((s) => {
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

  const columns: ArColumn[] = specs.map((s, i) => ({ id: s.name, index: i, name: s.name, type: s.type, path: s.name }));
  const batchList = Array.isArray(metaObj.batches) ? metaObj.batches : [];
  const batches: ArBatch[] = batchList.map((item, i) => {
    const b = rec(item);
    return {
      index: Number(b.index ?? i) || i,
      numRows: Number(b.numRows || 0) || 0,
      bodyOffset: Number(b.bodyOffset || b.offset || 0) || 0,
      bodyLength: Number(b.bodyLength || b.length || 0) || 0
    };
  });
  const fromFile = asString(metaObj.name, fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Arrow table');
  return finishDataset(fromFile, 'arrow', fromFile, asString(metaObj.version, 'ipc'), rows.length || numRows, columns, batches, rows, warnings);
}

function parseFeatherHint(bytes: Uint8Array, fileName: string): ArDataset {
  const warnings = ['This looks like Feather V1 — use Feather Viewer for a fuller preview'];
  const text = td.decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)));
  const names = [...text.matchAll(/[A-Za-z_][A-Za-z0-9_]{1,40}/g)].map((m) => m[0]);
  const skip = new Set(['FEA', 'ARROW', 'schema', 'field', 'utf8', 'int64', 'int32', 'double', 'null', 'list', 'struct', 'columns', 'values']);
  const uniq = [...new Set(names)].filter((n) => !skip.has(n.toLowerCase())).slice(0, 12);
  const columns: ArColumn[] = (uniq.length ? uniq : ['value']).map((name, i) => ({
    id: name,
    index: i,
    name,
    type: 'BYTE',
    path: name
  }));
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Arrow table';
  return finishDataset(fromFile, 'arrow', fromFile, 'feather-hint', 0, columns, [], [], warnings);
}

function parseJson(raw: unknown, fileName: string): ArDataset {
  const root = rec(Array.isArray(raw) ? { rows: raw } : raw);
  const name = asString(root.name || root.title, fileName.replace(/\.[^.]+$/, '') || 'Arrow table');
  const columns: ArColumn[] = [];
  const schemaList = Array.isArray(root.columns)
    ? root.columns
    : Array.isArray(root.schema)
      ? root.schema
      : Array.isArray(root.fields)
        ? root.fields
        : [];
  schemaList.forEach((item, i) => ingestColumn(columns, rec(item), i));
  const rowList = Array.isArray(root.rows) ? root.rows : Array.isArray(root.data) ? root.data : [];
  const rows: Array<Record<string, string>> = [];
  for (const item of rowList) {
    const row = rec(item);
    if (!columns.length) Object.keys(row).forEach((key, i) => ingestColumn(columns, { name: key, type: 'UTF8' }, i));
    const out: Record<string, string> = {};
    for (const c of columns) out[c.name] = cell(row[c.name]);
    rows.push(out);
  }
  if (!columns.length) throw new Error('Arrow JSON contains no schema');
  const batchList = Array.isArray(root.batches) ? root.batches : [];
  const batches: ArBatch[] = batchList.map((item, i) => {
    const b = rec(item);
    return {
      index: Number(b.index ?? i) || i,
      numRows: Number(b.numRows || 0) || 0,
      bodyOffset: Number(b.bodyOffset || 0) || 0,
      bodyLength: Number(b.bodyLength || 0) || 0
    };
  });
  return finishDataset(
    name,
    'json',
    asString(root.title || root.name, name),
    asString(root.version, 'ipc'),
    Number(root.numRows || rows.length) || rows.length,
    columns,
    batches,
    rows,
    []
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

function parseCsv(text: string, fileName: string): ArDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Arrow CSV contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('Arrow CSV contains no schema');
  const columns: ArColumn[] = header.map((name, i) => ({ id: name, index: i, name, type: 'UTF8', path: name }));
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] || ''));
    rows.push(row);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'Arrow table';
  return finishDataset(name, 'csv', name, 'ipc', rows.length, columns, [], rows, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: ArSourceKind): ArDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'Arrow table').trim();
  const columns: ArColumn[] = [];
  const rows: Array<Record<string, string>> = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      columns.push({ id: schema[1], index: columns.length, name: schema[1], type: schema[2].toUpperCase(), path: schema[1] });
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!columns.length) {
        parts.forEach((p, i) => columns.push({ id: p, index: i, name: p, type: 'UTF8', path: p }));
        continue;
      }
      const row: Record<string, string> = {};
      columns.forEach((c, i) => (row[c.name] = parts[i] || ''));
      rows.push(row);
    }
  }
  if (!columns.length) throw new Error('Arrow markdown contains no schema');
  return finishDataset(name, sourceKind, name, 'ipc', rows.length, columns, [], rows, []);
}

export function parseArrowText(text: string, fileName = ''): ArDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Arrow file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Arrow JSON');
    }
    return parseJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsv(raw, fileName);
  const sourceKind: ArSourceKind = ext === 'md' ? 'markdown' : 'txt';
  if (/^#\s+/m.test(raw) || /:\s+[A-Za-z]/.test(raw) || raw.includes('|')) return parseMarkdown(raw, fileName, sourceKind);
  throw new Error('Not an Arrow table dump');
}

export function parseArrowBytes(bytes: Uint8Array, fileName = ''): ArDataset {
  if (!bytes.length) throw new Error('Arrow file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Arrow files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (magicEq(bytes, 0, FEA1)) return parseFeatherHint(bytes, fileName);
  if (ext === 'arrow' || ext === 'ipc' || ext === 'arrows' || magicEq(bytes, 0, ARROW1) || magicEq(bytes, bytes.length - 8, ARROW1)) {
    try {
      return parseArrowBinary(bytes, fileName);
    } catch (error) {
      if (ext === 'arrow' || ext === 'ipc' || ext === 'arrows' || magicEq(bytes, 0, ARROW1)) throw error;
    }
  }
  return parseArrowText(td.decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterArColumns(columns: ArColumn[], query: string): ArColumn[] {
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

export function filterArRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
