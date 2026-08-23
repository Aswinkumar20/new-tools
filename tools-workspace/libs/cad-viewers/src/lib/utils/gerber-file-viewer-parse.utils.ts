import type {
  GbColumn,
  GbDataset,
  GbFeature,
  GbFeatureType,
  GbLayer,
  GbLayerFunction,
  GbSourceKind
} from '../types/gerber-file-viewer.types';
import { GB_ASCII_SAMPLE, GB_JSON_SAMPLE } from '../constants/gerber-file-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const GB01 = [0x47, 0x42, 0x30, 0x31];

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

function looksLikeGerber(text: string): boolean {
  const t = text.trim();
  if (/\bGerber dump\b/i.test(t)) return true;
  if (/^\s*(?:LINE|FLASH|POLYGON|TEXT)\s+\S+\s+\S+/m.test(t) && /^\s*LAYER\s+\S+/m.test(t)) return true;
  if (/%FS[LT][AI]/i.test(t) || /%ADD\d+/i.test(t)) return true;
  if (/^\s*G04\b/m.test(t) && (/%ADD/i.test(t) || /D0[123]/.test(t))) return true;
  if (/\bD0[123]\s*\*/.test(t) && /%LPD|%LPC|%MOMM|%MOIN/i.test(t)) return true;
  return false;
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function layerFunction(raw: unknown): GbLayerFunction {
  const v = asString(raw).toLowerCase();
  if (v === 'copper' || v === 'silk' || v === 'mask' || v === 'paste' || v === 'outline') return v;
  if (/silk|legend|overlay/.test(v)) return 'silk';
  if (/mask|solder/.test(v)) return 'mask';
  if (/paste|stencil/.test(v)) return 'paste';
  if (/outline|edge|profile/.test(v)) return 'outline';
  if (/copper|cond|signal|top|bottom|inner/.test(v)) return 'copper';
  return 'other';
}

function featureType(raw: unknown, name: string): GbFeatureType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'line' || v === 'arc' || v === 'flash' || v === 'polygon' || v === 'text' || v === 'circle' || v === 'other') return v;
  if (v === 'polyline' || v === 'region') return 'polygon';
  if (v === 'pad' || v === 'via') return 'flash';
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

function functionColor(fn: GbLayerFunction, fallback = 7): number {
  if (fn === 'copper') return 4;
  if (fn === 'silk') return 7;
  if (fn === 'mask') return 3;
  if (fn === 'paste') return 2;
  if (fn === 'outline') return 5;
  return fallback;
}

function makeLayer(name: string, fn: GbLayerFunction, color = 0, visible = true, featureCount = 0, index = 0): GbLayer {
  const c = color || functionColor(fn);
  return { id: name, index, name, function: fn, color: c, colorHex: aciToHex(c), visible, featureCount };
}

function makeFeature(raw: CadDumpRec, index: number, fallbackLayer: string, layerColors: Map<string, string>): GbFeature {
  const name = asString(raw.name || raw.id, `feat${index + 1}`);
  const type = featureType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius);
  const layer = asString(raw.layer, fallbackLayer || 'TOP_COPPER');
  const length =
    type === 'line'
      ? lineLength(x, y, x2, y2)
      : type === 'flash' || type === 'circle'
        ? Number((2 * Math.PI * r).toFixed(3))
        : type === 'polygon'
          ? polyLength(points)
          : asNumber(raw.length);
  return {
    id: name,
    index,
    name,
    type,
    layer,
    polarity: asString(raw.polarity, 'dark') || 'dark',
    colorHex: asString(raw.colorHex) || layerColors.get(layer) || aciToHex(asNumber(raw.color, 7)),
    x,
    y,
    x2,
    y2,
    r,
    text: asString(raw.text || raw.label),
    length,
    points
  };
}

