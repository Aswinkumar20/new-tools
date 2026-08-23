import type { TvColumn, TvDataset, TvSourceKind, TvTensor, TvTensorKind } from '../types/tensor-visualization-viewer.types';
import { TV_JSON_SAMPLE } from '../constants/tensor-visualization-viewer-sample.data';
import { isGzipMagic, isMostlyText } from './ml-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const TV_MAGIC = new Uint8Array([0x54, 0x56, 0x30, 0x31]); // TV01
const NPY_MAGIC = new Uint8Array([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]); // \x93NUMPY

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function dimValue(value: unknown): number {
  if (value == null || value === '' || value === 'null' || value === 'None' || value === '?' || value === 'none') return -1;
  const n = Number(value);
  return Number.isFinite(n) ? n : -1;
}

function asNumberList(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(dimValue);
  if (typeof value === 'string') {
    return value
      .split(/[x×,]/i)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map(dimValue);
  }
  return [];
}

function shapeLabel(shape: number[]): string {
  if (!shape.length) return '—';
  return `[${shape.map((n) => (n < 0 ? 'null' : String(n))).join(', ')}]`;
}

function shapeProduct(shape: number[]): number {
  const dims = shape.filter((n) => n > 0);
  return dims.length ? dims.reduce((a, b) => a * b, 1) : 0;
}

function tensorKind(raw: unknown, name: string): TvTensorKind {
  const v = asString(raw).toLowerCase();
  if (v === 'input' || v === 'output' || v === 'weight' || v === 'bias' || v === 'activation' || v === 'other') return v;
  if (v === 'kernel') return 'weight';
  const n = name.toLowerCase();
  if (/input|feature/.test(n)) return 'input';
  if (/score|output|logit/.test(n)) return 'output';
  if (/kernel|weight/.test(n)) return 'weight';
  if (/bias/.test(n)) return 'bias';
  if (/act|relu|softmax/.test(n)) return 'activation';
  return 'other';
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isTvMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === TV_MAGIC[0] && bytes[1] === TV_MAGIC[1] && bytes[2] === TV_MAGIC[2] && bytes[3] === TV_MAGIC[3];
}

function isNpyMagic(bytes: Uint8Array): boolean {
  if (bytes.length < NPY_MAGIC.length) return false;
  for (let i = 0; i < NPY_MAGIC.length; i++) if (bytes[i] !== NPY_MAGIC[i]) return false;
  return true;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || fallback;
  if (/^shop[-_]?ranker$/i.test(fromFile) || /^shop[-_]?ranker$/i.test(fallback)) return 'ShopRanker';
  return fromFile;
}

function descrToDtype(descr: string): string {
  const d = descr.replace(/^[<=>|]/, '').toLowerCase();
  if (d === 'f2' || d === 'e') return 'float16';
  if (d === 'f4' || d === 'f') return 'float32';
  if (d === 'f8' || d === 'd') return 'float64';
  if (d === 'i1') return 'int8';
  if (d === 'i2') return 'int16';
  if (d === 'i4' || d === 'i') return 'int32';
  if (d === 'i8') return 'int64';
  if (d === 'u1' || d === 'b') return 'uint8';
  if (d === 'u2') return 'uint16';
  if (d === 'u4') return 'uint32';
  if (d === 'u8') return 'uint64';
  if (d === 'b1' || d === '?') return 'bool';
  return descr || 'float32';
}

function statString(value: unknown): string {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isFinite(n)) return String(n);
  return asString(value);
}

function inferStatsFromValues(values: number[]): { min: string; max: string; mean: string; std: string; nnz: string } {
  if (!values.length) return { min: '', max: '', mean: '', std: '', nnz: '' };
  let min = values[0];
  let max = values[0];
  let sum = 0;
  let nnz = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    if (v !== 0) nnz += 1;
  }
  const mean = sum / values.length;
  let varSum = 0;
  for (const v of values) varSum += (v - mean) * (v - mean);
  const std = Math.sqrt(varSum / values.length);
  return {
    min: String(Number(min.toFixed(4))),
    max: String(Number(max.toFixed(4))),
    mean: String(Number(mean.toFixed(4))),
    std: String(Number(std.toFixed(4))),
    nnz: String(nnz)
  };
}

