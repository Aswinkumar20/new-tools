import type {
  PbColumn,
  PbDataset,
  PbLayer,
  PbLayerFunction,
  PbNet,
  PbNetClass,
  PbSourceKind,
  PbTrace,
  PbTraceType
} from '../types/pcb-layout-viewer.types';
import { PB_ASCII_SAMPLE, PB_JSON_SAMPLE } from '../constants/pcb-layout-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const PB01 = [0x50, 0x42, 0x30, 0x31];

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

function looksLikePcb(text: string): boolean {
  const t = text.trim();
  if (/\bPCB dump\b/i.test(t)) return true;
  if (/^\s*NET\s+\S+/m.test(t) && /^\s*(?:TRACK|VIA|PAD)\s+\S+/m.test(t)) return true;
  if (/^\s*LAYER\s+\S+\s+(?:copper|silk|mask|paste|outline)\b/im.test(t) && /^\s*(?:TRACK|VIA|PAD|ZONE)\s+/m.test(t)) return true;
  return false;
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function layerFunction(raw: unknown): PbLayerFunction {
  const v = asString(raw).toLowerCase();
  if (v === 'copper' || v === 'silk' || v === 'mask' || v === 'paste' || v === 'outline') return v;
  if (/silk|legend|overlay/.test(v)) return 'silk';
  if (/mask|solder/.test(v)) return 'mask';
  if (/paste|stencil/.test(v)) return 'paste';
  if (/outline|edge|profile/.test(v)) return 'outline';
  if (/copper|cond|signal|top|bottom|inner/.test(v)) return 'copper';
  return 'other';
}

function netClass(raw: unknown, name = ''): PbNetClass {
  const v = asString(raw, name).toLowerCase();
  if (v === 'power' || v === 'signal' || v === 'ground' || v === 'other') return v;
  if (/gnd|ground|agnd|dgnd/.test(v)) return 'ground';
  if (/vcc|vdd|power|3v3|5v|vin/.test(v)) return 'power';
  if (v) return 'signal';
  return 'other';
}

function traceType(raw: unknown, name: string): PbTraceType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'track' || v === 'via' || v === 'pad' || v === 'zone' || v === 'text' || v === 'other') return v;
  if (v === 'line' || v === 'trace') return 'track';
  if (v === 'flash' || v === 'circle') return 'via';
  if (v === 'polygon' || v === 'region') return 'zone';
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

function functionColor(fn: PbLayerFunction, fallback = 7): number {
  if (fn === 'copper') return 4;
  if (fn === 'silk') return 7;
  if (fn === 'mask') return 3;
  if (fn === 'paste') return 2;
  if (fn === 'outline') return 5;
  return fallback;
}

function makeLayer(
  name: string,
  fn: PbLayerFunction,
  stackIndex = 0,
  color = 0,
  visible = true,
  traceCount = 0,
  index = 0
): PbLayer {
  const c = color || functionColor(fn);
  return { id: name, index, name, function: fn, stackIndex, color: c, colorHex: aciToHex(c), visible, traceCount };
}

function makeNet(name: string, klass: PbNetClass, traceCount = 0, index = 0): PbNet {
  return { id: name, index, name, netClass: klass, traceCount };
}

function makeTrace(raw: CadDumpRec, index: number, fallbackLayer: string, layerColors: Map<string, string>): PbTrace {
  const name = asString(raw.name || raw.id, `tr${index + 1}`);
  const type = traceType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius);
  const layer = asString(raw.layer, fallbackLayer || 'TOP_COPPER');
  const net = asString(raw.net);
  const width = asNumber(raw.width, type === 'track' ? 0.15 : 0);
  const length =
    type === 'track'
      ? lineLength(x, y, x2, y2)
      : type === 'via' || type === 'pad'
        ? Number((2 * Math.PI * r).toFixed(3))
        : type === 'zone'
          ? polyLength(points)
          : asNumber(raw.length);
  return {
    id: name,
    index,
    name,
    type,
    layer,
    net,
    colorHex: asString(raw.colorHex) || layerColors.get(layer) || aciToHex(asNumber(raw.color, 7)),
    x,
    y,
    x2,
    y2,
    r,
    width,
    text: asString(raw.text || raw.label),
    length,
    points
  };
}

