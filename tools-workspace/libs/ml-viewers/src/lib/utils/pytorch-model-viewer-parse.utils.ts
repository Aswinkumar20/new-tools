import type { PtColumn, PtDataset, PtLayer, PtParam, PtParamKind, PtSourceKind } from '../types/pytorch-model-viewer.types';
import { PT_JSON_SAMPLE } from '../constants/pytorch-model-viewer-sample.data';
import { isGzipMagic, isMostlyText } from './ml-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const PT_MAGIC = new Uint8Array([0x50, 0x54, 0x30, 0x31]); // PT01

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

function shapeProduct(shape: number[]): number {
  return shape.length ? shape.reduce((a, b) => a * Math.max(1, b), 1) : 0;
}

function shapeLabel(shape: number[]): string {
  return shape.length ? `[${shape.join(', ')}]` : '—';
}

function asNumberList(value: unknown): number[] {
  if (Array.isArray(value)) return value.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (typeof value === 'string') {
    return value
      .split(/[x,×,]/i)
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n));
  }
  return [];
}

function paramKind(raw: unknown, name: string): PtParamKind {
  const v = asString(raw).toLowerCase();
  if (v === 'weight' || v === 'bias' || v === 'buffer' || v === 'other') return v;
  if (/\.weight$/i.test(name) || /weight/i.test(name)) return 'weight';
  if (/\.bias$/i.test(name) || /bias/i.test(name)) return 'bias';
  if (/running_|buffer/i.test(name)) return 'buffer';
  return 'other';
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isPtMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === PT_MAGIC[0] && bytes[1] === PT_MAGIC[1] && bytes[2] === PT_MAGIC[2] && bytes[3] === PT_MAGIC[3];
}

function listZipStoreEntries(bytes: Uint8Array): Array<{ name: string; data: Uint8Array }> {
  const out: Array<{ name: string; data: Uint8Array }> = [];
  let offset = 0;
  while (offset + 30 <= bytes.length && bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {
    const method = bytes[offset + 8] | (bytes[offset + 9] << 8);
    const compSize = u32le(bytes, offset + 18);
    const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
    const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);
    const nameStart = offset + 30;
    const name = td.decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    if (method === 0) out.push({ name, data: bytes.subarray(dataStart, dataStart + compSize) });
    offset = dataStart + compSize;
  }
  return out;
}

function finishDataset(
  name: string,
  sourceKind: PtSourceKind,
  title: string,
  encoding: string,
  meta: { torchVersion?: string; format?: string },
  layers: PtLayer[],
  params: PtParam[],
  warnings: string[]
): PtDataset {
  if (!layers.length && !params.length) throw new Error('PyTorch model contains no layers or params');
  const columns: PtColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'inFeatures', index: 2, name: 'inFeatures', type: 'STRING' },
    { id: 'outFeatures', index: 3, name: 'outFeatures', type: 'STRING' }
  ];
  const rows = layers.map((layer) => ({
    name: layer.name,
    type: layer.type,
    inFeatures: layer.inFeatures,
    outFeatures: layer.outFeatures
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    torchVersion: meta.torchVersion || '—',
    format: meta.format || '—',
    layerCount: layers.length,
    paramCount: params.length,
    layers,
    params,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: PtSourceKind = 'json', warnings: string[] = []): PtDataset {
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || 'PyTorch model';
  const root = rec(raw);
  const name = asString(root.name || root.title || root.model, fromFile);
  const layerSrc = (Array.isArray(root.layers) ? root.layers : Array.isArray(root.modules) ? root.modules : []) as unknown[];
  const paramSrc = (Array.isArray(root.params) ? root.params : Array.isArray(root.state_dict) ? root.state_dict : []) as unknown[];
  const layers: PtLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    const layerName = asString(n.name, `layer${index + 1}`);
    return {
      id: layerName,
      index,
      name: layerName,
      type: asString(n.type || n.class || n.module, 'Module'),
      inFeatures: asString(n.inFeatures ?? n.in_features ?? n.in),
      outFeatures: asString(n.outFeatures ?? n.out_features ?? n.out),
      paramCount: Number(n.paramCount || 0)
    };
  });
  const params: PtParam[] = paramSrc.map((item, index) => {
    const t = rec(item);
    const pName = asString(t.name || t.key, `param${index + 1}`);
    const shape = asNumberList(t.shape || t.size || t.dims);
    const layer = asString(t.layer, pName.includes('.') ? pName.slice(0, pName.lastIndexOf('.')) : '');
    return {
      id: pName,
      index,
      name: pName,
      layer,
      kind: paramKind(t.kind || t.role, pName),
      dtype: asString(t.dtype || t.type, 'float32').toLowerCase(),
      shape,
      shapeLabel: shapeLabel(shape),
      numel: Number(t.numel) || shapeProduct(shape)
    };
  });
  if (!layers.length && params.length) {
    const seen = new Set<string>();
    for (const p of params) {
      const layerName = p.layer || p.name.split('.')[0] || p.name;
      if (seen.has(layerName)) continue;
      seen.add(layerName);
      layers.push({
        id: layerName,
        index: layers.length,
        name: layerName,
        type: 'Module',
        inFeatures: '',
        outFeatures: '',
        paramCount: params.filter((x) => x.layer === layerName).length
      });
    }
  }
  layers.forEach((layer) => {
    if (!layer.paramCount) layer.paramCount = params.filter((p) => p.layer === layer.name).length;
  });
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'torch' || sourceKind === 'zip' ? 'binary' : 'UTF-8',
    { torchVersion: asString(root.torchVersion || root.version), format: asString(root.format, 'torch.nn') },
    layers,
    params,
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

function parseCsvAsPt(text: string, fileName: string): PtDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('PyTorch CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('PyTorch CSV dump contains no schema');
  const layers: PtLayer[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const name = row.name || `layer${index + 1}`;
    layers.push({
      id: name,
      index,
      name,
      type: row.type || row.class || 'Module',
      inFeatures: row.inFeatures || row.in_features || '',
      outFeatures: row.outFeatures || row.out_features || '',
      paramCount: 0
    });
  });
  const modelName = fileName.replace(/\.[^.]+$/, '') || 'PyTorch model';
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', {}, layers, [], []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: PtSourceKind): PtDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'PyTorch model').trim();
  const keys: string[] = [];
  const layers: PtLayer[] = [];
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
      const layerName = row.name || `layer${layers.length + 1}`;
      layers.push({
        id: layerName,
        index: layers.length,
        name: layerName,
        type: row.type || row.class || 'Module',
        inFeatures: row.inFeatures || '',
        outFeatures: row.outFeatures || '',
        paramCount: 0
      });
    }
  }
  if (!layers.length) throw new Error('PyTorch markdown contains no layers');
  return finishDataset(name, sourceKind, name, 'UTF-8', {}, layers, [], []);
}

