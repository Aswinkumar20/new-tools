import type { NnColumn, NnConnection, NnDataset, NnLayer, NnSourceKind } from '../types/neural-network-graph-viewer.types';
import { NN_JSON_SAMPLE } from '../constants/neural-network-graph-viewer-sample.data';
import { isGzipMagic, isMostlyText } from './ml-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const NN_MAGIC = new Uint8Array([0x4e, 0x4e, 0x30, 0x31]); // NN01

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

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isNnMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === NN_MAGIC[0] && bytes[1] === NN_MAGIC[1] && bytes[2] === NN_MAGIC[2] && bytes[3] === NN_MAGIC[3];
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || fallback;
  if (/^shop[-_]?ranker$/i.test(fromFile) || /^shop[-_]?ranker$/i.test(fallback)) return 'ShopRanker';
  return fromFile;
}

function inferConnections(layers: NnLayer[]): NnConnection[] {
  const out: NnConnection[] = [];
  for (let i = 0; i < layers.length - 1; i++) {
    const source = layers[i].name;
    const target = layers[i + 1].name;
    out.push({
      id: `${source}->${target}`,
      index: i,
      source,
      target,
      label: '',
      weight: ''
    });
  }
  return out;
}

function finishDataset(
  name: string,
  sourceKind: NnSourceKind,
  title: string,
  encoding: string,
  framework: string,
  layers: NnLayer[],
  connections: NnConnection[],
  warnings: string[]
): NnDataset {
  if (!layers.length && !connections.length) throw new Error('Neural network graph contains no layers or connections');
  const columns: NnColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'units', index: 2, name: 'units', type: 'STRING' },
    { id: 'activation', index: 3, name: 'activation', type: 'STRING' }
  ];
  const rows = layers.map((layer) => ({
    name: layer.name,
    type: layer.type,
    units: layer.units,
    activation: layer.activation
  }));
  connections.forEach((c, i) => (c.index = i));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    framework: framework || '—',
    layerCount: layers.length,
    connectionCount: connections.length,
    layers,
    connections,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: NnSourceKind = 'json', warnings: string[] = []): NnDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'NN graph'));
  const layerSrc = (Array.isArray(root.layers) ? root.layers : Array.isArray(root.nodes) ? root.nodes : []) as unknown[];
  const connSrc = (Array.isArray(root.connections) ? root.connections : Array.isArray(root.edges) ? root.edges : []) as unknown[];
  const layers: NnLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    const layerName = asString(n.name || n.id, `layer${index + 1}`);
    return {
      id: layerName,
      index,
      name: layerName,
      type: asString(n.type || n.op || n.class, 'Layer'),
      units: asString(n.units ?? n.outFeatures ?? n.out),
      activation: asString(n.activation || n.act)
    };
  });
  const connections: NnConnection[] = connSrc.map((item, index) => {
    const e = rec(item);
    const source = asString(e.source || e.from || e.src);
    const target = asString(e.target || e.to || e.dst);
    return {
      id: asString(e.id, `${source}->${target}` || `edge${index + 1}`),
      index,
      source,
      target,
      label: asString(e.label),
      weight: asString(e.weight ?? e.w)
    };
  });
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'nn' ? 'binary' : 'UTF-8',
    asString(root.framework || root.backend, 'generic'),
    layers,
    connections.length ? connections : inferConnections(layers),
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

function parseCsvAsNn(text: string, fileName: string): NnDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('NN graph CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: NnLayer[] = [];
  const connections: NnConnection[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    if (row.source || row.target || row.from || row.to) {
      const source = row.source || row.from || '';
      const target = row.target || row.to || '';
      connections.push({
        id: `${source}->${target}`,
        index: connections.length,
        source,
        target,
        label: row.label || '',
        weight: row.weight || ''
      });
      return;
    }
    const name = row.name || `layer${index + 1}`;
    layers.push({
      id: name,
      index: layers.length,
      name,
      type: row.type || row.op || 'Layer',
      units: row.units || '',
      activation: row.activation || row.act || ''
    });
  });
  const modelName = prettyModelName(fileName, 'NN graph');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'generic', layers, connections.length ? connections : inferConnections(layers), []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: NnSourceKind): NnDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'NN graph')).trim();
  const keys: string[] = [];
  const layers: NnLayer[] = [];
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
        type: row.type || 'Layer',
        units: row.units || '',
        activation: row.activation || ''
      });
    }
  }
  if (!layers.length) throw new Error('NN graph markdown contains no layers');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'generic', layers, inferConnections(layers), []);
}

function parseNn01(bytes: Uint8Array, fileName: string): NnDataset {
  if (bytes.length < 8) throw new Error('NN graph header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('NN graph JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid NN01 JSON');
  }
  return ingestJson(parsed, fileName, 'nn');
}

export function buildSampleNnBytes(): Uint8Array {
  const json = te.encode(NN_JSON_SAMPLE);
  const out: number[] = [...NN_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleNnJson(): string {
  return NN_JSON_SAMPLE;
}

export function parseNnText(text: string, fileName = ''): NnDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Neural network graph file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || looksLikeJson(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid NN graph JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsNn(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a neural network graph dump');
}

export function parseNnBytes(bytes: Uint8Array, fileName = ''): NnDataset {
  if (!bytes.length) throw new Error('Neural network graph file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed NN graphs are not supported — decompress first');
  if (isNnMagic(bytes)) return parseNn01(bytes, fileName);
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'nn' || ext === 'nngraph' || ext === 'graph') && !isMostlyText(bytes)) {
    throw new Error('Not a neural network graph (expected NN01 header or JSON)');
  }
  return parseNnText(td.decode(bytes), fileName);
}

export function filterNnLayers(layers: NnLayer[], query: string): NnLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:')) return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('op:')) return l.type.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('act:')) return l.activation.toLowerCase().includes(token.slice(4));
      if (token.startsWith('conn:') || token.startsWith('from:') || token.startsWith('to:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.type} ${l.units} ${l.activation}`.toLowerCase().includes(token);
    })
  );
}

export function filterNnConnections(connections: NnConnection[], query: string): NnConnection[] {
  const q = query.trim().toLowerCase();
  if (!q) return connections;
  const tokens = q.split(/\s+/).filter(Boolean);
  return connections.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('conn:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return `${c.source} ${c.target} ${c.label}`.toLowerCase().includes(needle);
      }
      if (token.startsWith('from:') || token.startsWith('source:')) return c.source.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('to:') || token.startsWith('target:')) return c.target.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('layer:') || token.startsWith('type:') || token.startsWith('act:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.source} ${c.target} ${c.label} ${c.weight}`.toLowerCase().includes(token);
    })
  );
}

export function filterNnRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('layer:') || token.startsWith('type:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('conn:') || token.startsWith('from:') || token.startsWith('to:') || token.startsWith('act:')) return true;
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