function finishDataset(
  name: string,
  sourceKind: PbSourceKind,
  title: string,
  encoding: string,
  boardVer: string,
  units: string,
  layers: PbLayer[],
  nets: PbNet[],
  traces: PbTrace[],
  warnings: string[]
): PbDataset {
  if (!layers.length && !nets.length && !traces.length) throw new Error('PCB dump contains no layers, nets, or traces');
  traces.forEach((t, i) => (t.index = i));
  layers.forEach((l, i) => {
    l.index = i;
    if (!l.traceCount) l.traceCount = traces.filter((t) => t.layer === l.name).length;
  });
  nets.forEach((n, i) => {
    n.index = i;
    if (!n.traceCount) n.traceCount = traces.filter((t) => t.net === n.name).length;
  });
  const columns: PbColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'layer', index: 2, name: 'layer', type: 'STRING' },
    { id: 'net', index: 3, name: 'net', type: 'STRING' },
    { id: 'x', index: 4, name: 'x', type: 'NUMBER' }
  ];
  const rows = traces.map((t) => ({
    name: t.name,
    type: t.type,
    layer: t.layer,
    net: t.net,
    x: String(t.x)
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    boardVer: boardVer || '—',
    units: units || 'mm',
    layerCount: layers.length,
    netCount: nets.length,
    traceCount: traces.length,
    layers,
    nets,
    traces,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: PbSourceKind = 'json', warnings: string[] = []): PbDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Board'));
  const layerSrc = (Array.isArray(root.layers) ? root.layers : Array.isArray(root.stack) ? root.stack : []) as unknown[];
  const netSrc = (Array.isArray(root.nets) ? root.nets : []) as unknown[];
  const traceSrc = (Array.isArray(root.traces) ? root.traces : Array.isArray(root.tracks) ? root.tracks : []) as unknown[];
  const layers: PbLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    return makeLayer(
      asString(n.name, `layer${index + 1}`),
      layerFunction(n.function || n.kind || n.name),
      asNumber(n.stackIndex ?? n.index, index),
      asNumber(n.color ?? n.aci),
      n.visible !== false,
      asNumber(n.traceCount ?? n.entityCount),
      index
    );
  });
  const nets: PbNet[] = netSrc.map((item, index) => {
    const n = rec(item);
    return makeNet(asString(n.name, `net${index + 1}`), netClass(n.netClass || n.class || n.name), asNumber(n.traceCount), index);
  });
  const colors = new Map(layers.map((l) => [l.name, l.colorHex] as const));
  const traces: PbTrace[] = traceSrc.map((item, index) => makeTrace(rec(item), index, layers[0]?.name || 'TOP_COPPER', colors));
  if (!layers.length) {
    const names = [...new Set(traces.map((t) => t.layer || 'TOP_COPPER'))];
    names.forEach((ln, i) => layers.push(makeLayer(ln, layerFunction(ln), i, 0, true, 0, i)));
  }
  if (!nets.length) {
    const names = [...new Set(traces.map((t) => t.net).filter(Boolean))];
    names.forEach((nn, i) => nets.push(makeNet(nn, netClass(nn), 0, i)));
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'pcb' ? 'ASCII' : 'UTF-8',
    asString(root.boardVer || root.version, 'v1'),
    asString(root.units, 'mm'),
    layers,
    nets,
    traces,
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

function parseAsciiPcb(text: string, fileName: string): PbDataset {
  const dumpMatch = /PCB dump\s+(\S+)(?:\s+(\S+))?/i.exec(text);
  const boardVer = dumpMatch?.[2] || 'v1';
  const name = prettyModelName(fileName, dumpMatch?.[1] || 'Board');
  const layers: PbLayer[] = [];
  const nets: PbNet[] = [];
  const traces: PbTrace[] = [];
  const colors = new Map<string, string>();

  const layerRe = /^\s*LAYER\s+(\S+)(?:\s+(\S+))?(?:\s+(\d+))?/gim;
  let layerMatch: RegExpExecArray | null;
  while ((layerMatch = layerRe.exec(text))) {
    const layerName = layerMatch[1];
    if (layers.some((l) => l.name === layerName)) continue;
    const fn = layerFunction(layerMatch[2] || layerName);
    const stackIndex = layerMatch[3] ? Number(layerMatch[3]) : layers.length;
    const layer = makeLayer(layerName, fn, stackIndex, 0, true, 0, layers.length);
    layers.push(layer);
    colors.set(layer.name, layer.colorHex);
  }

  const netRe = /^\s*NET\s+(\S+)(?:\s+(\S+))?/gim;
  let netMatch: RegExpExecArray | null;
  while ((netMatch = netRe.exec(text))) {
    const netName = netMatch[1];
    if (nets.some((n) => n.name === netName)) continue;
    nets.push(makeNet(netName, netClass(netMatch[2] || netName), 0, nets.length));
  }

  const itemRe = /^\s*(TRACK|VIA|PAD|ZONE|TEXT)\s+(\S+)\s+(\S+)(?:\s+(\S+))?(?:\s+(.+))?$/gim;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRe.exec(text))) {
    const kind = itemMatch[1].toUpperCase();
    const itemName = itemMatch[2];
    const third = itemMatch[3];
    const fourth = itemMatch[4] || '';
    const rest = (itemMatch[5] || '').trim();
    if (kind === 'TRACK') {
      const layerName = third;
      const netName = fourth;
      const nums = parseCoordList(rest);
      if (!layers.some((l) => l.name === layerName)) {
        const layer = makeLayer(layerName, layerFunction(layerName), layers.length, 0, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
      }
      if (netName && !nets.some((n) => n.name === netName)) nets.push(makeNet(netName, netClass(netName), 0, nets.length));
      traces.push(
        makeTrace(
          { name: itemName, type: 'track', layer: layerName, net: netName, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3], width: nums[4] },
          traces.length,
          layerName,
          colors
        )
      );
    } else if (kind === 'VIA') {
      const netName = third;
      const nums = parseCoordList([fourth, rest].filter(Boolean).join(' '));
      const layerName = layers.find((l) => l.function === 'copper')?.name || layers[0]?.name || 'TOP_COPPER';
      if (netName && !nets.some((n) => n.name === netName)) nets.push(makeNet(netName, netClass(netName), 0, nets.length));
      traces.push(
        makeTrace({ name: itemName, type: 'via', layer: layerName, net: netName, x: nums[0], y: nums[1], r: nums[2] }, traces.length, layerName, colors)
      );
    } else if (kind === 'PAD') {
      const netName = third;
      const layerName = fourth || 'TOP_COPPER';
      const nums = parseCoordList(rest);
      if (!layers.some((l) => l.name === layerName)) {
        const layer = makeLayer(layerName, layerFunction(layerName), layers.length, 0, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
      }
      if (netName && !nets.some((n) => n.name === netName)) nets.push(makeNet(netName, netClass(netName), 0, nets.length));
      traces.push(
        makeTrace({ name: itemName, type: 'pad', layer: layerName, net: netName, x: nums[0], y: nums[1], r: nums[2] }, traces.length, layerName, colors)
      );
    } else if (kind === 'ZONE') {
      const layerName = third;
      const netName = fourth;
      const pts = pairsFromCoords(parseCoordList(rest));
      if (!layers.some((l) => l.name === layerName)) {
        const layer = makeLayer(layerName, layerFunction(layerName), layers.length, 0, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
      }
      if (netName && !nets.some((n) => n.name === netName)) nets.push(makeNet(netName, netClass(netName), 0, nets.length));
      traces.push(makeTrace({ name: itemName, type: 'zone', layer: layerName, net: netName, points: pts }, traces.length, layerName, colors));
    } else if (kind === 'TEXT') {
      const layerName = third;
      const nums = parseCoordList([fourth, rest].filter(Boolean).join(' '));
      const label = [fourth, rest].filter(Boolean).join(' ').replace(/^[\d.\s,-]+/, '').trim() || itemName;
      if (!layers.some((l) => l.name === layerName)) {
        const layer = makeLayer(layerName, layerFunction(layerName), layers.length, 0, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
      }
      traces.push(makeTrace({ name: itemName, type: 'text', layer: layerName, x: nums[0], y: nums[1], text: label }, traces.length, layerName, colors));
    }
  }

  if (!layers.length && !nets.length && !traces.length) throw new Error('PCB contains no layers, nets, or traces');
  return finishDataset(name, 'pcb', name, 'ASCII', boardVer, 'mm', layers, nets, traces, []);
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

function parseCsvAsPb(text: string, fileName: string): PbDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('PCB CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: PbLayer[] = [];
  const nets: PbNet[] = [];
  const traces: PbTrace[] = [];
  const colors = new Map<string, string>();
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'layer' || type === 'stack') {
      const layer = makeLayer(
        row.name || row.layer || `layer${layers.length + 1}`,
        layerFunction(row.function || row.name || row.layer),
        layers.length,
        asNumber(row.color, 0),
        true,
        0,
        layers.length
      );
      layers.push(layer);
      colors.set(layer.name, layer.colorHex);
      return;
    }
    if (type === 'net') {
      nets.push(makeNet(row.name || row.net || `net${nets.length + 1}`, netClass(row.netClass || row.class || row.name || row.net), 0, nets.length));
      return;
    }
    traces.push(
      makeTrace(
        {
          name: row.name,
          type: row.type,
          layer: row.layer,
          net: row.net,
          x: row.x,
          y: row.y,
          x2: row.x2,
          y2: row.y2,
          r: row.r,
          width: row.width,
          text: row.text,
          color: row.color
        },
        index,
        row.layer || 'TOP_COPPER',
        colors
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Board');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'v1', 'mm', layers, nets, traces, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: PbSourceKind): PbDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Board')).trim();
  const keys: string[] = [];
  const layers: PbLayer[] = [];
  const nets: PbNet[] = [];
  const traces: PbTrace[] = [];
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
        const layer = makeLayer(row.name || row.layer || `layer${layers.length + 1}`, layerFunction(row.function || row.name || row.layer), layers.length, 0, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
        continue;
      }
      if (type === 'net') {
        nets.push(makeNet(row.name || row.net || `net${nets.length + 1}`, netClass(row.netClass || row.name || row.net), 0, nets.length));
        continue;
      }
      traces.push(
        makeTrace({ name: row.name, type: row.type, layer: row.layer, net: row.net, text: row.text }, traces.length, row.layer || 'TOP_COPPER', colors)
      );
    }
  }
  if (!layers.length && !nets.length && !traces.length) throw new Error('PCB markdown contains no layers, nets, or traces');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'v1', 'mm', layers, nets, traces, []);
}

