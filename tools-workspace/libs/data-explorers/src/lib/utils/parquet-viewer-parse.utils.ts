import type { PqColumn, PqDataset, PqProfile, PqRowGroup, PqSourceKind } from '../types/parquet-viewer.types';
import { PQ_SHOP_ROWS } from '../constants/parquet-viewer-sample.data';
import {
  PQ_CODEC,
  PQ_CONVERTED,
  PQ_REPETITION,
  PQ_TYPE,
  T_BINARY,
  T_I32,
  T_I64,
  T_STRUCT,
  ThriftReader,
  ThriftWriter
} from './parquet-thrift.utils';
import { isGzipMagic } from './data-file.utils';

const MAGIC = new Uint8Array([0x50, 0x41, 0x52, 0x31]);
const te = new TextEncoder();
const td = new TextDecoder('utf-8');

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

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function writeF64le(value: number, out: number[]): void {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, value, true);
  out.push(...new Uint8Array(buf));
}

function readF64le(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getFloat64(0, true);
}

function cell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value);
}

function profileColumns(columns: PqColumn[], rows: Array<Record<string, string>>): PqProfile[] {
  return columns.map((col) => {
    const values = rows.map((r) => r[col.name] ?? '');
    const nonEmpty = values.filter((v) => v !== '');
    const nums = nonEmpty.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    const distinct = new Set(nonEmpty);
    const sorted = [...nonEmpty].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const mean = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(3) : '—';
    return {
      column: col.name,
      type: col.convertedType || col.type,
      count: rows.length,
      nulls: rows.length - nonEmpty.length,
      distinct: distinct.size,
      min: sorted[0] || '—',
      max: sorted[sorted.length - 1] || '—',
      mean: nums.length === nonEmpty.length && nums.length ? mean : '—'
    };
  });
}

function finishDataset(
  name: string,
  sourceKind: PqSourceKind,
  title: string,
  createdBy: string,
  version: number,
  columns: PqColumn[],
  rowGroups: PqRowGroup[],
  rows: Array<Record<string, string>>,
  warnings: string[]
): PqDataset {
  if (!columns.length) throw new Error('Parquet file contains no schema columns');
  columns.forEach((c, i) => (c.index = i));
  const numRows = rowGroups.reduce((n, g) => n + g.numRows, 0) || rows.length;
  return {
    name,
    sourceKind,
    title: title || name,
    createdBy,
    version,
    numRows,
    columns,
    rowGroups,
    rows,
    profiles: profileColumns(columns, rows),
    warnings
  };
}

interface SchemaEl {
  name: string;
  type?: number;
  converted?: number;
  repetition?: number;
  children?: number;
}

interface ColMeta {
  type: number;
  encodings: number[];
  path: string[];
  codec: number;
  numValues: number;
  uncompressed: number;
  compressed: number;
  dataPageOffset: number;
}

function writeSchemaElement(w: ThriftWriter, el: SchemaEl): void {
  if (el.type != null) w.writeI32(1, el.type);
  if (el.repetition != null) w.writeI32(3, el.repetition);
  w.writeBinary(4, el.name);
  if (el.children != null) w.writeI32(5, el.children);
  if (el.converted != null) w.writeI32(6, el.converted);
}

function writePageHeader(numValues: number, pageSize: number): Uint8Array {
  const w = new ThriftWriter();
  w.pushStruct();
  w.writeI32(1, 0);
  w.writeI32(2, pageSize);
  w.writeI32(3, pageSize);
  w.writeStructField(5, () => {
    w.writeI32(1, numValues);
    w.writeI32(2, 0);
    w.writeI32(3, 3);
    w.writeI32(4, 3);
  });
  w.popStruct();
  return w.bytes();
}

