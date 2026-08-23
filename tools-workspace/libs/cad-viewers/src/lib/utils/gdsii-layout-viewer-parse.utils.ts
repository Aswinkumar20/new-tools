import type {
  GdCell,
  GdColumn,
  GdDataset,
  GdFeature,
  GdFeatType,
  GdLayer,
  GdLayerFunction,
  GdSourceKind
} from '../types/gdsii-layout-viewer.types';
import { GD_ASCII_SAMPLE, GD_JSON_SAMPLE } from '../constants/gdsii-layout-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const GD01 = [0x47, 0x44, 0x30, 0x31];

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): CadDumpRec {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as CadDumpRec) : {};
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{["\d]|true|false|null|-)/.test(t);
}

function looksLikeGdsii(text: string): boolean {
  const t = text.trim();
  if (/\bGDSII dump\b/i.test(t)) return true;
  if (/^\s*HEADER\b/m.test(t) && /^\s*(?:BGNLIB|ENDLIB)\b/m.test(t)) return true;
  if (/^\s*CELL\s+\S+/m.test(t) && /^\s*(?:BOUNDARY|PATH|SREF)\s+/m.test(t)) return true;
  if (/^\s*LAYER\s+\d+/m.test(t) && /^\s*BOUNDARY\s+/m.test(t)) return true;
  return false;
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function layerFunction(raw: unknown): GdLayerFunction {
  const v = asString(raw).toLowerCase();
  if (v === 'metal' || v === 'poly' || v === 'contact' || v === 'well' || v === 'other') return v;
  if (/metal|m\d+|cu|al/.test(v)) return 'metal';
  if (/poly|gate|active|diff/.test(v)) return 'poly';
  if (/contact|via|cut/.test(v)) return 'contact';
  if (/well|nwell|pwell|nimplant|pimplant/.test(v)) return 'well';
  return 'other';
}

function featType(raw: unknown, name: string): GdFeatType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'boundary' || v === 'path' || v === 'sref' || v === 'text' || v === 'box' || v === 'other') return v;
  if (v === 'polygon' || v === 'poly' || v === 'region') return 'boundary';
  if (v === 'line' || v === 'track' || v === 'wire') return 'path';
  if (v === 'instance' || v === 'aref' || v === 'cellref') return 'sref';
  if (v === 'via' || v === 'rect') return 'box';
  if (v === 'label') return 'text';
  return 'other';
}

function asPoints(value: unknown): Array<{ x: number; y: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (Array.isArray(item) && item.length >= 2) return { x: asNumber(item[0]), y: asNumber(item[1]) };
      const p = rec(item);
      return { x: asNumber(p.x), y: asNumber(p.y) };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function lineLength(x: number, y: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x, y2 - y);
}

function polyLength(points: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

function functionColor(fn: GdLayerFunction, fallback = 7): number {
  if (fn === 'metal') return 4;
  if (fn === 'poly') return 7;
  if (fn === 'contact') return 2;
  if (fn === 'well') return 3;
  return fallback;
}

function makeLayer(name: string, fn: GdLayerFunction, stackIndex = 0, color = 0, visible = true, itemCount = 0, index = 0): GdLayer {
  const c = color || functionColor(fn);
  return { id: name, index, name, function: fn, stackIndex, color: c, colorHex: aciToHex(c), visible, itemCount };
}

function makeCell(name: string, itemCount = 0, index = 0): GdCell {
  return { id: name, index, name, itemCount };
}

function makeFeat(raw: CadDumpRec, index: number, fallbackLayer: string, fallbackCell: string, colors: Map<string, string>): GdFeature {
  const name = asString(raw.name || raw.id, `f${index + 1}`);
  const type = featType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius);
  const layer = asString(raw.layer, fallbackLayer || '1');
  const cell = asString(raw.cell, fallbackCell || 'TOP');
  const width = asNumber(raw.width, type === 'path' ? 0.15 : 0);
  const length =
    type === 'path'
      ? lineLength(x, y, x2, y2)
      : type === 'boundary'
        ? polyLength(points)
        : type === 'box'
          ? Number((2 * Math.PI * r).toFixed(3))
          : asNumber(raw.length);
  return {
    id: name,
    index,
    name,
    type,
    layer,
    cell,
    colorHex: asString(raw.colorHex) || colors.get(layer) || aciToHex(asNumber(raw.color, 7)),
    x,
    y,
    x2,
    y2,
    r,
    width,
    text: asString(raw.text || raw.label || (type === 'sref' ? name : '')),
    length,
    points
  };
}