function finishDataset(
  name: string,
  sourceKind: TvSourceKind,
  title: string,
  encoding: string,
  framework: string,
  tensors: TvTensor[],
  warnings: string[]
): TvDataset {
  if (!tensors.length) throw new Error('Tensor dump contains no tensors');
  tensors.forEach((t, i) => (t.index = i));
  const columns: TvColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'kind', index: 1, name: 'kind', type: 'STRING' },
    { id: 'dtype', index: 2, name: 'dtype', type: 'STRING' },
    { id: 'shape', index: 3, name: 'shape', type: 'STRING' },
    { id: 'numel', index: 4, name: 'numel', type: 'NUMBER' }
  ];
  const rows = tensors.map((t) => ({
    name: t.name,
    kind: t.kind,
    dtype: t.dtype,
    shape: t.shapeLabel,
    numel: String(t.numel)
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    framework: framework || '—',
    tensorCount: tensors.length,
    totalNumel: tensors.reduce((sum, t) => sum + (t.numel || 0), 0),
    tensors,
    columns,
    rows,
    warnings
  };
}

function makeTensor(
  name: string,
  kind: TvTensorKind,
  dtype: string,
  shape: number[],
  stats: { min?: unknown; max?: unknown; mean?: unknown; std?: unknown; nnz?: unknown; numel?: unknown; values?: unknown }
): TvTensor {
  const numel = Number(stats.numel) || shapeProduct(shape);
  let min = statString(stats.min);
  let max = statString(stats.max);
  let mean = statString(stats.mean);
  let std = statString(stats.std);
  let nnz = statString(stats.nnz);
  if (Array.isArray(stats.values) && stats.values.length) {
    const nums = stats.values.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    if (nums.length) {
      const inferred = inferStatsFromValues(nums);
      if (!min) min = inferred.min;
      if (!max) max = inferred.max;
      if (!mean) mean = inferred.mean;
      if (!std) std = inferred.std;
      if (!nnz) nnz = inferred.nnz;
    }
  }
  if (!nnz && numel) nnz = String(numel);
  return {
    id: name,
    index: 0,
    name,
    kind,
    dtype: dtype || 'float32',
    shape,
    shapeLabel: shapeLabel(shape),
    numel,
    min,
    max,
    mean,
    std,
    nnz
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: TvSourceKind = 'json', warnings: string[] = []): TvDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Tensors'));
  const src = (Array.isArray(root.tensors) ? root.tensors : Array.isArray(root.arrays) ? root.arrays : Array.isArray(root.weights) ? root.weights : []) as unknown[];
  const tensors: TvTensor[] = src.map((item, index) => {
    const n = rec(item);
    const tensorName = asString(n.name || n.key || n.id, `tensor${index + 1}`);
    const stats = rec(n.stats);
    return makeTensor(
      tensorName,
      tensorKind(n.kind || n.role, tensorName),
      asString(n.dtype || n.type, 'float32').toLowerCase(),
      asNumberList(n.shape || n.dims || n.size),
      {
        min: n.min ?? stats.min,
        max: n.max ?? stats.max,
        mean: n.mean ?? stats.mean,
        std: n.std ?? stats.std,
        nnz: n.nnz ?? stats.nnz,
        numel: n.numel ?? stats.numel,
        values: n.values ?? stats.values
      }
    );
  });
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'tensor' || sourceKind === 'npy' || sourceKind === 'npz' ? 'binary' : 'UTF-8',
    asString(root.framework || root.backend, 'generic'),
    tensors,
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

function parseCsvAsTv(text: string, fileName: string): TvDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Tensor CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const tensors: TvTensor[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const name = row.name || `tensor${index + 1}`;
    tensors.push(
      makeTensor(name, tensorKind(row.kind, name), (row.dtype || 'float32').toLowerCase(), asNumberList(row.shape), {
        min: row.min,
        max: row.max,
        mean: row.mean,
        std: row.std,
        nnz: row.nnz,
        numel: row.numel
      })
    );
  });
  const modelName = prettyModelName(fileName, 'Tensors');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'generic', tensors, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: TvSourceKind): TvDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Tensors')).trim();
  const keys: string[] = [];
  const tensors: TvTensor[] = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      keys.push(schema[1]);
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!keys.length) {
        parts.forEach((p) => keys.push(p));
        continue;
      }
      const row: Record<string, string> = {};
      keys.forEach((k, i) => (row[k] = parts[i] || ''));
      const tensorName = row.name || `tensor${tensors.length + 1}`;
      tensors.push(
        makeTensor(tensorName, tensorKind(row.kind, tensorName), (row.dtype || 'float32').toLowerCase(), asNumberList(row.shape), {
          min: row.min,
          max: row.max,
          mean: row.mean,
          std: row.std,
          nnz: row.nnz
        })
      );
    }
  }
  if (!tensors.length) throw new Error('Tensor markdown contains no tensors');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'generic', tensors, []);
}

