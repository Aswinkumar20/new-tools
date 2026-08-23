import type { OrcColumn, OrcDataset, OrcSourceKind, OrcStripe } from '../types/orc-viewer.types';
import { ORC_SHOP_ROWS } from '../constants/orc-viewer-sample.data';
import { PbReader, PbWriter, readZigZagVarint, writeZigZagVarint } from './protobuf.utils';
import { isGzipMagic } from './data-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const ORC_MAGIC = new Uint8Array([0x4f, 0x52, 0x43]);

const ORC_KIND: Record<number, string> = {
  0: 'BOOLEAN',
  1: 'BYTE',
  2: 'SHORT',
  3: 'INT',
  4: 'LONG',
  5: 'FLOAT',
  6: 'DOUBLE',
  7: 'STRING',
  8: 'BINARY',
  9: 'TIMESTAMP',
  10: 'LIST',
  11: 'MAP',
  12: 'STRUCT',
  13: 'UNION',
  14: 'DECIMAL',
  15: 'DATE',
  16: 'VARCHAR',
  17: 'CHAR'
};

const ORC_CODEC: Record<number, string> = {
  0: 'NONE',
  1: 'ZLIB',
  2: 'SNAPPY',
  3: 'LZO',
  4: 'LZ4',
  5: 'ZSTD'
};

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

interface OrcTypeEl {
  kind: number;
  subtypes: number[];
  fieldNames: string[];
}

interface StripeInfo {
  offset: number;
  indexLength: number;
  dataLength: number;
  footerLength: number;
  numRows: number;
}

interface StreamEl {
  kind: number;
  column: number;
  length: number;
}

function writeRleInts(values: number[]): Uint8Array {
  const out: number[] = [];
  if (!values.length) return Uint8Array.from(out);
  out.push((values.length - 1) & 0x7f);
  for (const v of values) writeZigZagVarint(v, out);
  return Uint8Array.from(out);
}

function readRleInts(bytes: Uint8Array, count: number): number[] {
  const out: number[] = [];
  const cur = { o: 0 };
  while (out.length < count && cur.o < bytes.length) {
    let control = bytes[cur.o++];
    if (control >= 128) control -= 256;
    if (control < 0) {
      const repeats = -control;
      const value = readZigZagVarint(bytes, cur);
      for (let i = 0; i < repeats && out.length < count; i++) out.push(value);
    } else {
      const n = control + 1;
      for (let i = 0; i < n && out.length < count; i++) out.push(readZigZagVarint(bytes, cur));
    }
  }
  return out;
}

function writeF64le(value: number, out: number[]): void {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, value, true);
  out.push(...new Uint8Array(buf));
}

function readF64le(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getFloat64(0, true);
}

function writeType(kind: number, subtypes: number[] = [], names: string[] = []): Uint8Array {
  const w = new PbWriter();
  w.uint(1, kind);
  for (const s of subtypes) w.uint(2, s);
  for (const n of names) w.bytesField(3, n);
  return w.bytes();
}

function writeStripeInfo(s: StripeInfo): Uint8Array {
  const w = new PbWriter();
  w.uint(1, s.offset);
  w.uint(2, s.indexLength);
  w.uint(3, s.dataLength);
  w.uint(4, s.footerLength);
  w.uint(5, s.numRows);
  return w.bytes();
}

function writeStream(kind: number, column: number, length: number): Uint8Array {
  const w = new PbWriter();
  w.uint(1, kind);
  w.uint(2, column);
  w.uint(3, length);
  return w.bytes();
}

function writeEncoding(kind: number): Uint8Array {
  const w = new PbWriter();
  w.uint(1, kind);
  return w.bytes();
}

function writeMeta(name: string, value: string): Uint8Array {
  const w = new PbWriter();
  w.bytesField(1, name);
  w.bytesField(2, te.encode(value));
  return w.bytes();
}