function finishDataset(
  name: string,
  sourceKind: GdSourceKind,
  title: string,
  encoding: string,
  gdsVer: string,
  units: string,
  layers: GdLayer[],
  cells: GdCell[],
  features: GdFeature[],
  warnings: string[]
): GdDataset {
  if (!layers.length && !cells.length && !features.length) {
    throw new Error('GDSII dump contains no layers, cells, or features');
  }
  features.forEach((f, i) => (f.index = i));
  layers.forEach((l, i) => {
    l.index = i;
    if (!l.itemCount) l.itemCount = features.filter((f) => f.layer === l.name).length;
  });
  cells.forEach((c, i) => {
    c.index = i;
    if (!c.itemCount) c.itemCount = features.filter((f) => f.cell === c.name).length;
  });
  const columns: GdColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'layer', index: 2, name: 'layer', type: 'STRING' },
    { id: 'cell', index: 3, name: 'cell', type: 'STRING' },
    { id: 'x', index: 4, name: 'x', type: 'NUMBER' }
  ];
  const rows = features.map((f) => ({ name: f.name, type: f.type, layer: f.layer, cell: f.cell, x: String(f.x) }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    gdsVer: gdsVer || '—',
    units: units || 'um',
    layerCount: layers.length,
    cellCount: cells.length,
    featCount: features.length,
    layers,
    cells,
    features,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: GdSourceKind = 'json', warnings: string[] = []): GdDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Layout'));
  const layerSrc = (Array.isArray(root.layers) ? root.layers : Array.isArray(root.stack) ? root.stack : []) as unknown[];
  const cellSrc = (Array.isArray(root.cells) ? root.cells : Array.isArray(root.structures) ? root.structures : []) as unknown[];
  const featSrc = (Array.isArray(root.features) ? root.features : Array.isArray(root.elements) ? root.elements : []) as unknown[];
  const layers: GdLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    return makeLayer(
      asString(n.name, `${index + 1}`),
      layerFunction(n.function || n.kind || n.name),
      asNumber(n.stackIndex ?? n.index, index),
      asNumber(n.color ?? n.aci),
      n.visible !== false,
      asNumber(n.itemCount),
      index
    );
  });
  const cells: GdCell[] = cellSrc.map((item, index) => {
    const n = rec(item);
    return makeCell(asString(n.name, `CELL${index + 1}`), asNumber(n.itemCount), index);
  });
  const colors = new Map(layers.map((l) => [l.name, l.colorHex] as const));
  const features = featSrc.map((item, index) => makeFeat(rec(item), index, layers[0]?.name || '1', cells[0]?.name || 'TOP', colors));
  if (!layers.length) {
    const names = [...new Set(features.map((f) => f.layer || '1'))];
    names.forEach((ln, i) => layers.push(makeLayer(ln, layerFunction(ln), i, 0, true, 0, i)));
  }
  if (!cells.length) {
    const names = [...new Set(features.map((f) => f.cell).filter(Boolean))];
    names.forEach((cn, i) => cells.push(makeCell(cn, 0, i)));
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'gdsii' ? 'ASCII' : 'UTF-8',
    asString(root.gdsVer || root.version, '5.0'),
    asString(root.units, 'um'),
    layers,
    cells,
    features,
    warnings
  );
}

function parseCoordList(args: string): number[] {
  return args
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n));
}

function pairsFromCoords(nums: number[]): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i], y: nums[i + 1] });
  return out;
}

function ensureLayer(layers: GdLayer[], colors: Map<string, string>, name: string, fn?: GdLayerFunction, stackIndex?: number): GdLayer {
  let layer = layers.find((l) => l.name === name);
  if (!layer) {
    layer = makeLayer(name, fn || layerFunction(name), stackIndex ?? layers.length, 0, true, 0, layers.length);
    layers.push(layer);
    colors.set(layer.name, layer.colorHex);
  }
  return layer;
}

function ensureCell(cells: GdCell[], name: string): GdCell {
  let cell = cells.find((c) => c.name === name);
  if (!cell && name) {
    cell = makeCell(name, 0, cells.length);
    cells.push(cell);
  }
  return cell || makeCell(name || 'TOP');
}