function encodePlain(typeName: string, values: Array<string | number>): Uint8Array {
  const out: number[] = [];
  if (typeName === 'INT32') {
    for (const v of values) {
      const n = Number(v) | 0;
      out.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
    }
  } else if (typeName === 'INT64') {
    for (const v of values) {
      let n = BigInt(Number(v));
      for (let i = 0; i < 8; i++) {
        out.push(Number(n & 0xffn));
        n >>= 8n;
      }
    }
  } else if (typeName === 'DOUBLE') {
    for (const v of values) writeF64le(Number(v), out);
  } else if (typeName === 'BYTE_ARRAY') {
    for (const v of values) {
      const b = te.encode(String(v));
      writeU32le(b.length, out);
      out.push(...b);
    }
  } else if (typeName === 'BOOLEAN') {
    let acc = 0;
    let bits = 0;
    for (const v of values) {
      const bit = v === 1 || v === '1' || v === 'true' ? 1 : 0;
      acc |= bit << bits;
      bits += 1;
      if (bits === 8) {
        out.push(acc);
        acc = 0;
        bits = 0;
      }
    }
    if (bits) out.push(acc);
  } else {
    throw new Error(`Unsupported PLAIN type ${typeName}`);
  }
  return Uint8Array.from(out);
}

export function buildSampleParquetBytes(
  rows: ReadonlyArray<Record<string, string | number>> = PQ_SHOP_ROWS,
  name = 'nyc_taxi'
): Uint8Array {
  const columns: Array<{ name: string; type: number; converted?: number; key: string }> = [
    { name: 'orderId', type: 2, key: 'orderId' },
    { name: 'sku', type: 6, converted: 0, key: 'sku' },
    { name: 'total', type: 5, key: 'total' },
    { name: 'itemCount', type: 1, key: 'itemCount' }
  ];
  const typeName = (t: number) => PQ_TYPE[t] || 'BYTE_ARRAY';
  const body: number[] = [...MAGIC];
  const metas: ColMeta[] = [];
  for (const col of columns) {
    const values = rows.map((r) => r[col.key] as string | number);
    const plain = encodePlain(typeName(col.type), values);
    const header = writePageHeader(rows.length, plain.length);
    const offset = body.length;
    body.push(...header, ...plain);
    metas.push({
      type: col.type,
      encodings: [0],
      path: [col.name],
      codec: 0,
      numValues: rows.length,
      uncompressed: header.length + plain.length,
      compressed: header.length + plain.length,
      dataPageOffset: offset
    });
  }
  const w = new ThriftWriter();
  w.pushStruct();
  w.writeI32(1, 1);
  w.writeListHeader(2, T_STRUCT, columns.length + 1);
  w.pushStruct();
  writeSchemaElement(w, { name, repetition: 0, children: columns.length });
  w.popStruct();
  for (const col of columns) {
    w.pushStruct();
    writeSchemaElement(w, { name: col.name, type: col.type, repetition: 0, converted: col.converted });
    w.popStruct();
  }
  w.writeI64(3, rows.length);
  w.writeListHeader(4, T_STRUCT, 1);
  w.pushStruct();
  w.writeListHeader(1, T_STRUCT, metas.length);
  for (const meta of metas) {
    w.pushStruct();
    w.writeI64(2, meta.dataPageOffset);
    w.writeStructField(3, () => {
      w.writeI32(1, meta.type);
      w.writeListHeader(2, T_I32, meta.encodings.length);
      meta.encodings.forEach((e) => w.writeI32Value(e));
      w.writeListHeader(3, T_BINARY, meta.path.length);
      meta.path.forEach((p) => w.writeBinaryValue(p));
      w.writeI32(4, meta.codec);
      w.writeI64(5, meta.numValues);
      w.writeI64(6, meta.uncompressed);
      w.writeI64(7, meta.compressed);
      w.writeI64(9, meta.dataPageOffset);
    });
    w.popStruct();
  }
  const totalBytes = metas.reduce((n, m) => n + m.compressed, 0);
  w.writeI64(2, totalBytes);
  w.writeI64(3, rows.length);
  w.popStruct();
  w.writeBinary(6, 'easytoolhub-parquet-sample');
  w.popStruct();
  const meta = w.bytes();
  body.push(...meta);
  writeU32le(meta.length, body);
  body.push(...MAGIC);
  return Uint8Array.from(body);
}