export function buildSampleOrcBytes(rows: ReadonlyArray<Record<string, string | number>> = ORC_SHOP_ROWS): Uint8Array {
  const orderIds = rows.map((r) => Number(r.orderId));
  const skus = rows.map((r) => String(r.sku));
  const totals = rows.map((r) => Number(r.total));
  const counts = rows.map((r) => Number(r.itemCount));
  const longData = writeRleInts(orderIds);
  const skuLens = writeRleInts(skus.map((s) => te.encode(s).length));
  const skuBytes = te.encode(skus.join(''));
  const doubleOut: number[] = [];
  totals.forEach((n) => writeF64le(n, doubleOut));
  const doubleData = Uint8Array.from(doubleOut);
  const intData = writeRleInts(counts);

  const streams: Array<{ kind: number; column: number; data: Uint8Array }> = [
    { kind: 1, column: 1, data: longData },
    { kind: 2, column: 2, data: skuLens },
    { kind: 1, column: 2, data: skuBytes },
    { kind: 1, column: 3, data: doubleData },
    { kind: 1, column: 4, data: intData }
  ];

  const sf = new PbWriter();
  for (const s of streams) sf.message(1, writeStream(s.kind, s.column, s.data.length));
  for (let c = 0; c < 5; c++) sf.message(2, writeEncoding(0));
  const stripeFooter = sf.bytes();

  const stripeData: number[] = [];
  streams.forEach((s) => stripeData.push(...s.data));
  const dataLength = stripeData.length;

  const body: number[] = [...ORC_MAGIC];
  const stripeOffset = body.length;
  body.push(...stripeData, ...stripeFooter);

  const footer = new PbWriter();
  footer.uint(1, ORC_MAGIC.length);
  footer.uint(2, dataLength + stripeFooter.length);
  footer.message(
    3,
    writeStripeInfo({
      offset: stripeOffset,
      indexLength: 0,
      dataLength,
      footerLength: stripeFooter.length,
      numRows: rows.length
    })
  );
  footer.message(4, writeType(12, [1, 2, 3, 4], ['orderId', 'sku', 'total', 'itemCount']));
  footer.message(4, writeType(4));
  footer.message(4, writeType(7));
  footer.message(4, writeType(6));
  footer.message(4, writeType(3));
  footer.message(5, writeMeta('preview.json', JSON.stringify(rows)));
  footer.uint(6, rows.length);
  footer.uint(8, 0);
  const footerBytes = footer.bytes();
  body.push(...footerBytes);

  const ps = new PbWriter();
  ps.uint(1, footerBytes.length);
  ps.uint(2, 0);
  ps.uint(4, 0);
  ps.uint(4, 12);
  ps.uint(5, 0);
  ps.uint(6, 1);
  ps.bytesField(8000, 'ORC');
  const psBytes = ps.bytes();
  if (psBytes.length > 255) throw new Error('ORC postscript too large');
  body.push(...psBytes, psBytes.length);
  return Uint8Array.from(body);
}

function parseType(r: PbReader): OrcTypeEl {
  const el: OrcTypeEl = { kind: 12, subtypes: [], fieldNames: [] };
  for (;;) {
    const f = r.next();
    if (!f) break;
    if (f.field === 1 && f.wire === 0) el.kind = r.readUint();
    else if (f.field === 2 && f.wire === 0) el.subtypes.push(r.readUint());
    else if (f.field === 3 && f.wire === 2) el.fieldNames.push(r.readString());
    else r.skip(f.wire);
  }
  return el;
}

function parseStripe(r: PbReader): StripeInfo {
  const s: StripeInfo = { offset: 0, indexLength: 0, dataLength: 0, footerLength: 0, numRows: 0 };
  for (;;) {
    const f = r.next();
    if (!f) break;
    if (f.field === 1 && f.wire === 0) s.offset = r.readUint();
    else if (f.field === 2 && f.wire === 0) s.indexLength = r.readUint();
    else if (f.field === 3 && f.wire === 0) s.dataLength = r.readUint();
    else if (f.field === 4 && f.wire === 0) s.footerLength = r.readUint();
    else if (f.field === 5 && f.wire === 0) s.numRows = r.readUint();
    else r.skip(f.wire);
  }
  return s;
}