function finishDataset(
  name: string,
  sourceKind: GbSourceKind,
  title: string,
  encoding: string,
  gerberVer: string,
  units: string,
  layers: GbLayer[],
  features: GbFeature[],
  warnings: string[]
): GbDataset {
  if (!layers.length && !features.length) throw new Error('Gerber dump contains no layers or features');
  features.forEach((f, i) => (f.index = i));
  layers.forEach((l) => {
    if (!l.featureCount) l.featureCount = features.filter((f) => f.layer === l.name).length;
  });
  const columns: GbColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'layer', index: 2, name: 'layer', type: 'STRING' },
    { id: 'x', index: 3, name: 'x', type: 'NUMBER' },
    { id: 'y', index: 4, name: 'y', type: 'NUMBER' }
  ];
  const rows = features.map((f) => ({
    name: f.name,
    type: f.type,
    layer: f.layer,
    x: String(f.x),
    y: String(f.y)
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    gerberVer: gerberVer || '—',
    units: units || 'mm',
    layerCount: layers.length,
    featureCount: features.length,
    layers,
    features,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: GbSourceKind = 'json', warnings: string[] = []): GbDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Artwork'));
  const layerSrc = (Array.isArray(root.layers) ? root.layers : []) as unknown[];
  const featSrc = (Array.isArray(root.features) ? root.features : Array.isArray(root.entities) ? root.entities : []) as unknown[];
  const layers: GbLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    return makeLayer(
      asString(n.name, `layer${index + 1}`),
      layerFunction(n.function || n.kind || n.name),
      asNumber(n.color ?? n.aci),
      n.visible !== false,
      asNumber(n.featureCount ?? n.entityCount),
      index
    );
  });
  const colors = new Map(layers.map((l) => [l.name, l.colorHex] as const));
  const features: GbFeature[] = featSrc.map((item, index) => makeFeature(rec(item), index, layers[0]?.name || 'TOP_COPPER', colors));
  if (!layers.length) {
    const names = [...new Set(features.map((f) => f.layer || 'TOP_COPPER'))];
    names.forEach((ln, i) => layers.push(makeLayer(ln, layerFunction(ln), 0, true, 0, i)));
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'gerber' ? 'ASCII' : 'UTF-8',
    asString(root.gerberVer || root.version, 'RS-274X'),
    asString(root.units, 'mm'),
    layers,
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

function ensureLayer(layers: GbLayer[], colors: Map<string, string>, name: string, fn?: GbLayerFunction, color?: number): GbLayer {
  let layer = layers.find((l) => l.name === name);
  if (!layer) {
    layer = makeLayer(name, fn || layerFunction(name), color || 0, true, 0, layers.length);
    layers.push(layer);
    colors.set(layer.name, layer.colorHex);
  }
  return layer;
}

function parseDumpGerber(
  text: string,
  fileName: string
): { layers: GbLayer[]; features: GbFeature[]; gerberVer: string; name: string } {
  const dumpMatch = /Gerber dump\s+(\S+)(?:\s+(\S+))?/i.exec(text);
  const gerberVer = dumpMatch?.[2] || (/RS-?274X/i.test(text) ? 'RS-274X' : 'Gerber');
  const name = prettyModelName(fileName, dumpMatch?.[1] || 'Artwork');
  const layers: GbLayer[] = [];
  const features: GbFeature[] = [];
  const colors = new Map<string, string>();

  const layerRe = /^\s*LAYER\s+(\S+)(?:\s+(\S+))?(?:\s+(\d+))?/gim;
  let layerMatch: RegExpExecArray | null;
  while ((layerMatch = layerRe.exec(text))) {
    ensureLayer(layers, colors, layerMatch[1], layerFunction(layerMatch[2] || layerMatch[1]), layerMatch[3] ? Number(layerMatch[3]) : 0);
  }

  const featRe = /^\s*(LINE|FLASH|POLYGON|TEXT|ARC|CIRCLE)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/gim;
  let featMatch: RegExpExecArray | null;
  while ((featMatch = featRe.exec(text))) {
    const kind = featMatch[1].toLowerCase();
    const featName = featMatch[2];
    const layerName = featMatch[3];
    const rest = (featMatch[4] || '').trim();
    ensureLayer(layers, colors, layerName, layerFunction(layerName));
    if (kind === 'line') {
      const nums = parseCoordList(rest);
      features.push(
        makeFeature({ name: featName, type: 'line', layer: layerName, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3] }, features.length, layerName, colors)
      );
    } else if (kind === 'flash' || kind === 'circle') {
      const nums = parseCoordList(rest);
      features.push(
        makeFeature({ name: featName, type: kind === 'circle' ? 'circle' : 'flash', layer: layerName, x: nums[0], y: nums[1], r: nums[2] }, features.length, layerName, colors)
      );
    } else if (kind === 'arc') {
      const nums = parseCoordList(rest);
      features.push(
        makeFeature(
          { name: featName, type: 'arc', layer: layerName, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3], r: nums[4] },
          features.length,
          layerName,
          colors
        )
      );
    } else if (kind === 'polygon') {
      const pts = pairsFromCoords(parseCoordList(rest));
      features.push(makeFeature({ name: featName, type: 'polygon', layer: layerName, points: pts }, features.length, layerName, colors));
    } else if (kind === 'text') {
      const nums = parseCoordList(rest);
      const label = rest.replace(/^[\d.\s,-]+/, '').trim() || featName;
      features.push(
        makeFeature({ name: featName, type: 'text', layer: layerName, x: nums[0], y: nums[1], text: label }, features.length, layerName, colors)
      );
    }
  }

  return { layers, features, gerberVer, name };
}