function readSchemaElements(r: ThriftReader, count: number): SchemaEl[] {
  const out: SchemaEl[] = [];
  for (let i = 0; i < count; i++) {
    r.pushStruct();
    const el: SchemaEl = { name: '' };
    for (;;) {
      const f = r.readField();
      if (!f) break;
      if (f.id === 1 && f.type === T_I32) el.type = r.readZigZag32();
      else if (f.id === 3 && f.type === T_I32) el.repetition = r.readZigZag32();
      else if (f.id === 4 && f.type === T_BINARY) el.name = r.readString();
      else if (f.id === 5 && f.type === T_I32) el.children = r.readZigZag32();
      else if (f.id === 6 && f.type === T_I32) el.converted = r.readZigZag32();
      else r.skip(f.type);
    }
    r.popStruct();
    out.push(el);
  }
  return out;
}

function readColumnMeta(r: ThriftReader): ColMeta {
  const meta: ColMeta = {
    type: 6,
    encodings: [],
    path: [],
    codec: 0,
    numValues: 0,
    uncompressed: 0,
    compressed: 0,
    dataPageOffset: 0
  };
  for (;;) {
    const f = r.readField();
    if (!f) break;
    if (f.id === 1 && f.type === T_I32) meta.type = r.readZigZag32();
    else if (f.id === 2) {
      const list = r.readListHeader();
      for (let i = 0; i < list.count; i++) meta.encodings.push(r.readZigZag32());
    } else if (f.id === 3) {
      const list = r.readListHeader();
      for (let i = 0; i < list.count; i++) meta.path.push(r.readString());
    } else if (f.id === 4 && f.type === T_I32) meta.codec = r.readZigZag32();
    else if (f.id === 5 && f.type === T_I64) meta.numValues = r.readZigZag64();
    else if (f.id === 6 && f.type === T_I64) meta.uncompressed = r.readZigZag64();
    else if (f.id === 7 && f.type === T_I64) meta.compressed = r.readZigZag64();
    else if (f.id === 9 && f.type === T_I64) meta.dataPageOffset = r.readZigZag64();
    else r.skip(f.type);
  }
  return meta;
}

function readPageHeader(r: ThriftReader): { numValues: number; compressed: number } {
  let numValues = 0;
  let compressed = 0;
  r.pushStruct();
  for (;;) {
    const f = r.readField();
    if (!f) break;
    if (f.id === 2 && f.type === T_I32) r.readZigZag32();
    else if (f.id === 3 && f.type === T_I32) compressed = r.readZigZag32();
    else if (f.id === 5 && f.type === T_STRUCT) {
      r.pushStruct();
      for (;;) {
        const h = r.readField();
        if (!h) break;
        if (h.id === 1 && h.type === T_I32) numValues = r.readZigZag32();
        else r.skip(h.type);
      }
      r.popStruct();
    } else r.skip(f.type);
  }
  r.popStruct();
  return { numValues, compressed };
}

function decodePlain(typeName: string, bytes: Uint8Array, count: number): string[] {
  const out: string[] = [];
  let o = 0;
  const need = (n: number) => {
    if (o + n > bytes.length) throw new Error('Truncated Parquet page');
  };
  if (typeName === 'INT32') {
    for (let i = 0; i < count; i++) {
      need(4);
      const n = bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24);
      out.push(String(n));
      o += 4;
    }
  } else if (typeName === 'INT64') {
    for (let i = 0; i < count; i++) {
      need(8);
      let n = 0n;
      for (let b = 0; b < 8; b++) n |= BigInt(bytes[o + b]) << BigInt(8 * b);
      if (n & (1n << 63n)) n -= 1n << 64n;
      out.push(String(n));
      o += 8;
    }
  } else if (typeName === 'DOUBLE') {
    for (let i = 0; i < count; i++) {
      need(8);
      out.push(String(readF64le(bytes, o)));
      o += 8;
    }
  } else if (typeName === 'FLOAT') {
    for (let i = 0; i < count; i++) {
      need(4);
      out.push(String(new DataView(bytes.buffer, bytes.byteOffset + o, 4).getFloat32(0, true)));
      o += 4;
    }
  } else if (typeName === 'BYTE_ARRAY') {
    for (let i = 0; i < count; i++) {
      need(4);
      const len = u32le(bytes, o);
      o += 4;
      need(len);
      out.push(td.decode(bytes.subarray(o, o + len)));
      o += len;
    }
  } else if (typeName === 'BOOLEAN') {
    for (let i = 0; i < count; i++) {
      const byte = bytes[o + (i >> 3)];
      out.push(((byte >> (i & 7)) & 1) === 1 ? 'true' : 'false');
    }
  } else {
    throw new Error(`Unsupported Parquet type ${typeName}`);
  }
  return out;
}