function parseMeta(r: PbReader): { name: string; value: string } {
  let name = '';
  let value = '';
  for (;;) {
    const f = r.next();
    if (!f) break;
    if (f.field === 1 && f.wire === 2) name = r.readString();
    else if (f.field === 2 && f.wire === 2) value = td.decode(r.readBytes());
    else r.skip(f.wire);
  }
  return { name, value };
}

function parseStripeFooter(bytes: Uint8Array): { streams: StreamEl[]; encodings: number[] } {
  const r = new PbReader(bytes);
  const streams: StreamEl[] = [];
  const encodings: number[] = [];
  for (;;) {
    const f = r.next();
    if (!f) break;
    if (f.field === 1 && f.wire === 2) {
      const inner = r.nested();
      const s: StreamEl = { kind: 1, column: 0, length: 0 };
      for (;;) {
        const g = inner.next();
        if (!g) break;
        if (g.field === 1 && g.wire === 0) s.kind = inner.readUint();
        else if (g.field === 2 && g.wire === 0) s.column = inner.readUint();
        else if (g.field === 3 && g.wire === 0) s.length = inner.readUint();
        else inner.skip(g.wire);
      }
      streams.push(s);
    } else if (f.field === 2 && f.wire === 2) {
      const inner = r.nested();
      let kind = 0;
      for (;;) {
        const g = inner.next();
        if (!g) break;
        if (g.field === 1 && g.wire === 0) kind = inner.readUint();
        else inner.skip(g.wire);
      }
      encodings.push(kind);
    } else r.skip(f.wire);
  }
  return { streams, encodings };
}

function flattenColumns(types: OrcTypeEl[]): OrcColumn[] {
  if (!types.length) return [];
  const root = types[0];
  if (root.kind === 12 && root.subtypes.length) {
    return root.subtypes.map((idx, i) => {
      const child = types[idx];
      const name = root.fieldNames[i] || `c${idx}`;
      return { id: name, index: i, name, type: ORC_KIND[child?.kind ?? 7] || 'STRING', path: name };
    });
  }
  const name = root.fieldNames[0] || 'value';
  return [{ id: name, index: 0, name, type: ORC_KIND[root.kind] || 'STRING', path: name }];
}