function parseCoordToken(raw: string | undefined, prev: number, decimals: number): number {
  if (raw == null || raw === '') return prev;
  const n = Number(raw);
  if (!Number.isFinite(n)) return prev;
  if (raw.includes('.')) return n;
  if (decimals > 0) return n / 10 ** decimals;
  return Math.abs(n) >= 100 ? n / 1000 : n;
}

function parseRs274x(text: string, fileName: string, seed?: ReturnType<typeof parseDumpGerber>): GbDataset {
  const dump = seed || { layers: [] as GbLayer[], features: [] as GbFeature[], gerberVer: 'RS-274X', name: prettyModelName(fileName, 'Artwork') };
  const layers = dump.layers;
  const features = dump.features;
  const colors = new Map(layers.map((l) => [l.name, l.colorHex] as const));
  const units = /%MOIN/i.test(text) ? 'in' : 'mm';
  let xDec = 0;
  let yDec = 0;
  const fs = /%FS[LT][AI]X(\d)(\d)Y(\d)(\d)\*%/i.exec(text);
  if (fs) {
    xDec = Number(fs[2]);
    yDec = Number(fs[4]);
  }
  let layerName = 'TOP_COPPER';
  let layerFn: GbLayerFunction = 'copper';
  const tf = /%TF\.FileFunction,([^,*]+)/i.exec(text);
  if (tf) {
    layerFn = layerFunction(tf[1]);
    const up = tf[1].toUpperCase();
    if (layerFn === 'silk') layerName = up.includes('BOT') ? 'BOTTOM_SILK' : 'TOP_SILK';
    else if (layerFn === 'mask') layerName = up.includes('BOT') ? 'BOTTOM_MASK' : 'TOP_MASK';
    else if (layerFn === 'outline') layerName = 'OUTLINE';
    else layerName = up.includes('BOT') ? 'BOTTOM_COPPER' : 'TOP_COPPER';
  }
  ensureLayer(layers, colors, layerName, layerFn);

  const apertures = new Map<number, number>();
  const addRe = /%ADD(\d+)([CRO]),([0-9.]+)/gi;
  let addMatch: RegExpExecArray | null;
  while ((addMatch = addRe.exec(text))) {
    const dCode = Number(addMatch[1]);
    const diameter = Number(addMatch[3]);
    apertures.set(dCode, Number.isFinite(diameter) ? diameter / 2 : 0.1);
  }

  let cx = 0;
  let cy = 0;
  let currentD = 10;
  const blocks = text
    .replace(/\r/g, '')
    .split('*')
    .map((b) => b.replace(/\n/g, '').trim())
    .filter(Boolean);
  for (const block of blocks) {
    if (block.startsWith('%') || /^G04/i.test(block) || /^M02/i.test(block)) continue;
    const dOnly = /^D(\d+)$/i.exec(block);
    if (dOnly && Number(dOnly[1]) >= 10) {
      currentD = Number(dOnly[1]);
      continue;
    }
    const draw = /^(?:X(-?\d+(?:\.\d+)?))?(?:Y(-?\d+(?:\.\d+)?))?(?:D0([123]))?$/i.exec(block.replace(/\s+/g, ''));
    if (!draw) continue;
    const nx = parseCoordToken(draw[1], cx, xDec);
    const ny = parseCoordToken(draw[2], cy, yDec);
    const op = draw[3] || '';
    if (op === '2' || op === '') {
      cx = nx;
      cy = ny;
      continue;
    }
    if (op === '1') {
      features.push(
        makeFeature({ name: `draw${features.length + 1}`, type: 'line', layer: layerName, x: cx, y: cy, x2: nx, y2: ny }, features.length, layerName, colors)
      );
      cx = nx;
      cy = ny;
      continue;
    }
    if (op === '3') {
      const r = apertures.get(currentD) || 0.15;
      features.push(makeFeature({ name: `flash${features.length + 1}`, type: 'flash', layer: layerName, x: nx, y: ny, r }, features.length, layerName, colors));
      cx = nx;
      cy = ny;
    }
  }

  if (!layers.length && !features.length) throw new Error('Gerber contains no layers or features');
  if (!layers.length) {
    const names = [...new Set(features.map((f) => f.layer || 'TOP_COPPER'))];
    names.forEach((ln, idx) => layers.push(makeLayer(ln, layerFunction(ln), 0, true, 0, idx)));
  }
  const name = dump.name || prettyModelName(fileName, 'Artwork');
  const gerberVer = dump.gerberVer || 'RS-274X';
  return finishDataset(name, 'gerber', name, 'ASCII', gerberVer, units, layers, features, []);
}