function parseParquetBinary(bytes: Uint8Array, fileName: string): PqDataset {
  if (bytes.length < 12) throw new Error('Parquet file is too small');
  if (!(bytes[0] === 0x50 && bytes[1] === 0x41 && bytes[2] === 0x52 && bytes[3] === 0x31)) {
    throw new Error('Not a Parquet file (missing PAR1 magic)');
  }
  const end = bytes.length;
  if (!(bytes[end - 4] === 0x50 && bytes[end - 3] === 0x41 && bytes[end - 2] === 0x52 && bytes[end - 1] === 0x31)) {
    throw new Error('Not a Parquet file (missing footer magic)');
  }
  const metaLen = u32le(bytes, end - 8);
  if (metaLen <= 0 || metaLen > end - 12) throw new Error('Invalid Parquet footer length');
  const metaStart = end - 8 - metaLen;
  const r = new ThriftReader(bytes, metaStart);
  let version = 1;
  let numRows = 0;
  let createdBy = '';
  let schemaEls: SchemaEl[] = [];
  const rowGroups: Array<{ numRows: number; byteSize: number; columns: ColMeta[] }> = [];
  r.pushStruct();
  for (;;) {
    const f = r.readField();
    if (!f) break;
    if (f.id === 1 && f.type === T_I32) version = r.readZigZag32();
    else if (f.id === 2) {
      const list = r.readListHeader();
      schemaEls = readSchemaElements(r, list.count);
    } else if (f.id === 3 && f.type === T_I64) numRows = r.readZigZag64();
    else if (f.id === 4) {
      const list = r.readListHeader();
      for (let i = 0; i < list.count; i++) {
        r.pushStruct();
        const rg: { numRows: number; byteSize: number; columns: ColMeta[] } = { numRows: 0, byteSize: 0, columns: [] };
        for (;;) {
          const g = r.readField();
          if (!g) break;
          if (g.id === 1) {
            const cols = r.readListHeader();
            for (let c = 0; c < cols.count; c++) {
              r.pushStruct();
              let meta: ColMeta | null = null;
              for (;;) {
                const cf = r.readField();
                if (!cf) break;
                if (cf.id === 3 && cf.type === T_STRUCT) {
                  r.pushStruct();
                  meta = readColumnMeta(r);
                  r.popStruct();
                } else r.skip(cf.type);
              }
              r.popStruct();
              if (meta) rg.columns.push(meta);
            }
          } else if (g.id === 2 && g.type === T_I64) rg.byteSize = r.readZigZag64();
          else if (g.id === 3 && g.type === T_I64) rg.numRows = r.readZigZag64();
          else r.skip(g.type);
        }
        r.popStruct();
        rowGroups.push(rg);
      }
    } else if (f.id === 6 && f.type === T_BINARY) createdBy = r.readString();
    else r.skip(f.type);
  }
  r.popStruct();

  const warnings: string[] = [];
  const primitives = schemaEls.filter((s) => s.type != null);
  const columns: PqColumn[] = primitives.map((s, i) => ({
    id: s.name || `c${i}`,
    index: i,
    name: s.name || `c${i}`,
    type: PQ_TYPE[s.type ?? 6] || 'BYTE_ARRAY',
    convertedType: s.converted != null ? PQ_CONVERTED[s.converted] || String(s.converted) : '',
    repetition: PQ_REPETITION[s.repetition ?? 0] || 'REQUIRED',
    path: s.name || `c${i}`
  }));
  if (!columns.length) throw new Error('Parquet schema has no primitive columns');

  const rows: Array<Record<string, string>> = [];
  const first = rowGroups[0];
  if (first?.columns.length) {
    const colValues: string[][] = [];
    first.columns.forEach((meta, i) => {
      const col = columns[i] || columns.find((c) => c.name === meta.path[0]);
      const typeName = PQ_TYPE[meta.type] || col?.type || 'BYTE_ARRAY';
      if (meta.codec !== 0) {
        warnings.push(`${col?.name || meta.path.join('.')}: ${PQ_CODEC[meta.codec] || 'compressed'} pages are not inflated in this preview`);
        colValues.push([]);
        return;
      }
      if (col && col.repetition === 'OPTIONAL') {
        warnings.push(`${col.name}: OPTIONAL definition levels are skipped — showing schema only for this column`);
        colValues.push([]);
        return;
      }
      try {
        const pr = new ThriftReader(bytes, meta.dataPageOffset);
        const header = readPageHeader(pr);
        const count = header.numValues || meta.numValues || first.numRows || numRows;
        const pageBytes = bytes.subarray(pr.offset, pr.offset + Math.max(0, header.compressed || meta.uncompressed || 0));
        colValues.push(decodePlain(typeName, pageBytes.length ? pageBytes : bytes.subarray(pr.offset), count));
      } catch (error) {
        warnings.push(`${col?.name || 'column'}: ${error instanceof Error ? error.message : 'page decode failed'}`);
        colValues.push([]);
      }
    });
    const n = Math.max(first.numRows || 0, ...colValues.map((v) => v.length), 0);
    for (let i = 0; i < n; i++) {
      const row: Record<string, string> = {};
      columns.forEach((c, ci) => {
        row[c.name] = colValues[ci]?.[i] ?? '';
      });
      rows.push(row);
    }
  } else warnings.push('No row-group column pages were found — schema only');

  const groups: PqRowGroup[] = rowGroups.map((g, i) => ({
    index: i,
    numRows: g.numRows || rows.length,
    byteSize: g.byteSize,
    columnCount: g.columns.length || columns.length
  }));
  if (!groups.length) groups.push({ index: 0, numRows: rows.length || numRows, byteSize: 0, columnCount: columns.length });

  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Parquet table';
  return finishDataset(fromFile, 'parquet', fromFile, createdBy, version, columns, groups, rows, warnings);
}