function decodeStreams(
  bytes: Uint8Array,
  stripe: StripeInfo,
  columns: OrcColumn[],
  warnings: string[]
): Array<Record<string, string>> {
  if (!stripe.footerLength || stripe.offset + stripe.dataLength + stripe.footerLength > bytes.length) {
    warnings.push('Stripe footer is missing or truncated');
    return [];
  }
  const footerBytes = bytes.subarray(
    stripe.offset + stripe.dataLength,
    stripe.offset + stripe.dataLength + stripe.footerLength
  );
  const { streams } = parseStripeFooter(footerBytes);
  let cursor = stripe.offset + stripe.indexLength;
  const byCol: Record<number, { data?: Uint8Array; length?: Uint8Array }> = {};
  for (const s of streams) {
    const chunk = bytes.subarray(cursor, cursor + s.length);
    cursor += s.length;
    const slot = byCol[s.column] ?? (byCol[s.column] = {});
    if (s.kind === 2) slot.length = chunk;
    else if (s.kind === 1) slot.data = chunk;
  }
  const n = stripe.numRows;
  const values: Record<number, string[]> = {};
  columns.forEach((col, i) => {
    const colIndex = i + 1;
    const slot = byCol[colIndex];
    const type = col.type;
    try {
      if (!slot?.data && type !== 'STRING') {
        values[i] = Array.from({ length: n }, () => '');
        return;
      }
      if (type === 'LONG' || type === 'INT' || type === 'SHORT' || type === 'BYTE') {
        values[i] = readRleInts(slot?.data || new Uint8Array(), n).map(String);
      } else if (type === 'DOUBLE' || type === 'FLOAT') {
        const out: string[] = [];
        const step = type === 'FLOAT' ? 4 : 8;
        const data = slot?.data || new Uint8Array();
        for (let r = 0; r < n; r++) {
          const o = r * step;
          if (o + step > data.length) {
            out.push('');
            continue;
          }
          out.push(
            String(
              type === 'FLOAT'
                ? new DataView(data.buffer, data.byteOffset + o, 4).getFloat32(0, true)
                : readF64le(data, o)
            )
          );
        }
        values[i] = out;
      } else if (type === 'STRING' || type === 'VARCHAR' || type === 'CHAR' || type === 'BINARY') {
        const lens = readRleInts(slot?.length || new Uint8Array(), n);
        const data = slot?.data || new Uint8Array();
        const out: string[] = [];
        let o = 0;
        for (const len of lens) {
          out.push(td.decode(data.subarray(o, o + len)));
          o += len;
        }
        while (out.length < n) out.push('');
        values[i] = out;
      } else if (type === 'BOOLEAN') {
        const data = slot?.data || new Uint8Array();
        values[i] = Array.from({ length: n }, (_, r) => (((data[r >> 3] >> (r & 7)) & 1) === 1 ? 'true' : 'false'));
      } else {
        values[i] = Array.from({ length: n }, () => '');
      }
    } catch (error) {
      warnings.push(`${col.name}: ${error instanceof Error ? error.message : 'stream decode failed'}`);
      values[i] = Array.from({ length: n }, () => '');
    }
  });
  const rows: Array<Record<string, string>> = [];
  for (let r = 0; r < n; r++) {
    const row: Record<string, string> = {};
    columns.forEach((c, i) => (row[c.name] = values[i]?.[r] ?? ''));
    rows.push(row);
  }
  return rows;
}

function finishDataset(
  name: string,
  sourceKind: OrcSourceKind,
  title: string,
  version: string,
  compression: string,
  numRows: number,
  columns: OrcColumn[],
  stripes: OrcStripe[],
  rows: Array<Record<string, string>>,
  warnings: string[]
): OrcDataset {
  if (!columns.length) throw new Error('ORC file contains no schema columns');
  columns.forEach((c, i) => (c.index = i));
  return {
    name,
    sourceKind,
    title: title || name,
    version,
    compression,
    numRows: numRows || rows.length,
    columns,
    stripes,
    rows,
    warnings
  };
}