function parseAsciiGerber(text: string, fileName: string): GbDataset {
  const dump = parseDumpGerber(text, fileName);
  const hasRs = /%ADD\d+/i.test(text) || /\bD0[123]\s*\*/.test(text) || /%FS[LT][AI]/i.test(text);
  if (hasRs) return parseRs274x(text, fileName, dump);
  if (!dump.layers.length && !dump.features.length) {
    if (/%MOMM|%MOIN|G04/i.test(text)) return parseRs274x(text, fileName);
    throw new Error('Gerber contains no layers or features');
  }
  return finishDataset(dump.name, 'gerber', dump.name, 'ASCII', dump.gerberVer, 'mm', dump.layers, dump.features, []);
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

function parseCsvAsGb(text: string, fileName: string): GbDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Gerber CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: GbLayer[] = [];
  const features: GbFeature[] = [];
  const colors = new Map<string, string>();
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'layer') {
      const layer = makeLayer(row.name || row.layer || `layer${layers.length + 1}`, layerFunction(row.function || row.name || row.layer), asNumber(row.color, 0), true, 0, layers.length);
      layers.push(layer);
      colors.set(layer.name, layer.colorHex);
      return;
    }
    features.push(
      makeFeature(
        {
          name: row.name,
          type: row.type,
          layer: row.layer,
          x: row.x,
          y: row.y,
          x2: row.x2,
          y2: row.y2,
          r: row.r,
          text: row.text,
          color: row.color
        },
        index,
        row.layer || 'TOP_COPPER',
        colors
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Artwork');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'RS-274X', 'mm', layers, features, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: GbSourceKind): GbDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Artwork')).trim();
  const keys: string[] = [];
  const layers: GbLayer[] = [];
  const features: GbFeature[] = [];
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
      if (type === 'layer') {
        const layer = makeLayer(row.name || row.layer || `layer${layers.length + 1}`, layerFunction(row.function || row.name || row.layer), 0, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
        continue;
      }
      features.push(makeFeature({ name: row.name, type: row.type, layer: row.layer, text: row.text }, features.length, row.layer || 'TOP_COPPER', colors));
    }
  }
  if (!layers.length && !features.length) throw new Error('Gerber markdown contains no layers or features');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'RS-274X', 'mm', layers, features, []);
}

function isGb01(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === GB01[0] && bytes[1] === GB01[1] && bytes[2] === GB01[2] && bytes[3] === GB01[3];
}

export function buildSampleGbBytes(): Uint8Array {
  return te.encode(GB_ASCII_SAMPLE);
}

export function buildSampleGbJson(): string {
  return GB_JSON_SAMPLE;
}

export function parseGbText(text: string, fileName = ''): GbDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Gerber dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeGerber(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Gerber JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'gbr' || ext === 'ger' || looksLikeGerber(raw)) return parseAsciiGerber(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsGb(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a Gerber dump');
}

export function parseGbBytes(bytes: Uint8Array, fileName = ''): GbDataset {
  if (!bytes.length) throw new Error('Gerber dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Gerber files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (isGb01(bytes)) {
    const payload = td.decode(bytes.subarray(4));
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error('Invalid GB01 JSON payload');
    }
    return ingestJson(parsed, fileName, 'gerber', ['Decoded GB01 artwork dump']);
  }
  if ((ext === 'gbr' || ext === 'ger') && !isMostlyText(bytes)) {
    throw new Error('Not an ASCII Gerber file (binary Gerber is not expanded — export RS-274X/JSON)');
  }
  return parseGbText(td.decode(bytes), fileName);
}

export function filterGbLayers(layers: GbLayer[], query: string): GbLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:')) {
        return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('func:') || token.startsWith('function:')) {
        return l.function.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token === 'copper' || token === 'silk' || token === 'mask' || token === 'paste' || token === 'outline') {
        return l.function === token;
      }
      if (token.startsWith('color:')) return `${l.color} ${l.colorHex}`.toLowerCase().includes(token.slice(6));
      if (
        token.startsWith('type:') ||
        token.startsWith('feat:') ||
        token.startsWith('feature:') ||
        token.startsWith('flash:') ||
        token.startsWith('row:')
      ) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.function} ${l.colorHex}`.toLowerCase().includes(token);
    })
  );
}

export function filterGbFeatures(features: GbFeature[], query: string): GbFeature[] {
  const q = query.trim().toLowerCase();
  if (!q) return features;
  const tokens = q.split(/\s+/).filter(Boolean);
  return features.filter((f) =>
    tokens.every((token) => {
      if (token.startsWith('feat:') || token.startsWith('feature:') || token.startsWith('name:') || token.startsWith('flash:')) {
        return `${f.name} ${f.text} ${f.type}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return f.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:')) return f.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('func:') || token.startsWith('function:') || token === 'copper' || token === 'silk' || token === 'mask') return true;
      if (token.startsWith('color:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${f.name} ${f.type} ${f.layer} ${f.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterGbRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('feat:') ||
        token.startsWith('feature:') ||
        token.startsWith('flash:')
      ) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('color:') || token.startsWith('func:') || token.startsWith('function:')) return true;
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