function ingestSchemaRow(columns: PqColumn[], row: Record<string, unknown>, index: number): void {
  const name = asString(row.name || row.column || row.field || row.id);
  if (!name) return;
  columns.push({
    id: name,
    index,
    name,
    type: asString(row.type || row.dataType || row.physicalType, 'BYTE_ARRAY').toUpperCase(),
    convertedType: asString(row.convertedType || row.logicalType || row.logical),
    repetition: asString(row.repetition || row.repetitionType, 'REQUIRED').toUpperCase(),
    path: asString(row.path, name)
  });
}

function parseJson(raw: unknown, fileName: string): PqDataset {
  const root = rec(Array.isArray(raw) ? { rows: raw } : raw);
  const name = asString(root.name || root.title, fileName.replace(/\.[^.]+$/, '') || 'Parquet table');
  const columns: PqColumn[] = [];
  const schemaList = Array.isArray(root.schema)
    ? root.schema
    : Array.isArray(root.columns)
      ? root.columns
      : Array.isArray(root.fields)
        ? root.fields
        : [];
  schemaList.forEach((item, i) => ingestSchemaRow(columns, rec(item), i));
  const rowList = Array.isArray(root.rows) ? root.rows : Array.isArray(root.data) ? root.data : [];
  const rows: Array<Record<string, string>> = [];
  for (const item of rowList) {
    const row = rec(item);
    if (!columns.length) {
      Object.keys(row).forEach((key, i) => ingestSchemaRow(columns, { name: key, type: 'BYTE_ARRAY' }, i));
    }
    const out: Record<string, string> = {};
    for (const c of columns) out[c.name] = cell(row[c.name]);
    rows.push(out);
  }
  if (!columns.length) throw new Error('Parquet JSON contains no schema');
  const rgRaw = Array.isArray(root.rowGroups) ? root.rowGroups : [];
  const rowGroups: PqRowGroup[] = rgRaw.length
    ? rgRaw.map((g, i) => {
        const r = rec(g);
        return {
          index: i,
          numRows: Number(r.numRows || r.rows || rows.length) || rows.length,
          byteSize: Number(r.byteSize || r.totalByteSize || 0) || 0,
          columnCount: Number(r.columnCount || columns.length) || columns.length
        };
      })
    : [{ index: 0, numRows: rows.length, byteSize: 0, columnCount: columns.length }];
  return finishDataset(
    name,
    'json',
    asString(root.title || root.name, name),
    asString(root.createdBy || root.created_by),
    Number(root.version || 1) || 1,
    columns,
    rowGroups,
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

function parseCsv(text: string, fileName: string): PqDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Parquet CSV contains no rows');
  const header = parseCsvLine(lines[0]);
  const columns: PqColumn[] = header.map((name, i) => ({
    id: name,
    index: i,
    name,
    type: 'BYTE_ARRAY',
    convertedType: '',
    repetition: 'REQUIRED',
    path: name
  }));
  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] || ''));
    return row;
  });
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Parquet table';
  return finishDataset(fromFile, 'csv', fromFile, '', 1, columns, [{ index: 0, numRows: rows.length, byteSize: 0, columnCount: columns.length }], rows, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: PqSourceKind): PqDataset {
  let name = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Parquet table';
  const columns: PqColumn[] = [];
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
      columns.push({
        id: schema[1],
        index: columns.length,
        name: schema[1],
        type: schema[2].toUpperCase() === 'UTF8' ? 'BYTE_ARRAY' : schema[2].toUpperCase(),
        convertedType: schema[2].toUpperCase() === 'UTF8' ? 'UTF8' : '',
        repetition: 'REQUIRED',
        path: schema[1]
      });
      continue;
    }
    if (trimmed.includes('|')) {
      const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
      if (!columns.length) {
        parts.forEach((p, i) =>
          columns.push({ id: p, index: i, name: p, type: 'BYTE_ARRAY', convertedType: '', repetition: 'REQUIRED', path: p })
        );
        continue;
      }
      const row: Record<string, string> = {};
      columns.forEach((c, i) => (row[c.name] = parts[i] || ''));
      rows.push(row);
    }
  }
  if (!columns.length) throw new Error('Parquet markdown contains no schema');
  return finishDataset(name, sourceKind, name, '', 1, columns, [{ index: 0, numRows: rows.length, byteSize: 0, columnCount: columns.length }], rows, []);
}

