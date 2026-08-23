import type {
  AlColumn,
  AlCopper,
  AlCopperType,
  AlDataset,
  AlDesignator,
  AlDesType,
  AlLayer,
  AlLayerFunction,
  AlNet,
  AlNetClass,
  AlSourceKind
} from '../types/altium-pcb-viewer.types';
import { AL_ASCII_SAMPLE, AL_JSON_SAMPLE } from '../constants/altium-pcb-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const AT01 = [0x41, 0x54, 0x30, 0x31];

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

function looksLikeAltium(text: string): boolean {
  const t = text.trim();
  if (/\bAltium dump\b/i.test(t)) return true;
  if (/^\s*CopperLayer\s+\S+/im.test(t) && /^\s*Track\s+\S+/im.test(t)) return true;
  if (/^\s*DESIGNATOR\s+\S+/m.test(t) && /^\s*(?:TRACK|VIA|PAD)\s+\S+/m.test(t)) return true;
  if (/^\s*LAYER\s+\S+/m.test(t) && /\bTopLayer\b|\bBottomLayer\b|\bTopOverlay\b/.test(t) && /^\s*(?:TRACK|VIA|PAD)\s+/m.test(t)) {
    return true;
  }
  return false;
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function layerFunction(raw: unknown): AlLayerFunction {
  const v = asString(raw).toLowerCase();
  if (v === 'copper' || v === 'silk' || v === 'mask' || v === 'paste' || v === 'outline') return v;
  if (/silk|overlay|legend|silks/.test(v)) return 'silk';
  if (/mask|solder|stop/.test(v)) return 'mask';
  if (/paste|stencil/.test(v)) return 'paste';
  if (/outline|edge|keepout|mechanical/.test(v)) return 'outline';
  if (/copper|toplayer|bottomlayer|midlayer|signal/.test(v)) return 'copper';
  return 'other';
}

function netClass(raw: unknown, name = ''): AlNetClass {
  const v = asString(raw, name).toLowerCase();
  if (v === 'power' || v === 'signal' || v === 'ground' || v === 'other') return v;
  if (/gnd|ground|agnd|dgnd/.test(v)) return 'ground';
  if (/vcc|vdd|power|3v3|5v|vin/.test(v)) return 'power';
  if (v) return 'signal';
  return 'other';
}

function copperType(raw: unknown, name: string): AlCopperType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'track' || v === 'via' || v === 'pad' || v === 'zone' || v === 'other') return v;
  if (v === 'line' || v === 'trace' || v === 'arc' || v === 'segment') return 'track';
  if (v === 'polygon' || v === 'region' || v === 'pour') return 'zone';
  return 'other';
}

function desType(raw: unknown, name: string): AlDesType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'designator' || v === 'text' || v === 'component' || v === 'other') return v;
  if (v === 'des' || v === 'refdes' || v === 'comment') return 'designator';
  if (v === 'comp' || v === 'part' || v === 'footprint') return 'component';
  if (v === 'string' || v === 'label') return 'text';
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

function functionColor(fn: AlLayerFunction, fallback = 7): number {
  if (fn === 'copper') return 4;
  if (fn === 'silk') return 7;
  if (fn === 'mask') return 3;
  if (fn === 'paste') return 2;
  if (fn === 'outline') return 5;
  return fallback;
}

function makeLayer(name: string, fn: AlLayerFunction, stackIndex = 0, color = 0, visible = true, itemCount = 0, index = 0): AlLayer {
  const c = color || functionColor(fn);
  return { id: name, index, name, function: fn, stackIndex, color: c, colorHex: aciToHex(c), visible, itemCount };
}

function makeNet(name: string, klass: AlNetClass, itemCount = 0, index = 0): AlNet {
  return { id: name, index, name, netClass: klass, itemCount };
}

function makeCopper(raw: CadDumpRec, index: number, fallbackLayer: string, colors: Map<string, string>): AlCopper {
  const name = asString(raw.name || raw.id, `cu${index + 1}`);
  const type = copperType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius);
  const layer = asString(raw.layer, fallbackLayer || 'TopLayer');
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
    colorHex: asString(raw.colorHex) || colors.get(layer) || aciToHex(asNumber(raw.color, 7)),
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