function parsePt01(bytes: Uint8Array, fileName: string): PtDataset {
  if (bytes.length < 8) throw new Error('PyTorch checkpoint header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('PyTorch checkpoint JSON is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid PyTorch checkpoint JSON');
  }
  return ingestJson(parsed, fileName, 'torch');
}

function parseTorchZip(bytes: Uint8Array, fileName: string): PtDataset {
  const warnings = ['ZIP checkpoint listed without running pickle'];
  const entries = listZipStoreEntries(bytes);
  if (!entries.length) warnings.push('No uncompressed ZIP entries found (deflate archives are not expanded)');
  const jsonEntry = entries.find((e) => /model\.json$|arch\.json$|extra\.json$/i.test(e.name));
  if (jsonEntry) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(td.decode(jsonEntry.data));
    } catch {
      throw new Error('Invalid model.json inside PyTorch ZIP');
    }
    if (entries.some((e) => /data\.pkl$/i.test(e.name))) warnings.push('data.pkl is present but not executed');
    return ingestJson(parsed, fileName, 'zip', warnings);
  }
  if (entries.some((e) => /data\.pkl$/i.test(e.name))) {
    warnings.push('Pickle weights were not unpickled');
  }
  throw new Error('PyTorch ZIP has no model.json architecture manifest');
}

export function buildSamplePtBytes(): Uint8Array {
  const json = te.encode(PT_JSON_SAMPLE);
  const out: number[] = [...PT_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSamplePtJson(): string {
  return PT_JSON_SAMPLE;
}

export function parsePtText(text: string, fileName = ''): PtDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('PyTorch model file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || looksLikeJson(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid PyTorch JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsPt(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a PyTorch model dump');
}

export function parsePtBytes(bytes: Uint8Array, fileName = ''): PtDataset {
  if (!bytes.length) throw new Error('PyTorch model file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed PyTorch files are not supported — decompress first');
  if (isPtMagic(bytes)) return parsePt01(bytes, fileName);
  if (isZipMagic(bytes)) return parseTorchZip(bytes, fileName);
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'pt' || ext === 'pth' || ext === 'bin') {
    if (!isMostlyText(bytes)) throw new Error('Not a PyTorch checkpoint (expected PT01 header, ZIP, or JSON)');
  }
  return parsePtText(td.decode(bytes), fileName);
}

export function filterPtLayers(layers: PtLayer[], query: string): PtLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:')) return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('op:')) return l.type.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('param:') || token.startsWith('dtype:') || token.startsWith('shape:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.type} ${l.inFeatures} ${l.outFeatures}`.toLowerCase().includes(token);
    })
  );
}

export function filterPtParams(params: PtParam[], query: string): PtParam[] {
  const q = query.trim().toLowerCase();
  if (!q) return params;
  const tokens = q.split(/\s+/).filter(Boolean);
  return params.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('param:') || token.startsWith('name:')) return p.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('layer:')) return p.layer.toLowerCase().includes(token.slice(6));
      if (token.startsWith('type:') || token.startsWith('kind:')) return p.kind.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('dtype:')) return p.dtype.toLowerCase().includes(token.slice(6));
      if (token.startsWith('shape:')) return p.shapeLabel.toLowerCase().includes(token.slice(6));
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.layer} ${p.kind} ${p.dtype} ${p.shapeLabel}`.toLowerCase().includes(token);
    })
  );
}

export function filterPtRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('layer:') || token.startsWith('type:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('param:') || token.startsWith('dtype:') || token.startsWith('shape:')) return true;
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
