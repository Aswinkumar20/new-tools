import type { AvDataset, AvField, AvRecord, AvSourceKind } from '../types/avro-viewer.types';
import { AV_SCHEMA, AV_SHOP_RECORDS } from '../constants/avro-viewer-sample.data';
import { isGzipMagic } from './data-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const MAGIC = new Uint8Array([0x4f, 0x62, 0x6a, 0x01]);
const SYNC = te.encode('ET00SHOPAVROSAMP');

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

function writeVarint(value: bigint, out: number[]): void {
  let n = value < 0n ? 0n : value;
  while (n > 0x7fn) {
    out.push(Number(n & 0x7fn) | 0x80);
    n >>= 7n;
  }
  out.push(Number(n));
}

function zz(n: number | bigint): bigint {
  const x = BigInt(n);
  return (x << 1n) ^ (x >> 63n);
}

function writeLong(n: number | bigint, out: number[]): void {
  writeVarint(zz(n), out);
}

function writeBytes(bytes: Uint8Array, out: number[]): void {
  writeLong(bytes.length, out);
  out.push(...bytes);
}

function writeString(value: string, out: number[]): void {
  writeBytes(te.encode(value), out);
}

function writeDouble(value: number, out: number[]): void {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, value, true);
  out.push(...new Uint8Array(buf));
}

class AvroReader {
  constructor(
    private readonly bytes: Uint8Array,
    public offset = 0
  ) {}

  remaining(): number {
    return this.bytes.length - this.offset;
  }

  private readByte(): number {
    if (this.offset >= this.bytes.length) throw new Error('Unexpected end of Avro buffer');
    return this.bytes[this.offset++];
  }

  readVarint(): bigint {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      const b = BigInt(this.readByte());
      result |= (b & 0x7fn) << shift;
      if (!(b & 0x80n)) break;
      shift += 7n;
      if (shift > 70n) throw new Error('Avro varint too long');
    }
    return result;
  }

  readLong(): number {
    const n = this.readVarint();
    const v = (n >> 1n) ^ -(n & 1n);
    return Number(v);
  }

  readBytes(): Uint8Array {
    const len = this.readLong();
    if (len < 0 || this.offset + len > this.bytes.length) throw new Error('Invalid Avro bytes length');
    const slice = this.bytes.subarray(this.offset, this.offset + len);
    this.offset += len;
    return slice;
  }

  readString(): string {
    return td.decode(this.readBytes());
  }

  readDouble(): number {
    if (this.offset + 8 > this.bytes.length) throw new Error('Truncated Avro double');
    const n = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 8).getFloat64(0, true);
    this.offset += 8;
    return n;
  }
}

interface AvSchemaField {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
}

interface AvSchema {
  name: string;
  namespace: string;
  fields: AvSchemaField[];
}

function unwrapType(raw: unknown): { type: string; nullable: boolean } {
  if (typeof raw === 'string') return { type: raw, nullable: false };
  if (Array.isArray(raw)) {
    const parts = raw.map((p) => (typeof p === 'string' ? p : rec(p).type || rec(p).name || 'record')).map(String);
    const nullable = parts.includes('null');
    const other = parts.find((p) => p !== 'null') || 'string';
    return { type: String(other), nullable };
  }
  const obj = rec(raw);
  if (asString(obj.type) === 'record' || asString(obj.name)) {
    return { type: asString(obj.name || 'record', 'record'), nullable: false };
  }
  return { type: asString(obj.type, 'string'), nullable: false };
}

function parseSchemaObject(raw: unknown): AvSchema {
  const root = rec(raw);
  const fieldsRaw = Array.isArray(root.fields) ? root.fields : [];
  const fields: AvSchemaField[] = fieldsRaw.map((item) => {
    const f = rec(item);
    const t = unwrapType(f.type);
    return {
      name: asString(f.name),
      type: t.type,
      nullable: t.nullable || asString(f.nullable) === 'true',
      defaultValue: f.default == null ? '' : String(f.default)
    };
  });
  return {
    name: asString(root.name, 'record'),
    namespace: asString(root.namespace || root.namespaceName),
    fields: fields.filter((f) => f.name)
  };
}

function layoutFields(fields: AvField[]): void {
  fields.forEach((f, i) => {
    f.x = 220;
    f.y = 40 + i * 70;
    f.index = i;
  });
}

function toAvFields(schema: AvSchema): AvField[] {
  const fields: AvField[] = schema.fields.map((f, i) => ({
    id: f.name,
    index: i,
    name: f.name,
    type: f.type,
    nullable: f.nullable,
    defaultValue: f.defaultValue,
    x: 0,
    y: 0
  }));
  layoutFields(fields);
  return fields;
}