function makeDes(raw: CadDumpRec, index: number, fallbackLayer: string, colors: Map<string, string>): AlDesignator {
  const name = asString(raw.name || raw.id, `des${index + 1}`);
  const type = desType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const layer = asString(raw.layer, fallbackLayer || 'TopOverlay');
  return {
    id: `${name}-${type}-${index}`,
    index,
    name,
    type,
    layer,
    net: asString(raw.net),
    colorHex: asString(raw.colorHex) || colors.get(layer) || (type === 'designator' ? '#fbbf24' : '#e2e8f0'),
    x,
    y,
    x2: asNumber(raw.x2),
    y2: asNumber(raw.y2),
    r: asNumber(raw.r ?? raw.radius),
    text: asString(raw.text || raw.label || name),
    length: asNumber(raw.length),
    points
  };
}

function finishDataset(
  name: string,
  sourceKind: AlSourceKind,
  title: string,
  encoding: string,
  altiumVer: string,
  units: string,
  layers: AlLayer[],
  nets: AlNet[],
  coppers: AlCopper[],
  designators: AlDesignator[],
  warnings: string[]
): AlDataset {
  if (!layers.length && !nets.length && !coppers.length && !designators.length) {
    throw new Error('Altium dump contains no copper, designators, layers, or nets');
  }
  coppers.forEach((c, i) => (c.index = i));
  designators.forEach((d, i) => (d.index = i));
  layers.forEach((l, i) => {
    l.index = i;
    if (!l.itemCount) {
      l.itemCount =
        coppers.filter((c) => c.layer === l.name).length + designators.filter((d) => d.layer === l.name).length;
    }
  });
  nets.forEach((n, i) => {
    n.index = i;
    if (!n.itemCount) {
      n.itemCount =
        coppers.filter((c) => c.net === n.name).length + designators.filter((d) => d.net === n.name).length;
    }
  });
  const columns: AlColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'layer', index: 2, name: 'layer', type: 'STRING' },
    { id: 'net', index: 3, name: 'net', type: 'STRING' },
    { id: 'x', index: 4, name: 'x', type: 'NUMBER' }
  ];
  const rows = [
    ...coppers.map((c) => ({ name: c.name, type: c.type, layer: c.layer, net: c.net, x: String(c.x) })),
    ...designators.map((d) => ({ name: d.name, type: d.type, layer: d.layer || 'designator', net: d.net, x: String(d.x) }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    altiumVer: altiumVer || '—',
    units: units || 'mm',
    layerCount: layers.length,
    netCount: nets.length,
    copperCount: coppers.length,
    desCount: designators.length,
    layers,
    nets,
    coppers,
    designators,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: AlSourceKind = 'json', warnings: string[] = []): AlDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Project'));
  const layerSrc = (Array.isArray(root.layers) ? root.layers : Array.isArray(root.stack) ? root.stack : []) as unknown[];
  const netSrc = (Array.isArray(root.nets) ? root.nets : []) as unknown[];
  const copperSrc = (Array.isArray(root.coppers) ? root.coppers : Array.isArray(root.tracks) ? root.tracks : []) as unknown[];
  const desSrc = (Array.isArray(root.designators) ? root.designators : Array.isArray(root.des) ? root.des : []) as unknown[];
  const layers: AlLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    return makeLayer(
      asString(n.name, `layer${index + 1}`),
      layerFunction(n.function || n.kind || n.name),
      asNumber(n.stackIndex ?? n.index, index),
      asNumber(n.color ?? n.aci),
      n.visible !== false,
      asNumber(n.itemCount),
      index
    );
  });
  const nets: AlNet[] = netSrc.map((item, index) => {
    const n = rec(item);
    return makeNet(asString(n.name, `net${index + 1}`), netClass(n.netClass || n.class || n.name), asNumber(n.itemCount), index);
  });
  const colors = new Map(layers.map((l) => [l.name, l.colorHex] as const));
  const coppers = copperSrc.map((item, index) => makeCopper(rec(item), index, layers[0]?.name || 'TopLayer', colors));
  const designators = desSrc.map((item, index) => makeDes(rec(item), index, layers.find((l) => l.function === 'silk')?.name || 'TopOverlay', colors));
  if (!layers.length) {
    const names = [...new Set([...coppers.map((c) => c.layer || 'TopLayer'), ...designators.map((d) => d.layer || 'TopOverlay')])];
    names.forEach((ln, i) => layers.push(makeLayer(ln, layerFunction(ln), i, 0, true, 0, i)));
  }
  if (!nets.length) {
    const names = [...new Set([...coppers.map((c) => c.net), ...designators.map((d) => d.net)].filter(Boolean))];
    names.forEach((nn, i) => nets.push(makeNet(nn, netClass(nn), 0, i)));
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'altium' ? 'ASCII' : 'UTF-8',
    asString(root.altiumVer || root.version, '24.0'),
    asString(root.units, 'mm'),
    layers,
    nets,
    coppers,
    designators,
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

function ensureLayer(layers: AlLayer[], colors: Map<string, string>, name: string, fn?: AlLayerFunction, stackIndex?: number): AlLayer {
  let layer = layers.find((l) => l.name === name);
  if (!layer) {
    layer = makeLayer(name, fn || layerFunction(name), stackIndex ?? layers.length, 0, true, 0, layers.length);
    layers.push(layer);
    colors.set(layer.name, layer.colorHex);
  }
  return layer;
}

function ensureNet(nets: AlNet[], name: string, klass?: AlNetClass): AlNet {
  let net = nets.find((n) => n.name === name);
  if (!net && name) {
    net = makeNet(name, klass || netClass(name), 0, nets.length);
    nets.push(net);
  }
  return net || makeNet(name || 'NC', 'other');
}

function parseDumpAltium(text: string, fileName: string): AlDataset {
  const dumpMatch = /Altium dump\s+(\S+)(?:\s+(\S+))?/i.exec(text);
  const altiumVer = dumpMatch?.[2] || (/Altium dump \S+ ([\d.]+)/i.exec(text)?.[1] ?? '24.0');
  const name = prettyModelName(fileName, dumpMatch?.[1] || 'Project');
  const layers: AlLayer[] = [];
  const nets: AlNet[] = [];
  const coppers: AlCopper[] = [];
  const designators: AlDesignator[] = [];
  const colors = new Map<string, string>();

  const layerRe = /^\s*LAYER\s+(\S+)(?:\s+(\S+))?(?:\s+(\d+))?/gim;
  let layerMatch: RegExpExecArray | null;
  while ((layerMatch = layerRe.exec(text))) {
    ensureLayer(layers, colors, layerMatch[1], layerFunction(layerMatch[2] || layerMatch[1]), layerMatch[3] ? Number(layerMatch[3]) : layers.length);
  }

  const netRe = /^\s*NET\s+(\S+)(?:\s+(\S+))?/gim;
  let netMatch: RegExpExecArray | null;
  while ((netMatch = netRe.exec(text))) {
    ensureNet(nets, netMatch[1], netClass(netMatch[2] || netMatch[1]));
  }

  const copperRe = /^\s*(TRACK|VIA|PAD|ZONE)\s+(\S+)\s+(\S+)(?:\s+(\S+))?(?:\s+(.+))?$/gim;
  let copperMatch: RegExpExecArray | null;
  while ((copperMatch = copperRe.exec(text))) {
    const kind = copperMatch[1].toUpperCase();
    const itemName = copperMatch[2];
    const third = copperMatch[3];
    const fourth = copperMatch[4] || '';
    const rest = (copperMatch[5] || '').trim();
    if (kind === 'TRACK') {
      ensureLayer(layers, colors, third, layerFunction(third));
      if (fourth) ensureNet(nets, fourth);
      const nums = parseCoordList(rest);
      coppers.push(makeCopper({ name: itemName, type: 'track', layer: third, net: fourth, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3], width: nums[4] }, coppers.length, third, colors));
    } else if (kind === 'VIA') {
      if (third) ensureNet(nets, third);
      const nums = parseCoordList([fourth, rest].filter(Boolean).join(' '));
      const layerName = layers.find((l) => l.function === 'copper')?.name || 'TopLayer';
      coppers.push(makeCopper({ name: itemName, type: 'via', layer: layerName, net: third, x: nums[0], y: nums[1], r: nums[2] }, coppers.length, layerName, colors));
    } else if (kind === 'PAD') {
      if (third) ensureNet(nets, third);
      const layerName = fourth || 'TopLayer';
      ensureLayer(layers, colors, layerName, layerFunction(layerName));
      const nums = parseCoordList(rest);
      coppers.push(makeCopper({ name: itemName, type: 'pad', layer: layerName, net: third, x: nums[0], y: nums[1], r: nums[2] }, coppers.length, layerName, colors));
    } else if (kind === 'ZONE') {
      ensureLayer(layers, colors, third, layerFunction(third));
      if (fourth) ensureNet(nets, fourth);
      const pts = pairsFromCoords(parseCoordList(rest));
      coppers.push(makeCopper({ name: itemName, type: 'zone', layer: third, net: fourth, points: pts }, coppers.length, third, colors));
    }
  }

  const desRe = /^\s*(DESIGNATOR|TEXT|COMPONENT)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/gim;
  let desMatch: RegExpExecArray | null;
  while ((desMatch = desRe.exec(text))) {
    const kind = desMatch[1].toUpperCase();
    const itemName = desMatch[2];
    const third = desMatch[3];
    const rest = (desMatch[4] || '').trim();
    if (kind === 'COMPONENT') {
      if (third) ensureNet(nets, third);
      const nums = parseCoordList(rest);
      designators.push(makeDes({ name: itemName, type: 'component', net: third, x: nums[0], y: nums[1], text: itemName }, designators.length, 'TopOverlay', colors));
    } else {
      ensureLayer(layers, colors, third, layerFunction(third));
      const nums = parseCoordList(rest);
      const label = rest.replace(/^[\d.\s,-]+/, '').trim() || itemName;
      const type = kind === 'DESIGNATOR' ? 'designator' : 'text';
      designators.push(makeDes({ name: itemName, type, layer: third, x: nums[0], y: nums[1], text: label }, designators.length, third, colors));
    }
  }

  return finishDataset(name, 'altium', name, 'ASCII', altiumVer, 'mm', layers, nets, coppers, designators, []);
}