export function parseParquetText(text: string, fileName = ''): PqDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Parquet file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Parquet JSON');
    }
    return parseJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsv(raw, fileName);
  const sourceKind: PqSourceKind = ext === 'md' ? 'markdown' : 'txt';
  if (/^#\s+/m.test(raw) || /:\s+[A-Za-z]/.test(raw) || raw.includes('|')) return parseMarkdown(raw, fileName, sourceKind);
  throw new Error('Not a Parquet table dump');
}

export function parseParquetBytes(bytes: Uint8Array, fileName = ''): PqDataset {
  if (!bytes.length) throw new Error('Parquet file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Parquet files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x41 &&
    bytes[2] === 0x52 &&
    bytes[3] === 0x31 &&
    (ext === 'parquet' || ext === 'parq' || ext === '')
  ) {
    return parseParquetBinary(bytes, fileName);
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x41 && bytes[2] === 0x52 && bytes[3] === 0x31) {
    return parseParquetBinary(bytes, fileName);
  }
  return parseParquetText(td.decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterPqColumns(columns: PqColumn[], query: string): PqColumn[] {
  const q = query.trim().toLowerCase();
  if (!q) return columns;
  const tokens = q.split(/\s+/).filter(Boolean);
  return columns.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('col:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return c.name.toLowerCase().includes(needle);
      }
      if (token.startsWith('type:')) return (c.convertedType || c.type).toLowerCase().includes(token.slice(5));
      return `${c.name} ${c.type} ${c.convertedType} ${c.repetition}`.toLowerCase().includes(token);
    })
  );
}

export function filterPqRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
