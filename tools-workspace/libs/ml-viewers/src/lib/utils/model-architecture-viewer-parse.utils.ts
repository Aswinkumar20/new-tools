import type {
  MaBlock,
  MaBlockRole,
  MaColumn,
  MaDataset,
  MaParam,
  MaParamKind,
  MaSourceKind
} from '../types/model-architecture-viewer.types';
import { MA_JSON_SAMPLE } from '../constants/model-architecture-viewer-sample.data';
import { isGzipMagic, isMostlyText } from './ml-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const MA_MAGIC = new Uint8Array([0x4d, 0x41, 0x30, 0x31]); // MA01

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
  if (value == null || value === '' || value === 'null' || value === 'None' || value === '?') return -1;
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

function shapeProduct(shape: number[]): number {
  const dims = shape.filter((n) => n > 0);
  return dims.length ? dims.reduce((a, b) => a * b, 1) : 0;
}

function shapeLabel(shape: number[]): string {
  if (!shape.length) return '—';
  return `[${shape.map((n) => (n < 0 ? 'null' : String(n))).join(', ')}]`;
}

function blockRole(raw: unknown, name: string): MaBlockRole {
  const v = asString(raw).toLowerCase();
  if (v === 'stem' || v === 'encoder' || v === 'decoder' || v === 'head' || v === 'other') return v;
  const n = name.toLowerCase();
  if (/stem|input|embed/.test(n)) return 'stem';
  if (/encod|backbone|body/.test(n)) return 'encoder';
  if (/decod/.test(n)) return 'decoder';
  if (/head|classif|score/.test(n)) return 'head';
  return 'other';
}

function paramKind(raw: unknown, name: string): MaParamKind {
  const v = asString(raw).toLowerCase();
  if (v === 'weight' || v === 'bias' || v === 'norm' || v === 'other') return v;
  if (/\.weight$|kernel/i.test(name)) return 'weight';
  if (/\.bias$/i.test(name)) return 'bias';
  if (/norm|running_/i.test(name)) return 'norm';
  return 'other';
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isMaMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === MA_MAGIC[0] && bytes[1] === MA_MAGIC[1] && bytes[2] === MA_MAGIC[2] && bytes[3] === MA_MAGIC[3];
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || fallback;
  if (/^shop[-_]?ranker$/i.test(fromFile) || /^shop[-_]?ranker$/i.test(fallback)) return 'ShopRanker';
  return fromFile;
}

function inferParams(blocks: MaBlock[]): MaParam[] {
  const params: MaParam[] = [];
  for (const block of blocks) {
    const inn = Number(block.inFeatures);
    const out = Number(block.outFeatures);
    if (!Number.isFinite(inn) || !Number.isFinite(out) || inn <= 0 || out <= 0) continue;
    if (/input|stem/i.test(block.type) && inn === out) continue;
    params.push({
      id: `${block.name}.weight`,
      index: params.length,
      name: `${block.name}.weight`,
      block: block.name,
      kind: 'weight',
      dtype: 'float32',
      shape: [out, inn],
      shapeLabel: shapeLabel([out, inn]),
      numel: out * inn
    });
    params.push({
      id: `${block.name}.bias`,
      index: params.length,
      name: `${block.name}.bias`,
      block: block.name,
      kind: 'bias',
      dtype: 'float32',
      shape: [out],
      shapeLabel: shapeLabel([out]),
      numel: out
    });
  }
  return params;
}