function parseDumpGdsii(text: string, fileName: string): GdDataset {
  const dumpMatch = /GDSII dump\s+(\S+)(?:\s+(\S+))?/i.exec(text);
  const headerVer = /^\s*HEADER\s+(\S+)/im.exec(text)?.[1];
  const libName = /^\s*BGNLIB\s+(\S+)/im.exec(text)?.[1];
  const gdsVer = dumpMatch?.[2] || headerVer || '5.0';
  const name = prettyModelName(fileName, dumpMatch?.[1] || libName || 'Layout');
  const units = /UNITS\s+[^\n]*\b(um|mm|nm)\b/i.exec(text)?.[1]?.toLowerCase() || 'um';
  const layers: GdLayer[] = [];
  const cells: GdCell[] = [];
  const features: GdFeature[] = [];
  const colors = new Map<string, string>();

  const layerRe = /^\s*LAYER\s+(\S+)(?:\s+(\S+))?(?:\s+(\d+))?/gim;
  let layerMatch: RegExpExecArray | null;
  while ((layerMatch = layerRe.exec(text))) {
    ensureLayer(layers, colors, layerMatch[1], layerFunction(layerMatch[2] || layerMatch[1]), layerMatch[3] ? Number(layerMatch[3]) : layers.length);
  }

  const cellRe = /^\s*CELL\s+(\S+)/gim;
  let cellMatch: RegExpExecArray | null;
  while ((cellMatch = cellRe.exec(text))) {
    ensureCell(cells, cellMatch[1]);
  }

  const featRe = /^\s*(BOUNDARY|PATH|SREF|TEXT|BOX)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/gim;
  let featMatch: RegExpExecArray | null;
  while ((featMatch = featRe.exec(text))) {
    const kind = featMatch[1].toUpperCase();
    const itemName = featMatch[2];
    const cellName = featMatch[3];
    const layerName = featMatch[4];
    const rest = (featMatch[5] || '').trim();
    ensureCell(cells, cellName);
    ensureLayer(layers, colors, layerName, layerFunction(layerName));
    if (kind === 'BOUNDARY') {
      const pts = pairsFromCoords(parseCoordList(rest));
      features.push(makeFeat({ name: itemName, type: 'boundary', layer: layerName, cell: cellName, points: pts }, features.length, layerName, cellName, colors));
    } else if (kind === 'PATH') {
      const nums = parseCoordList(rest);
      features.push(
        makeFeat(
          { name: itemName, type: 'path', layer: layerName, cell: cellName, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3], width: nums[4] },
          features.length,
          layerName,
          cellName,
          colors
        )
      );
    } else if (kind === 'SREF') {
      const nums = parseCoordList(rest);
      features.push(makeFeat({ name: itemName, type: 'sref', layer: layerName, cell: cellName, x: nums[0], y: nums[1], text: itemName }, features.length, layerName, cellName, colors));
    } else if (kind === 'TEXT') {
      const nums = parseCoordList(rest);
      const label = rest.replace(/^[\d.\s,-]+/, '').trim() || itemName;
      features.push(makeFeat({ name: itemName, type: 'text', layer: layerName, cell: cellName, x: nums[0], y: nums[1], text: label }, features.length, layerName, cellName, colors));
    } else if (kind === 'BOX') {
      const nums = parseCoordList(rest);
      features.push(makeFeat({ name: itemName, type: 'box', layer: layerName, cell: cellName, x: nums[0], y: nums[1], r: nums[2] }, features.length, layerName, cellName, colors));
    }
  }

  return finishDataset(name, 'gdsii', name, 'ASCII', gdsVer, units, layers, cells, features, []);
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