function isPb01(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === PB01[0] && bytes[1] === PB01[1] && bytes[2] === PB01[2] && bytes[3] === PB01[3];
}

export function buildSamplePbBytes(): Uint8Array {
  return te.encode(PB_ASCII_SAMPLE);
}

export function buildSamplePbJson(): string {
  return PB_JSON_SAMPLE;
}

export function parsePbText(text: string, fileName = ''): PbDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('PCB dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikePcb(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid PCB JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'pcb' || looksLikePcb(raw)) return parseAsciiPcb(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsPb(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a PCB dump');
}

export function parsePbBytes(bytes: Uint8Array, fileName = ''): PbDataset {
  if (!bytes.length) throw new Error('PCB dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed PCB files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (isPb01(bytes)) {
    const payload = td.decode(bytes.subarray(4));
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error('Invalid PB01 JSON payload');
    }
    return ingestJson(parsed, fileName, 'pcb', ['Decoded PB01 board dump']);
  }
  if (ext === 'pcb' && !isMostlyText(bytes)) {
    throw new Error('Not an ASCII PCB dump (binary board files are not expanded — export JSON/CSV)');
  }
  return parsePbText(td.decode(bytes), fileName);
}

export function filterPbLayers(layers: PbLayer[], query: string): PbLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('stack:') || token.startsWith('name:')) {
        return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('func:') || token.startsWith('function:')) {
        return l.function.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token === 'copper' || token === 'silk' || token === 'mask' || token === 'paste' || token === 'outline') {
        return l.function === token;
      }
      if (token.startsWith('net:') || token.startsWith('track:') || token.startsWith('via:') || token.startsWith('pad:') || token.startsWith('type:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.function} ${l.stackIndex}`.toLowerCase().includes(token);
    })
  );
}