function parseCopperAscii(text: string, fileName: string): AlDataset {
  const name = prettyModelName(fileName, 'Project');
  const layers: AlLayer[] = [];
  const nets: AlNet[] = [];
  const coppers: AlCopper[] = [];
  const designators: AlDesignator[] = [];
  const colors = new Map<string, string>();
  let currentLayer = 'TopLayer';

  for (const line of text.split(/\r?\n/)) {
    const copperLayer = /^\s*CopperLayer\s+(\S+)/i.exec(line);
    if (copperLayer) {
      currentLayer = copperLayer[1];
      ensureLayer(layers, colors, currentLayer, layerFunction(currentLayer));
      continue;
    }
    const track = /^\s*Track\s+(\S+)\s+(\S+)\s+(.+)$/i.exec(line);
    if (track) {
      ensureNet(nets, track[2]);
      const nums = parseCoordList(track[3]);
      coppers.push(makeCopper({ name: track[1], type: 'track', layer: currentLayer, net: track[2], x: nums[0], y: nums[1], x2: nums[2], y2: nums[3], width: nums[4] }, coppers.length, currentLayer, colors));
      continue;
    }
    const via = /^\s*Via\s+(\S+)\s+(\S+)\s+(.+)$/i.exec(line);
    if (via) {
      ensureNet(nets, via[2]);
      const nums = parseCoordList(via[3]);
      coppers.push(makeCopper({ name: via[1], type: 'via', layer: currentLayer, net: via[2], x: nums[0], y: nums[1], r: nums[2] }, coppers.length, currentLayer, colors));
      continue;
    }
    const des = /^\s*Designator\s+(\S+)\s+(.+)$/i.exec(line);
    if (des) {
      const nums = parseCoordList(des[2]);
      const label = des[2].replace(/^[\d.\s,-]+/, '').trim() || des[1];
      designators.push(makeDes({ name: des[1], type: 'designator', layer: currentLayer, x: nums[0], y: nums[1], text: label }, designators.length, currentLayer, colors));
      continue;
    }
    const txt = /^\s*Text\s+(\S+)\s+(.+)$/i.exec(line);
    if (txt) {
      const nums = parseCoordList(txt[2]);
      const label = txt[2].replace(/^[\d.\s,-]+/, '').trim() || txt[1];
      designators.push(makeDes({ name: txt[1], type: 'text', layer: currentLayer, x: nums[0], y: nums[1], text: label }, designators.length, currentLayer, colors));
    }
  }

  return finishDataset(name, 'altium', name, 'ASCII', '24.0', 'mm', layers, nets, coppers, designators, []);
}