function finishDataset(
  name: string,
  sourceKind: AvSourceKind,
  title: string,
  schema: AvSchema,
  codec: string,
  records: AvRecord[],
  warnings: string[]
): AvDataset {
  if (!schema.fields.length) throw new Error('Avro schema contains no fields');
  const fields = toAvFields(schema);
  records.forEach((r, i) => (r.index = i));
  return {
    name,
    sourceKind,
    title: title || name,
    namespace: schema.namespace,
    recordName: schema.name,
    codec,
    fields,
    records,
    warnings
  };
}

function encodeRecord(schema: AvSchema, row: Record<string, string | number>, out: number[]): void {
  for (const field of schema.fields) {
    const value = row[field.name];
    if (field.nullable) {
      if (value == null || value === '') {
        writeLong(0, out);
        continue;
      }
      writeLong(1, out);
    }
    const t = field.type;
    if (t === 'int' || t === 'long') writeLong(Number(value || 0), out);
    else if (t === 'string' || t === 'bytes') writeString(String(value ?? ''), out);
    else if (t === 'double' || t === 'float') writeDouble(Number(value || 0), out);
    else if (t === 'boolean') writeLong(value === 1 || value === 'true' ? 1 : 0, out);
    else writeString(String(value ?? ''), out);
  }
}

function decodeRecord(reader: AvroReader, schema: AvSchema): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of schema.fields) {
    if (field.nullable) {
      const idx = reader.readLong();
      if (idx === 0) {
        out[field.name] = '';
        continue;
      }
    }
    const t = field.type;
    if (t === 'int' || t === 'long') out[field.name] = String(reader.readLong());
    else if (t === 'string' || t === 'bytes') out[field.name] = reader.readString();
    else if (t === 'double' || t === 'float') out[field.name] = String(reader.readDouble());
    else if (t === 'boolean') out[field.name] = reader.readLong() ? 'true' : 'false';
    else out[field.name] = reader.readString();
  }
  return out;
}

export function buildSampleAvroBytes(
  records: ReadonlyArray<Record<string, string | number>> = AV_SHOP_RECORDS,
  schemaRaw: unknown = AV_SCHEMA
): Uint8Array {
  const schema = parseSchemaObject(schemaRaw);
  const schemaJson = JSON.stringify(schemaRaw);
  const out: number[] = [...MAGIC];
  writeLong(2, out);
  writeString('avro.schema', out);
  writeBytes(te.encode(schemaJson), out);
  writeString('avro.codec', out);
  writeBytes(te.encode('null'), out);
  writeLong(0, out);
  out.push(...SYNC);
  const body: number[] = [];
  for (const row of records) encodeRecord(schema, row, body);
  writeLong(records.length, out);
  writeLong(body.length, out);
  out.push(...body);
  out.push(...SYNC);
  return Uint8Array.from(out);
}

function readHeaderMap(reader: AvroReader): Record<string, string> {
  const meta: Record<string, string> = {};
  for (;;) {
    const count = reader.readLong();
    if (count === 0) break;
    const n = Math.abs(count);
    if (count < 0) reader.readLong();
    for (let i = 0; i < n; i++) {
      const key = reader.readString();
      const value = td.decode(reader.readBytes());
      meta[key] = value;
    }
  }
  return meta;
}

function parseAvroBinary(bytes: Uint8Array, fileName: string): AvDataset {
  if (bytes.length < 24) throw new Error('Avro file is too small');
  if (!(bytes[0] === 0x4f && bytes[1] === 0x62 && bytes[2] === 0x6a && bytes[3] === 0x01)) {
    throw new Error('Not an Avro container (missing Obj1 magic)');
  }
  const reader = new AvroReader(bytes, 4);
  const meta = readHeaderMap(reader);
  if (reader.remaining() < 16) throw new Error('Avro header is missing a sync marker');
  const sync = bytes.subarray(reader.offset, reader.offset + 16);
  reader.offset += 16;
  const schemaJson = meta['avro.schema'] || meta.schema || '';
  if (!schemaJson) throw new Error('Avro container has no avro.schema metadata');
  let schemaObj: unknown;
  try {
    schemaObj = JSON.parse(schemaJson);
  } catch {
    throw new Error('Invalid Avro schema JSON in container metadata');
  }
  const schema = parseSchemaObject(schemaObj);
  const codec = meta['avro.codec'] || 'null';
  const warnings: string[] = [];
  if (codec && codec !== 'null') warnings.push(`Codec "${codec}" is not inflated in this preview — schema only`);
  const records: AvRecord[] = [];
  if (codec === 'null' || !codec) {
    while (reader.remaining() > 16) {
      const count = reader.readLong();
      if (count === 0) break;
      const size = reader.readLong();
      const blockEnd = reader.offset + Math.max(0, size);
      const n = Math.abs(count);
      try {
        for (let i = 0; i < n; i++) {
          const values = decodeRecord(reader, schema);
          records.push({ id: `r-${records.length + 1}`, index: records.length, values });
        }
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : 'Failed to decode Avro block');
        reader.offset = blockEnd;
      }
      if (reader.remaining() >= 16) {
        const nextSync = bytes.subarray(reader.offset, reader.offset + 16);
        const matches = nextSync.every((b, i) => b === sync[i]);
        if (matches) reader.offset += 16;
        else break;
      }
    }
  }
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || schema.name || 'Avro records';
  return finishDataset(fromFile, 'avro', fromFile, schema, codec, records, warnings);
}