function parseNpyHeader(bytes: Uint8Array, nameHint: string): TvTensor {
  if (!isNpyMagic(bytes) || bytes.length < 10) throw new Error('NPY header is truncated');
  const major = bytes[6];
  const headerLen = major === 1 ? u16le(bytes, 8) : u32le(bytes, 8);
  const headerStart = major === 1 ? 10 : 12;
  const header = td.decode(bytes.subarray(headerStart, headerStart + headerLen));
  const descr = /['"]descr['"]\s*:\s*['"]([^'"]+)['"]/.exec(header)?.[1] || '<f4';
  const shapeRaw = /['"]shape['"]\s*:\s*\(([^)]*)\)/.exec(header)?.[1] || '';
  const shape = asNumberList(shapeRaw.replace(/,$/, ''));
  return makeTensor(nameHint || 'array', tensorKind('', nameHint), descrToDtype(descr), shape, {});
}

function listZipStoreEntries(bytes: Uint8Array): Array<{ name: string; data: Uint8Array; method: number }> {
  const out: Array<{ name: string; data: Uint8Array; method: number }> = [];
  let offset = 0;
  while (offset + 30 <= bytes.length && bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {
    const method = bytes[offset + 8] | (bytes[offset + 9] << 8);
    const compSize = u32le(bytes, offset + 18);
    const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
    const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);
    const nameStart = offset + 30;
    const name = td.decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    out.push({ name, data: bytes.subarray(dataStart, dataStart + compSize), method });
    offset = dataStart + compSize;
  }
  return out;
}

function parseNpz(bytes: Uint8Array, fileName: string): TvDataset {
  const entries = listZipStoreEntries(bytes);
  const warnings: string[] = [];
  const tensors: TvTensor[] = [];
  for (const entry of entries) {
    if (!/\.npy$/i.test(entry.name)) continue;
    if (entry.method !== 0) {
      warnings.push(`${entry.name}: compressed NPZ members are not expanded — dump JSON/CSV instead`);
      continue;
    }
    try {
      tensors.push(parseNpyHeader(entry.data, entry.name.replace(/\.npy$/i, '')));
    } catch (error) {
      warnings.push(`${entry.name}: ${error instanceof Error ? error.message : 'invalid NPY'}`);
    }
  }
  if (!tensors.length) throw new Error('NPZ archive contains no readable .npy members');
  const name = prettyModelName(fileName, 'Tensors');
  return finishDataset(name, 'npz', name, 'binary', 'numpy', tensors, warnings);
}

function parseTv01(bytes: Uint8Array, fileName: string): TvDataset {
  if (bytes.length < 8) throw new Error('Tensor dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('Tensor dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid TV01 JSON');
  }
  return ingestJson(parsed, fileName, 'tensor');
}

export function buildSampleTvBytes(): Uint8Array {
  const json = te.encode(TV_JSON_SAMPLE);
  const out: number[] = [...TV_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleTvJson(): string {
  return TV_JSON_SAMPLE;
}

export function buildSampleNpyBytes(): Uint8Array {
  const headerObj = "{'descr': '<f4', 'fortran_order': False, 'shape': (4, 8), }";
  const headerBytes = te.encode(headerObj);
  const pad = (64 - ((10 + headerBytes.length) % 64)) % 64;
  const padded = new Uint8Array(headerBytes.length + pad);
  padded.set(headerBytes);
  padded[padded.length - 1] = 0x0a;
  const out: number[] = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0];
  const headerLen = padded.length;
  out.push(headerLen & 0xff, (headerLen >> 8) & 0xff);
  out.push(...padded);
  return new Uint8Array(out);
}

export function parseTvText(text: string, fileName = ''): TvDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Tensor dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || looksLikeJson(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid tensor JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsTv(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a tensor visualization dump');
}

export function parseTvBytes(bytes: Uint8Array, fileName = ''): TvDataset {
  if (!bytes.length) throw new Error('Tensor dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed tensor dumps are not supported — decompress first');
  if (isTvMagic(bytes)) return parseTv01(bytes, fileName);
  if (isNpyMagic(bytes)) {
    const tensor = parseNpyHeader(bytes, prettyModelName(fileName, 'array'));
    const name = prettyModelName(fileName, 'Tensors');
    return finishDataset(name, 'npy', name, 'binary', 'numpy', [tensor], []);
  }
  if (isZipMagic(bytes)) return parseNpz(bytes, fileName);
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'tensor' || ext === 'tensors' || ext === 'npy' || ext === 'npz') && !isMostlyText(bytes)) {
    throw new Error('Not a tensor dump (expected TV01, NPY, or JSON)');
  }
  return parseTvText(td.decode(bytes), fileName);
}

export function filterTvShapes(tensors: TvTensor[], query: string): TvTensor[] {
  const q = query.trim().toLowerCase();
  if (!q) return tensors;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tensors.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('tensor:') || token.startsWith('name:')) return t.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('kind:') || token.startsWith('type:')) return t.kind.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('dtype:')) return t.dtype.toLowerCase().includes(token.slice(6));
      if (token.startsWith('shape:')) {
        const needle = token.slice(6);
        return t.shapeLabel.toLowerCase().includes(needle) || t.name.toLowerCase().includes(needle);
      }
      if (token.startsWith('stat:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${t.name} ${t.kind} ${t.dtype} ${t.shapeLabel}`.toLowerCase().includes(token);
    })
  );
}

export function filterTvStats(tensors: TvTensor[], query: string): TvTensor[] {
  const q = query.trim().toLowerCase();
  if (!q) return tensors;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tensors.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('stat:')) {
        const needle = token.slice(5);
        return `${t.min} ${t.max} ${t.mean} ${t.std} ${t.nnz}`.toLowerCase().includes(needle);
      }
      if (token.startsWith('tensor:') || token.startsWith('name:')) return t.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('kind:') || token.startsWith('type:')) return t.kind.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('dtype:') || token.startsWith('shape:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${t.name} ${t.min} ${t.max} ${t.mean} ${t.std} ${t.nnz}`.toLowerCase().includes(token);
    })
  );
}

export function filterTvRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('tensor:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('dtype:') || token.startsWith('shape:') || token.startsWith('stat:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        const hit = Object.entries(row).find(([k]) => k.toLowerCase() === key.toLowerCase());
        return hit ? hit[1].toLowerCase().includes(needle) : false;
      }
      return Object.values(row).some((v) => v.toLowerCase().includes(token));
    })
  );
}