function parseCsvAsGd(text: string, fileName: string): GdDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('GDSII CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: GdLayer[] = [];
  const cells: GdCell[] = [];
  const features: GdFeature[] = [];
  const colors = new Map<string, string>();
  lines.slice(1).forEach((line) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'layer' || type === 'stack') {
      const layer = makeLayer(row.name || row.layer || `${layers.length + 1}`, layerFunction(row.function || row.name || row.layer), layers.length, 0, true, 0, layers.length);
      layers.push(layer);
      colors.set(layer.name, layer.colorHex);
      return;
    }
    if (type === 'cell' || type === 'structure') {
      cells.push(makeCell(row.name || row.cell || `CELL${cells.length + 1}`, 0, cells.length));
      return;
    }
    features.push(
      makeFeat(
        { name: row.name, type: row.type, layer: row.layer, cell: row.cell, x: row.x, y: row.y, x2: row.x2, y2: row.y2, r: row.r, text: row.text },
        features.length,
        row.layer || '1',
        row.cell || 'TOP',
        colors
      )
    );
  });
  return finishDataset(prettyModelName(fileName, 'Layout'), 'csv', prettyModelName(fileName, 'Layout'), 'UTF-8', '5.0', 'um', layers, cells, features, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: GdSourceKind): GdDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Layout')).trim();
  const keys: string[] = [];
  const layers: GdLayer[] = [];
  const cells: GdCell[] = [];
  const features: GdFeature[] = [];
  const colors = new Map<string, string>();
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
      const type = (row.type || '').toLowerCase();
      if (type === 'layer' || type === 'stack') {
        const layer = makeLayer(row.name || row.layer || `${layers.length + 1}`, layerFunction(row.function || row.name || row.layer), layers.length, 0, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
        continue;
      }
      if (type === 'cell' || type === 'structure') {
        cells.push(makeCell(row.name || row.cell || `CELL${cells.length + 1}`, 0, cells.length));
        continue;
      }
      features.push(makeFeat({ name: row.name, type: row.type, layer: row.layer, cell: row.cell, text: row.text }, features.length, row.layer || '1', row.cell || 'TOP', colors));
    }
  }
  if (!layers.length && !cells.length && !features.length) {
    throw new Error('GDSII markdown contains no layers, cells, or features');
  }
  return finishDataset(name, sourceKind, name, 'UTF-8', '5.0', 'um', layers, cells, features, []);
}

function isGd01(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === GD01[0] && bytes[1] === GD01[1] && bytes[2] === GD01[2] && bytes[3] === GD01[3];
}

function isBinaryGdsHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x06 && bytes[2] === 0x00 && bytes[3] === 0x02;
}

export function buildSampleGdBytes(): Uint8Array {
  return te.encode(GD_ASCII_SAMPLE);
}

export function buildSampleGdJson(): string {
  return GD_JSON_SAMPLE;
}

export function parseGdText(text: string, fileName = ''): GdDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('GDSII dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeGdsii(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid GDSII JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'gds' || ext === 'gdsii' || looksLikeGdsii(raw)) return parseDumpGdsii(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsGd(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a GDSII dump');
}

export function parseGdBytes(bytes: Uint8Array, fileName = ''): GdDataset {
  if (!bytes.length) throw new Error('GDSII dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed GDSII files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (isGd01(bytes)) {
    const payload = td.decode(bytes.subarray(4));
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error('Invalid GD01 JSON payload');
    }
    return ingestJson(parsed, fileName, 'gdsii', ['Decoded GD01 layout dump']);
  }
  if (isBinaryGdsHeader(bytes) || ((ext === 'gds' || ext === 'gdsii') && !isMostlyText(bytes))) {
    throw new Error('Not an ASCII GDSII dump (binary stream is not expanded — export dump/JSON)');
  }
  return parseGdText(td.decode(bytes), fileName);
}

export function filterGdLayers(layers: GdLayer[], query: string): GdLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('stack:') || token.startsWith('name:')) {
        return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('func:') || token.startsWith('function:')) return l.function.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token === 'metal' || token === 'poly' || token === 'contact' || token === 'well') return l.function === token;
      if (token.startsWith('cell:') || token.startsWith('path:') || token.startsWith('plot:') || token.startsWith('type:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.function}`.toLowerCase().includes(token);
    })
  );
}

export function filterGdCells(cells: GdCell[], query: string): GdCell[] {
  const q = query.trim().toLowerCase();
  if (!q) return cells;
  const tokens = q.split(/\s+/).filter(Boolean);
  return cells.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('cell:') || token.startsWith('name:')) return c.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('layer:') || token.startsWith('path:') || token.startsWith('plot:') || token.startsWith('type:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return c.name.toLowerCase().includes(token);
    })
  );
}

export function filterGdFeatures(items: GdFeature[], query: string): GdFeature[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((f) =>
    tokens.every((token) => {
      if (token.startsWith('path:') || token.startsWith('boundary:') || token.startsWith('sref:') || token.startsWith('text:') || token.startsWith('feat:') || token.startsWith('feature:') || token.startsWith('plot:') || token.startsWith('name:')) {
        return `${f.name} ${f.text} ${f.type}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return f.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:') || token.startsWith('stack:')) return f.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('cell:')) return f.cell.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('row:') || token.startsWith('func:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${f.name} ${f.type} ${f.layer} ${f.cell} ${f.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterGdRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('layer:') ||
        token.startsWith('cell:') ||
        token.startsWith('plot:') ||
        token.startsWith('path:') ||
        token.startsWith('boundary:') ||
        token.startsWith('sref:') ||
        token.startsWith('feat:') ||
        token.startsWith('feature:')
      ) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('func:')) return true;
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