function parseJsonDump(raw: unknown, fileName: string, sourceKind: AvSourceKind): AvDataset {
  const root = rec(raw);
  const schemaRaw = root.schema || root['avro.schema'] || (root.type && root.fields ? root : null);
  if (!schemaRaw) throw new Error('Avro JSON contains no schema');
  const schema = parseSchemaObject(schemaRaw);
  const recordList = Array.isArray(root.records)
    ? root.records
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.rows)
        ? root.rows
        : [];
  const records: AvRecord[] = recordList.map((item, i) => {
    const row = rec(item);
    const values: Record<string, string> = {};
    for (const f of schema.fields) values[f.name] = row[f.name] == null ? '' : String(row[f.name]);
    return { id: `r-${i + 1}`, index: i, values };
  });
  const warnings: string[] = [];
  if (!records.length && sourceKind === 'avsc') warnings.push('Schema-only file — no data records');
  const name = asString(root.name || schema.name, fileName.replace(/\.[^.]+$/, '') || 'Avro records');
  return finishDataset(name, sourceKind, asString(root.title || schema.name, name), schema, asString(root.codec, 'null'), records, warnings);
}

function parseMarkdown(text: string, fileName: string, sourceKind: AvSourceKind): AvDataset {
  let name = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Avro records';
  const fields: AvSchemaField[] = [];
  const records: AvRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('```')) continue;
    const heading = /^#\s+(.+)$/.exec(trimmed);
    if (heading) {
      name = heading[1].trim();
      continue;
    }
    const field = /^([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)$/.exec(trimmed);
    if (field && !trimmed.includes('|')) {
      fields.push({ name: field[1], type: field[2], nullable: false, defaultValue: '' });
      continue;
    }
    if (trimmed.includes('|')) {
      const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
      if (!fields.length) {
        parts.forEach((p) => fields.push({ name: p, type: 'string', nullable: false, defaultValue: '' }));
        continue;
      }
      const values: Record<string, string> = {};
      fields.forEach((f, i) => (values[f.name] = parts[i] || ''));
      records.push({ id: `r-${records.length + 1}`, index: records.length, values });
    }
  }
  const schema: AvSchema = { name, namespace: '', fields };
  return finishDataset(name, sourceKind, name, schema, 'null', records, []);
}

export function parseAvroText(text: string, fileName = ''): AvDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Avro file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json' || ext === 'avsc') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Avro JSON');
    }
    const sourceKind: AvSourceKind = ext === 'avsc' || (!rec(parsed).records && rec(parsed).fields) ? 'avsc' : 'json';
    return parseJsonDump(parsed, fileName, sourceKind);
  }
  const sourceKind: AvSourceKind = ext === 'md' ? 'markdown' : 'txt';
  if (/^#\s+/m.test(raw) || /:\s+[A-Za-z]/.test(raw) || raw.includes('|')) return parseMarkdown(raw, fileName, sourceKind);
  throw new Error('Not an Avro schema or record dump');
}

export function parseAvroBytes(bytes: Uint8Array, fileName = ''): AvDataset {
  if (!bytes.length) throw new Error('Avro file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Avro files are not supported — decompress first');
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x62 && bytes[2] === 0x6a && bytes[3] === 0x01) {
    return parseAvroBinary(bytes, fileName);
  }
  return parseAvroText(td.decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterAvFields(fields: AvField[], query: string): AvField[] {
  const q = query.trim().toLowerCase();
  if (!q) return fields;
  const tokens = q.split(/\s+/).filter(Boolean);
  return fields.filter((f) =>
    tokens.every((token) => {
      if (token.startsWith('field:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return f.name.toLowerCase().includes(needle);
      }
      if (token.startsWith('type:')) return f.type.toLowerCase().includes(token.slice(5));
      return `${f.name} ${f.type} ${f.nullable ? 'nullable' : ''}`.toLowerCase().includes(token);
    })
  );
}

export function filterAvRecords(records: AvRecord[], query: string): AvRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return records;
  const tokens = q.split(/\s+/).filter(Boolean);
  return records.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('record:')) return Object.values(r.values).some((v) => v.toLowerCase().includes(token.slice(7)));
      const colon = token.indexOf(':');
      if (colon > 0 && !token.startsWith('field:') && !token.startsWith('type:') && !token.startsWith('name:')) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        const hit = Object.entries(r.values).find(([k]) => k.toLowerCase() === key.toLowerCase());
        return hit ? hit[1].toLowerCase().includes(needle) : false;
      }
      return Object.values(r.values).some((v) => v.toLowerCase().includes(token));
    })
  );
}