function finishDataset(
  name: string,
  sourceKind: MaSourceKind,
  title: string,
  encoding: string,
  family: string,
  blocks: MaBlock[],
  params: MaParam[],
  warnings: string[]
): MaDataset {
  if (!blocks.length && !params.length) throw new Error('Model architecture contains no blocks or params');
  params.forEach((p, i) => (p.index = i));
  blocks.forEach((b) => {
    if (!b.paramCount) b.paramCount = params.filter((p) => p.block === b.name).length;
  });
  const columns: MaColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'role', index: 2, name: 'role', type: 'STRING' },
    { id: 'inFeatures', index: 3, name: 'inFeatures', type: 'STRING' },
    { id: 'outFeatures', index: 4, name: 'outFeatures', type: 'STRING' }
  ];
  const rows = blocks.map((b) => ({
    name: b.name,
    type: b.type,
    role: b.role,
    inFeatures: b.inFeatures,
    outFeatures: b.outFeatures
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    family: family || '—',
    totalParams: params.reduce((sum, p) => sum + (p.numel || 0), 0),
    blockCount: blocks.length,
    paramCount: params.length,
    blocks,
    params,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: MaSourceKind = 'json', warnings: string[] = []): MaDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Architecture'));
  const blockSrc = (Array.isArray(root.blocks) ? root.blocks : Array.isArray(root.stages) ? root.stages : Array.isArray(root.layers) ? root.layers : []) as unknown[];
  const paramSrc = (Array.isArray(root.params) ? root.params : Array.isArray(root.parameters) ? root.parameters : []) as unknown[];
  const blocks: MaBlock[] = blockSrc.map((item, index) => {
    const n = rec(item);
    const blockName = asString(n.name, `block${index + 1}`);
    return {
      id: blockName,
      index,
      name: blockName,
      type: asString(n.type || n.class, 'Block'),
      role: blockRole(n.role, blockName),
      inFeatures: asString(n.inFeatures ?? n.in_features ?? n.in),
      outFeatures: asString(n.outFeatures ?? n.out_features ?? n.out),
      paramCount: Number(n.paramCount) || 0
    };
  });
  const params: MaParam[] = paramSrc.map((item, index) => {
    const t = rec(item);
    const pName = asString(t.name || t.key, `param${index + 1}`);
    const shape = asNumberList(t.shape || t.size || t.dims).filter((n) => n >= 0 || n === -1);
    const block = asString(t.block || t.layer, pName.includes('.') ? pName.slice(0, pName.lastIndexOf('.')) : '');
    return {
      id: pName,
      index,
      name: pName,
      block,
      kind: paramKind(t.kind || t.role, pName),
      dtype: asString(t.dtype || t.type, 'float32').toLowerCase(),
      shape,
      shapeLabel: shapeLabel(shape),
      numel: Number(t.numel) || shapeProduct(shape)
    };
  });
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'arch' ? 'binary' : 'UTF-8',
    asString(root.family || root.architecture || root.arch, 'mlp'),
    blocks,
    params.length ? params : inferParams(blocks),
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

function parseCsvAsMa(text: string, fileName: string): MaDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Architecture CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const blocks: MaBlock[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const name = row.name || `block${index + 1}`;
    blocks.push({
      id: name,
      index,
      name,
      type: row.type || row.class || 'Block',
      role: blockRole(row.role, name),
      inFeatures: row.inFeatures || row.in_features || '',
      outFeatures: row.outFeatures || row.out_features || '',
      paramCount: 0
    });
  });
  const modelName = prettyModelName(fileName, 'Architecture');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'mlp', blocks, inferParams(blocks), []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: MaSourceKind): MaDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Architecture')).trim();
  const keys: string[] = [];
  const blocks: MaBlock[] = [];
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
      const blockName = row.name || `block${blocks.length + 1}`;
      blocks.push({
        id: blockName,
        index: blocks.length,
        name: blockName,
        type: row.type || 'Block',
        role: blockRole(row.role, blockName),
        inFeatures: row.inFeatures || '',
        outFeatures: row.outFeatures || '',
        paramCount: 0
      });
    }
  }
  if (!blocks.length) throw new Error('Architecture markdown contains no blocks');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'mlp', blocks, inferParams(blocks), []);
}

function parseMa01(bytes: Uint8Array, fileName: string): MaDataset {
  if (bytes.length < 8) throw new Error('Architecture header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('Architecture JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid MA01 JSON');
  }
  return ingestJson(parsed, fileName, 'arch');
}

export function buildSampleMaBytes(): Uint8Array {
  const json = te.encode(MA_JSON_SAMPLE);
  const out: number[] = [...MA_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleMaJson(): string {
  return MA_JSON_SAMPLE;
}

export function parseMaText(text: string, fileName = ''): MaDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Model architecture file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || looksLikeJson(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid architecture JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsMa(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a model architecture dump');
}

export function parseMaBytes(bytes: Uint8Array, fileName = ''): MaDataset {
  if (!bytes.length) throw new Error('Model architecture file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed architecture files are not supported — decompress first');
  if (isMaMagic(bytes)) return parseMa01(bytes, fileName);
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'arch' || ext === 'spec') && !isMostlyText(bytes)) {
    throw new Error('Not a model architecture file (expected MA01 header or JSON)');
  }
  return parseMaText(td.decode(bytes), fileName);
}

export function filterMaBlocks(blocks: MaBlock[], query: string): MaBlock[] {
  const q = query.trim().toLowerCase();
  if (!q) return blocks;
  const tokens = q.split(/\s+/).filter(Boolean);
  return blocks.filter((b) =>
    tokens.every((token) => {
      if (token.startsWith('block:') || token.startsWith('name:')) return b.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('role:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return b.type.toLowerCase().includes(needle) || b.role.toLowerCase().includes(needle);
      }
      if (token.startsWith('param:') || token.startsWith('dtype:') || token.startsWith('shape:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${b.name} ${b.type} ${b.role} ${b.inFeatures} ${b.outFeatures}`.toLowerCase().includes(token);
    })
  );
}

export function filterMaParams(params: MaParam[], query: string): MaParam[] {
  const q = query.trim().toLowerCase();
  if (!q) return params;
  const tokens = q.split(/\s+/).filter(Boolean);
  return params.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('param:') || token.startsWith('name:')) return p.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('block:')) return p.block.toLowerCase().includes(token.slice(6));
      if (token.startsWith('type:') || token.startsWith('kind:')) return p.kind.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('dtype:')) return p.dtype.toLowerCase().includes(token.slice(6));
      if (token.startsWith('shape:')) return p.shapeLabel.toLowerCase().includes(token.slice(6));
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.block} ${p.kind} ${p.dtype} ${p.shapeLabel}`.toLowerCase().includes(token);
    })
  );
}

export function filterMaRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('block:') || token.startsWith('type:') || token.startsWith('name:') || token.startsWith('role:')) {
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