function parseOrcBinary(bytes: Uint8Array, fileName: string): OrcDataset {
  if (bytes.length < 16) throw new Error('ORC file is too small');
  const psLen = bytes[bytes.length - 1];
  if (!psLen || psLen + 1 >= bytes.length) throw new Error('Invalid ORC postscript length');
  const psStart = bytes.length - 1 - psLen;
  const ps = new PbReader(bytes.subarray(psStart, bytes.length - 1));
  let footerLength = 0;
  let compression = 0;
  const version: number[] = [];
  let magic = '';
  for (;;) {
    const f = ps.next();
    if (!f) break;
    if (f.field === 1 && f.wire === 0) footerLength = ps.readUint();
    else if (f.field === 2 && f.wire === 0) compression = ps.readUint();
    else if (f.field === 4 && f.wire === 0) version.push(ps.readUint());
    else if (f.field === 8000 && f.wire === 2) magic = ps.readString();
    else ps.skip(f.wire);
  }
  if (magic && magic !== 'ORC') throw new Error('Not an ORC file (bad postscript magic)');
  if (!footerLength || psStart - footerLength < 0) throw new Error('Invalid ORC footer length');
  const footerBytes = bytes.subarray(psStart - footerLength, psStart);
  const fr = new PbReader(footerBytes);
  let numRows = 0;
  const types: OrcTypeEl[] = [];
  const stripeInfos: StripeInfo[] = [];
  const metas: Array<{ name: string; value: string }> = [];
  for (;;) {
    const f = fr.next();
    if (!f) break;
    if (f.field === 3 && f.wire === 2) stripeInfos.push(parseStripe(fr.nested()));
    else if (f.field === 4 && f.wire === 2) types.push(parseType(fr.nested()));
    else if (f.field === 5 && f.wire === 2) metas.push(parseMeta(fr.nested()));
    else if (f.field === 6 && f.wire === 0) numRows = fr.readUint();
    else fr.skip(f.wire);
  }
  const warnings: string[] = [];
  const columns = flattenColumns(types);
  if (!columns.length) throw new Error('ORC footer has no columns');
  if (compression !== 0) warnings.push(`${ORC_CODEC[compression] || 'Compressed'} stripes are not inflated in this preview`);
  let rows: Array<Record<string, string>> = [];
  if (compression === 0 && stripeInfos.length) {
    rows = decodeStreams(bytes, stripeInfos[0], columns, warnings);
  }
  if (!rows.length) {
    const preview = metas.find((m) => /preview/i.test(m.name));
    if (preview?.value) {
      try {
        const parsed = JSON.parse(preview.value);
        const list = Array.isArray(parsed) ? parsed : rec(parsed).rows;
        if (Array.isArray(list)) {
          rows = list.map((item) => {
            const row = rec(item);
            const out: Record<string, string> = {};
            for (const c of columns) out[c.name] = cell(row[c.name]);
            return out;
          });
        }
      } catch {
        warnings.push('ORC preview metadata could not be parsed');
      }
    }
  }
  if (!rows.length && compression !== 0) warnings.push('No preview rows — schema only');
  const stripes: OrcStripe[] = stripeInfos.map((s, i) => ({
    index: i,
    offset: s.offset,
    numRows: s.numRows || numRows,
    dataLength: s.dataLength,
    footerLength: s.footerLength
  }));
  if (!stripes.length) stripes.push({ index: 0, offset: 0, numRows: rows.length || numRows, dataLength: 0, footerLength: 0 });
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'ORC table';
  return finishDataset(
    fromFile,
    'orc',
    fromFile,
    version.length ? version.join('.') : '0.12',
    ORC_CODEC[compression] || 'NONE',
    numRows || rows.length,
    columns,
    stripes,
    rows,
    warnings
  );
}

function ingestSchema(columns: OrcColumn[], row: Record<string, unknown>, index: number): void {
  const name = asString(row.name || row.column || row.field || row.id);
  if (!name) return;
  columns.push({
    id: name,
    index,
    name,
    type: asString(row.type || row.dataType, 'STRING').toUpperCase(),
    path: asString(row.path, name)
  });
}