function parseAsciiAltium(text: string, fileName: string): AlDataset {
  if (/^\s*CopperLayer\s+\S+/im.test(text) && !/\bAltium dump\b/i.test(text)) return parseCopperAscii(text, fileName);
  return parseDumpAltium(text, fileName);
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

function parseCsvAsAl(text: string, fileName: string): AlDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Altium CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: AlLayer[] = [];
  const nets: AlNet[] = [];
  const coppers: AlCopper[] = [];
  const designators: AlDesignator[] = [];
  const colors = new Map<string, string>();
  lines.slice(1).forEach((line) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    const domain = (row.domain || '').toLowerCase();
    if (type === 'layer' || type === 'stack') {
      const layer = makeLayer(row.name || row.layer || `layer${layers.length + 1}`, layerFunction(row.function || row.name || row.layer), layers.length, 0, true, 0, layers.length);
      layers.push(layer);
      colors.set(layer.name, layer.colorHex);
      return;
    }
    if (type === 'net') {
      nets.push(makeNet(row.name || row.net || `net${nets.length + 1}`, netClass(row.netClass || row.name || row.net), 0, nets.length));
      return;
    }
    if (domain === 'designator' || type === 'designator' || type === 'component' || (type === 'text' && domain !== 'copper')) {
      designators.push(makeDes({ name: row.name, type: row.type, layer: row.layer, net: row.net, x: row.x, y: row.y, text: row.text }, designators.length, row.layer || 'TopOverlay', colors));
      return;
    }
    coppers.push(
      makeCopper(
        { name: row.name, type: row.type, layer: row.layer, net: row.net, x: row.x, y: row.y, x2: row.x2, y2: row.y2, r: row.r, text: row.text },
        coppers.length,
        row.layer || 'TopLayer',
        colors
      )
    );
  });
  return finishDataset(prettyModelName(fileName, 'Project'), 'csv', prettyModelName(fileName, 'Project'), 'UTF-8', '24.0', 'mm', layers, nets, coppers, designators, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: AlSourceKind): AlDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Project')).trim();
  const keys: string[] = [];
  const layers: AlLayer[] = [];
  const nets: AlNet[] = [];
  const coppers: AlCopper[] = [];
  const designators: AlDesignator[] = [];
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
      const domain = (row.domain || '').toLowerCase();
      if (type === 'layer' || type === 'stack') {
        const layer = makeLayer(row.name || row.layer || `layer${layers.length + 1}`, layerFunction(row.function || row.name || row.layer), layers.length, 0, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
        continue;
      }
      if (type === 'net') {
        nets.push(makeNet(row.name || row.net || `net${nets.length + 1}`, netClass(row.name || row.net), 0, nets.length));
        continue;
      }
      if (domain === 'designator' || type === 'designator' || type === 'component' || (type === 'text' && domain !== 'copper')) {
        designators.push(makeDes({ name: row.name, type: row.type, layer: row.layer, net: row.net, text: row.text }, designators.length, row.layer || 'TopOverlay', colors));
        continue;
      }
      coppers.push(makeCopper({ name: row.name, type: row.type, layer: row.layer, net: row.net, text: row.text }, coppers.length, row.layer || 'TopLayer', colors));
    }
  }
  if (!layers.length && !nets.length && !coppers.length && !designators.length) {
    throw new Error('Altium markdown contains no copper or designators');
  }
  return finishDataset(name, sourceKind, name, 'UTF-8', '24.0', 'mm', layers, nets, coppers, designators, []);
}