export function filterPbNets(nets: PbNet[], query: string): PbNet[] {
  const q = query.trim().toLowerCase();
  if (!q) return nets;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nets.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('net:') || token.startsWith('name:')) {
        return n.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('class:')) return n.netClass.toLowerCase().includes(token.slice(6));
      if (token === 'power' || token === 'ground' || token === 'signal') return n.netClass === token;
      if (token.startsWith('layer:') || token.startsWith('stack:') || token.startsWith('track:') || token.startsWith('via:') || token.startsWith('pad:') || token.startsWith('type:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${n.name} ${n.netClass}`.toLowerCase().includes(token);
    })
  );
}

export function filterPbTraces(traces: PbTrace[], query: string): PbTrace[] {
  const q = query.trim().toLowerCase();
  if (!q) return traces;
  const tokens = q.split(/\s+/).filter(Boolean);
  return traces.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('track:') || token.startsWith('via:') || token.startsWith('pad:') || token.startsWith('name:')) {
        return `${t.name} ${t.text} ${t.type}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return t.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:') || token.startsWith('stack:')) return t.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('net:')) return t.net.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('class:') || token.startsWith('row:') || token.startsWith('func:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${t.name} ${t.type} ${t.layer} ${t.net} ${t.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterPbRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('stack:') ||
        token.startsWith('net:') ||
        token.startsWith('track:') ||
        token.startsWith('via:') ||
        token.startsWith('pad:')
      ) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('class:') || token.startsWith('func:')) return true;
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