function parseJson(raw: unknown, fileName: string): OrcDataset {
  const root = rec(Array.isArray(raw) ? { rows: raw } : raw);
  const name = asString(root.name || root.title, fileName.replace(/\.[^.]+$/, '') || 'ORC table');
  const columns: OrcColumn[] = [];
  const schemaList = Array.isArray(root.schema) ? root.schema : Array.isArray(root.columns) ? root.columns : [];
  schemaList.forEach((item, i) => ingestSchema(columns, rec(item), i));
  const rowList = Array.isArray(root.rows) ? root.rows : Array.isArray(root.data) ? root.data : [];
  const rows: Array<Record<string, string>> = [];
  for (const item of rowList) {
    const row = rec(item);
    if (!columns.length) Object.keys(row).forEach((key, i) => ingestSchema(columns, { name: key, type: 'STRING' }, i));
    const out: Record<string, string> = {};
    for (const c of columns) out[c.name] = cell(row[c.name]);
    rows.push(out);
  }
  if (!columns.length) throw new Error('ORC JSON contains no schema');
  const stripeList = Array.isArray(root.stripes) ? root.stripes : [];
  const stripes: OrcStripe[] = stripeList.length
    ? stripeList.map((s, i) => {
        const r = rec(s);
        return {
          index: i,
          offset: Number(r.offset || 0) || 0,
          numRows: Number(r.numRows || r.rows || rows.length) || rows.length,
          dataLength: Number(r.dataLength || 0) || 0,
          footerLength: Number(r.footerLength || 0) || 0
        };
      })
    : [{ index: 0, offset: 0, numRows: rows.length, dataLength: 0, footerLength: 0 }];
  return finishDataset(
    name,
    'json',
    asString(root.title || root.name, name),
    asString(root.version, '0.12'),
    asString(root.compression, 'NONE').toUpperCase(),
    Number(root.numRows || rows.length) || rows.length,
    columns,
    stripes,
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

function parseCsv(text: string, fileName: string): OrcDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('ORC CSV contains no rows');
  const header = parseCsvLine(lines[0]);
  const columns: OrcColumn[] = header.map((name, i) => ({ id: name, index: i, name, type: 'STRING', path: name }));
  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] || ''));
    return row;
  });
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'ORC table';
  return finishDataset(fromFile, 'csv', fromFile, '0.12', 'NONE', rows.length, columns, [{ index: 0, offset: 0, numRows: rows.length, dataLength: 0, footerLength: 0 }], rows, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: OrcSourceKind): OrcDataset {
  let name = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'ORC table';
  const columns: OrcColumn[] = [];
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
      columns.push({ id: schema[1], index: columns.length, name: schema[1], type: schema[2].toUpperCase(), path: schema[1] });
      continue;
    }
    if (trimmed.includes('|')) {
      const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
      if (!columns.length) {
        parts.forEach((p, i) => columns.push({ id: p, index: i, name: p, type: 'STRING', path: p }));
        continue;
      }
      const row: Record<string, string> = {};
      columns.forEach((c, i) => (row[c.name] = parts[i] || ''));
      rows.push(row);
    }
  }
  if (!columns.length) throw new Error('ORC markdown contains no schema');
  return finishDataset(name, sourceKind, name, '0.12', 'NONE', rows.length, columns, [{ index: 0, offset: 0, numRows: rows.length, dataLength: 0, footerLength: 0 }], rows, []);
}

export function parseOrcText(text: string, fileName = ''): OrcDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('ORC file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid ORC JSON');
    }
    return parseJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsv(raw, fileName);
  const sourceKind: OrcSourceKind = ext === 'md' ? 'markdown' : 'txt';
  if (/^#\s+/m.test(raw) || /:\s+[A-Za-z]/.test(raw) || raw.includes('|')) return parseMarkdown(raw, fileName, sourceKind);
  throw new Error('Not an ORC table dump');
}

export function parseOrcBytes(bytes: Uint8Array, fileName = ''): OrcDataset {
  if (!bytes.length) throw new Error('ORC file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed ORC files are not supported — decompress first');
  const endMagic =
    bytes.length >= 4 &&
    bytes[bytes.length - 4] === 0x4f &&
    bytes[bytes.length - 3] === 0x52 &&
    bytes[bytes.length - 2] === 0x43;
  const startMagic = bytes.length >= 3 && bytes[0] === 0x4f && bytes[1] === 0x52 && bytes[2] === 0x43;
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'orc' || startMagic || endMagic) {
    try {
      return parseOrcBinary(bytes, fileName);
    } catch (error) {
      if (ext === 'orc' || startMagic) throw error;
    }
  }
  return parseOrcText(td.decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterOrcColumns(columns: OrcColumn[], query: string): OrcColumn[] {
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

export function filterOrcRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