function isAt01(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === AT01[0] && bytes[1] === AT01[1] && bytes[2] === AT01[2] && bytes[3] === AT01[3];
}

function isOleMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

export function buildSampleAlBytes(): Uint8Array {
  return te.encode(AL_ASCII_SAMPLE);
}

export function buildSampleAlJson(): string {
  return AL_JSON_SAMPLE;
}

export function parseAlText(text: string, fileName = ''): AlDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Altium dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeAltium(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Altium JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'pcbdoc' || ext === 'schdoc' || ext === 'prjpcb' || looksLikeAltium(raw)) return parseAsciiAltium(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsAl(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an Altium dump');
}

export function parseAlBytes(bytes: Uint8Array, fileName = ''): AlDataset {
  if (!bytes.length) throw new Error('Altium dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Altium files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (isAt01(bytes)) {
    const payload = td.decode(bytes.subarray(4));
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error('Invalid AT01 JSON payload');
    }
    return ingestJson(parsed, fileName, 'altium', ['Decoded AT01 project dump']);
  }
  if (isOleMagic(bytes) || ((ext === 'pcbdoc' || ext === 'schdoc' || ext === 'prjpcb') && !isMostlyText(bytes))) {
    throw new Error('Not an ASCII Altium file (binary PcbDoc/SchDoc is not expanded — export dump/JSON)');
  }
  return parseAlText(td.decode(bytes), fileName);
}

export function filterAlLayers(layers: AlLayer[], query: string): AlLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('stack:') || token.startsWith('name:')) {
        return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('func:') || token.startsWith('function:')) return l.function.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token === 'copper' || token === 'silk' || token === 'mask') return l.function === token;
      if (token.startsWith('net:') || token.startsWith('track:') || token.startsWith('des:') || token.startsWith('designator:') || token.startsWith('type:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.function}`.toLowerCase().includes(token);
    })
  );
}

export function filterAlNets(nets: AlNet[], query: string): AlNet[] {
  const q = query.trim().toLowerCase();
  if (!q) return nets;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nets.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('net:') || token.startsWith('name:')) return n.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('class:')) return n.netClass.toLowerCase().includes(token.slice(6));
      if (token === 'power' || token === 'ground' || token === 'signal') return n.netClass === token;
      if (token.startsWith('layer:') || token.startsWith('track:') || token.startsWith('des:') || token.startsWith('type:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${n.name} ${n.netClass}`.toLowerCase().includes(token);
    })
  );
}

export function filterAlCoppers(items: AlCopper[], query: string): AlCopper[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('track:') || token.startsWith('via:') || token.startsWith('pad:') || token.startsWith('copper:') || token.startsWith('name:')) {
        return `${c.name} ${c.text} ${c.type}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return c.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:') || token.startsWith('stack:')) return c.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('net:')) return c.net.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('des:') || token.startsWith('designator:') || token.startsWith('comp:') || token.startsWith('row:') || token.startsWith('class:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.name} ${c.type} ${c.layer} ${c.net}`.toLowerCase().includes(token);
    })
  );
}

export function filterAlDesignators(items: AlDesignator[], query: string): AlDesignator[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((d) =>
    tokens.every((token) => {
      if (token.startsWith('des:') || token.startsWith('designator:') || token.startsWith('comp:') || token.startsWith('component:') || token.startsWith('name:')) {
        return `${d.name} ${d.text} ${d.type}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return d.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:') || token.startsWith('stack:')) return d.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('net:')) return d.net.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('track:') || token.startsWith('via:') || token.startsWith('copper:') || token.startsWith('row:') || token.startsWith('class:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${d.name} ${d.type} ${d.layer} ${d.net} ${d.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterAlRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('net:') ||
        token.startsWith('copper:') ||
        token.startsWith('des:') ||
        token.startsWith('designator:') ||
        token.startsWith('track:')
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
