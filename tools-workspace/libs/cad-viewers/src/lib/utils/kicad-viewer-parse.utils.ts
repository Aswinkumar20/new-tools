import type {
  KcBoardItem,
  KcBoardType,
  KcColumn,
  KcDataset,
  KcLayer,
  KcLayerFunction,
  KcNet,
  KcNetClass,
  KcSchItem,
  KcSchType,
  KcSourceKind
} from '../types/kicad-viewer.types';
import { KC_ASCII_SAMPLE, KC_JSON_SAMPLE } from '../constants/kicad-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const KC01 = [0x4b, 0x43, 0x30, 0x31];

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

function looksLikeKicad(text: string): boolean {
  const t = text.trim();
  if (/\bKiCad dump\b/i.test(t)) return true;
  if (/^\s*\(kicad_pcb\b/m.test(t) || /^\s*\(kicad_sch\b/m.test(t)) return true;
  if (/^\s*FOOTPRINT\s+\S+/m.test(t) && /^\s*LAYER\s+\S+/m.test(t)) return true;
  if (/^\s*(?:TRACK|VIA|PAD)\s+\S+/m.test(t) && /\bF\.Cu\b|\bB\.Cu\b/.test(t)) return true;
  if (/^\s*SYMBOL\s+\S+/m.test(t) && /^\s*WIRE\s+\S+/m.test(t) && /\bKiCad\b/i.test(t)) return true;
  return false;
}

function kicadExt(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.kicad_pcb')) return 'kicad_pcb';
  if (lower.endsWith('.kicad_sch')) return 'kicad_sch';
  if (lower.endsWith('.kicad_pro')) return 'kicad_pro';
  return (/\.([^.]+)$/.exec(lower)?.[1] ?? '').toLowerCase();
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function layerFunction(raw: unknown): KcLayerFunction {
  const v = asString(raw).toLowerCase();
  if (v === 'copper' || v === 'silk' || v === 'mask' || v === 'paste' || v === 'outline') return v;
  if (/silk|legend|silks/.test(v)) return 'silk';
  if (/mask|solder/.test(v)) return 'mask';
  if (/paste|stencil/.test(v)) return 'paste';
  if (/outline|edge|cuts|profile/.test(v)) return 'outline';
  if (/copper|\.cu\b|in\d+\.cu|f\.cu|b\.cu/.test(v)) return 'copper';
  return 'other';
}

function netClass(raw: unknown, name = ''): KcNetClass {
  const v = asString(raw, name).toLowerCase();
  if (v === 'power' || v === 'signal' || v === 'ground' || v === 'other') return v;
  if (/gnd|ground|agnd|dgnd/.test(v)) return 'ground';
  if (/vcc|vdd|power|3v3|5v|vin/.test(v)) return 'power';
  if (v) return 'signal';
  return 'other';
}

function boardType(raw: unknown, name: string): KcBoardType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'track' || v === 'via' || v === 'pad' || v === 'zone' || v === 'footprint' || v === 'text' || v === 'other') return v;
  if (v === 'segment' || v === 'line' || v === 'trace' || v === 'wire') return 'track';
  if (v === 'fp' || v === 'module') return 'footprint';
  if (v === 'polygon' || v === 'region') return 'zone';
  return 'other';
}

function schType(raw: unknown, name: string): KcSchType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'symbol' || v === 'wire' || v === 'pin' || v === 'label' || v === 'text' || v === 'power' || v === 'other') return v;
  if (v === 'component' || v === 'lib_symbol') return 'symbol';
  if (v === 'global_label' || v === 'hier_label') return 'label';
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

function functionColor(fn: KcLayerFunction, fallback = 7): number {
  if (fn === 'copper') return 4;
  if (fn === 'silk') return 7;
  if (fn === 'mask') return 3;
  if (fn === 'paste') return 2;
  if (fn === 'outline') return 5;
  return fallback;
}

function makeLayer(name: string, fn: KcLayerFunction, stackIndex = 0, color = 0, visible = true, itemCount = 0, index = 0): KcLayer {
  const c = color || functionColor(fn);
  return { id: name, index, name, function: fn, stackIndex, color: c, colorHex: aciToHex(c), visible, itemCount };
}

function makeNet(name: string, klass: KcNetClass, itemCount = 0, index = 0): KcNet {
  return { id: name, index, name, netClass: klass, itemCount };
}

function makeBoard(raw: CadDumpRec, index: number, fallbackLayer: string, colors: Map<string, string>): KcBoardItem {
  const name = asString(raw.name || raw.id, `bd${index + 1}`);
  const type = boardType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius);
  const layer = asString(raw.layer, fallbackLayer || 'F.Cu');
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
    text: asString(raw.text || raw.label || (type === 'footprint' ? name : '')),
    length,
    points
  };
}

function makeSch(raw: CadDumpRec, index: number): KcSchItem {
  const name = asString(raw.name || raw.id, `sch${index + 1}`);
  const type = schType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius, type === 'pin' ? 0.12 : 0);
  return {
    id: name,
    index,
    name,
    type,
    net: asString(raw.net),
    colorHex: asString(raw.colorHex) || (type === 'wire' ? '#38bdf8' : type === 'symbol' ? '#a78bfa' : '#e2e8f0'),
    x,
    y,
    x2,
    y2,
    r,
    text: asString(raw.text || raw.label || name),
    length: type === 'wire' ? lineLength(x, y, x2, y2) : asNumber(raw.length),
    points
  };
}

function finishDataset(
  name: string,
  sourceKind: KcSourceKind,
  title: string,
  encoding: string,
  kicadVer: string,
  units: string,
  layers: KcLayer[],
  nets: KcNet[],
  boardItems: KcBoardItem[],
  schItems: KcSchItem[],
  warnings: string[]
): KcDataset {
  if (!layers.length && !nets.length && !boardItems.length && !schItems.length) {
    throw new Error('KiCad dump contains no board, schematic, layers, or nets');
  }
  boardItems.forEach((b, i) => (b.index = i));
  schItems.forEach((s, i) => (s.index = i));
  layers.forEach((l, i) => {
    l.index = i;
    if (!l.itemCount) l.itemCount = boardItems.filter((b) => b.layer === l.name).length;
  });
  nets.forEach((n, i) => {
    n.index = i;
    if (!n.itemCount) {
      n.itemCount =
        boardItems.filter((b) => b.net === n.name).length + schItems.filter((s) => s.net === n.name).length;
    }
  });
  const columns: KcColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'layer', index: 2, name: 'layer', type: 'STRING' },
    { id: 'net', index: 3, name: 'net', type: 'STRING' },
    { id: 'x', index: 4, name: 'x', type: 'NUMBER' }
  ];
  const rows = [
    ...boardItems.map((b) => ({ name: b.name, type: b.type, layer: b.layer, net: b.net, x: String(b.x) })),
    ...schItems.map((s) => ({ name: s.name, type: s.type, layer: 'schematic', net: s.net, x: String(s.x) }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    kicadVer: kicadVer || '—',
    units: units || 'mm',
    layerCount: layers.length,
    netCount: nets.length,
    boardCount: boardItems.length,
    schCount: schItems.length,
    layers,
    nets,
    boardItems,
    schItems,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: KcSourceKind = 'json', warnings: string[] = []): KcDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Project'));
  const layerSrc = (Array.isArray(root.layers) ? root.layers : Array.isArray(root.stack) ? root.stack : []) as unknown[];
  const netSrc = (Array.isArray(root.nets) ? root.nets : []) as unknown[];
  const boardSrc = (Array.isArray(root.boardItems) ? root.boardItems : Array.isArray(root.traces) ? root.traces : []) as unknown[];
  const schSrc = (Array.isArray(root.schItems) ? root.schItems : Array.isArray(root.schematic) ? root.schematic : []) as unknown[];
  const layers: KcLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    return makeLayer(
      asString(n.name, `layer${index + 1}`),
      layerFunction(n.function || n.kind || n.name),
      asNumber(n.stackIndex ?? n.index, index),
      asNumber(n.color ?? n.aci),
      n.visible !== false,
      asNumber(n.itemCount ?? n.traceCount),
      index
    );
  });
  const nets: KcNet[] = netSrc.map((item, index) => {
    const n = rec(item);
    return makeNet(asString(n.name, `net${index + 1}`), netClass(n.netClass || n.class || n.name), asNumber(n.itemCount ?? n.traceCount), index);
  });
  const colors = new Map(layers.map((l) => [l.name, l.colorHex] as const));
  const boardItems = boardSrc.map((item, index) => makeBoard(rec(item), index, layers[0]?.name || 'F.Cu', colors));
  const schItems = schSrc.map((item, index) => makeSch(rec(item), index));
  if (!layers.length) {
    const names = [...new Set(boardItems.map((b) => b.layer || 'F.Cu'))];
    names.forEach((ln, i) => layers.push(makeLayer(ln, layerFunction(ln), i, 0, true, 0, i)));
  }
  if (!nets.length) {
    const names = [...new Set([...boardItems.map((b) => b.net), ...schItems.map((s) => s.net)].filter(Boolean))];
    names.forEach((nn, i) => nets.push(makeNet(nn, netClass(nn), 0, i)));
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'kicad' ? 'ASCII' : 'UTF-8',
    asString(root.kicadVer || root.version, '8.0'),
    asString(root.units, 'mm'),
    layers,
    nets,
    boardItems,
    schItems,
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

function ensureLayer(layers: KcLayer[], colors: Map<string, string>, name: string, fn?: KcLayerFunction, stackIndex?: number): KcLayer {
  let layer = layers.find((l) => l.name === name);
  if (!layer) {
    layer = makeLayer(name, fn || layerFunction(name), stackIndex ?? layers.length, 0, true, 0, layers.length);
    layers.push(layer);
    colors.set(layer.name, layer.colorHex);
  }
  return layer;
}

function ensureNet(nets: KcNet[], name: string, klass?: KcNetClass): KcNet {
  let net = nets.find((n) => n.name === name);
  if (!net && name) {
    net = makeNet(name, klass || netClass(name), 0, nets.length);
    nets.push(net);
  }
  return net || makeNet(name || 'NC', 'other');
}

function parseDumpKicad(text: string, fileName: string): KcDataset {
  const dumpMatch = /KiCad dump\s+(\S+)(?:\s+(\S+))?/i.exec(text);
  const kicadVer = dumpMatch?.[2] || (/KiCad dump \S+ ([\d.]+)/i.exec(text)?.[1] ?? '8.0');
  const name = prettyModelName(fileName, dumpMatch?.[1] || 'Project');
  const layers: KcLayer[] = [];
  const nets: KcNet[] = [];
  const boardItems: KcBoardItem[] = [];
  const schItems: KcSchItem[] = [];
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

  const boardRe = /^\s*(TRACK|VIA|PAD|ZONE|FOOTPRINT|TEXT)\s+(\S+)\s+(\S+)(?:\s+(\S+))?(?:\s+(.+))?$/gim;
  let boardMatch: RegExpExecArray | null;
  while ((boardMatch = boardRe.exec(text))) {
    const kind = boardMatch[1].toUpperCase();
    const itemName = boardMatch[2];
    const third = boardMatch[3];
    const fourth = boardMatch[4] || '';
    const rest = (boardMatch[5] || '').trim();
    if (kind === 'TRACK') {
      ensureLayer(layers, colors, third, layerFunction(third));
      if (fourth) ensureNet(nets, fourth);
      const nums = parseCoordList(rest);
      boardItems.push(
        makeBoard(
          { name: itemName, type: 'track', layer: third, net: fourth, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3], width: nums[4] },
          boardItems.length,
          third,
          colors
        )
      );
    } else if (kind === 'VIA') {
      if (third) ensureNet(nets, third);
      const nums = parseCoordList([fourth, rest].filter(Boolean).join(' '));
      const layerName = layers.find((l) => l.function === 'copper')?.name || 'F.Cu';
      boardItems.push(makeBoard({ name: itemName, type: 'via', layer: layerName, net: third, x: nums[0], y: nums[1], r: nums[2] }, boardItems.length, layerName, colors));
    } else if (kind === 'PAD') {
      if (third) ensureNet(nets, third);
      const layerName = fourth || 'F.Cu';
      ensureLayer(layers, colors, layerName, layerFunction(layerName));
      const nums = parseCoordList(rest);
      boardItems.push(makeBoard({ name: itemName, type: 'pad', layer: layerName, net: third, x: nums[0], y: nums[1], r: nums[2] }, boardItems.length, layerName, colors));
    } else if (kind === 'ZONE') {
      ensureLayer(layers, colors, third, layerFunction(third));
      if (fourth) ensureNet(nets, fourth);
      const pts = pairsFromCoords(parseCoordList(rest));
      boardItems.push(makeBoard({ name: itemName, type: 'zone', layer: third, net: fourth, points: pts }, boardItems.length, third, colors));
    } else if (kind === 'FOOTPRINT') {
      ensureLayer(layers, colors, third, layerFunction(third));
      const nums = parseCoordList([fourth, rest].filter(Boolean).join(' '));
      boardItems.push(
        makeBoard({ name: itemName, type: 'footprint', layer: third, x: nums[0], y: nums[1], text: itemName }, boardItems.length, third, colors)
      );
    } else if (kind === 'TEXT') {
      ensureLayer(layers, colors, third, layerFunction(third));
      const nums = parseCoordList([fourth, rest].filter(Boolean).join(' '));
      const label = [fourth, rest].filter(Boolean).join(' ').replace(/^[\d.\s,-]+/, '').trim() || itemName;
      boardItems.push(makeBoard({ name: itemName, type: 'text', layer: third, x: nums[0], y: nums[1], text: label }, boardItems.length, third, colors));
    }
  }

  const schRe = /^\s*(SYMBOL|WIRE|PIN|LABEL)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/gim;
  let schMatch: RegExpExecArray | null;
  while ((schMatch = schRe.exec(text))) {
    const kind = schMatch[1].toLowerCase();
    const itemName = schMatch[2];
    const netName = schMatch[3];
    const rest = (schMatch[4] || '').trim();
    if (netName) ensureNet(nets, netName);
    const nums = parseCoordList(rest);
    if (kind === 'symbol') {
      schItems.push(makeSch({ name: itemName, type: 'symbol', net: netName, x: nums[0], y: nums[1], text: itemName }, schItems.length));
    } else if (kind === 'wire') {
      schItems.push(makeSch({ name: itemName, type: 'wire', net: netName, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3] }, schItems.length));
    } else if (kind === 'pin') {
      schItems.push(makeSch({ name: itemName, type: 'pin', net: netName, x: nums[0], y: nums[1], r: 0.12 }, schItems.length));
    } else if (kind === 'label') {
      schItems.push(makeSch({ name: itemName, type: 'label', net: netName, x: nums[0] || 0, y: nums[1] || 0, text: itemName }, schItems.length));
    }
  }

  return finishDataset(name, 'kicad', name, 'ASCII', kicadVer, 'mm', layers, nets, boardItems, schItems, []);
}

function attr(block: string, key: string): string {
  const m = new RegExp(`\\(${key}\\s+([^)]+)\\)`, 'i').exec(block);
  return m ? m[1].replace(/^"|"$/g, '').trim() : '';
}

function extractSexprBlocks(text: string, head: string): string[] {
  const out: string[] = [];
  const token = `(${head}`;
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf(token, i);
    if (start < 0) break;
    if (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1] || '')) {
      i = start + token.length;
      continue;
    }
    let depth = 0;
    let j = start;
    for (; j < text.length; j++) {
      if (text[j] === '(') depth += 1;
      else if (text[j] === ')') {
        depth -= 1;
        if (depth === 0) {
          out.push(text.slice(start, j + 1));
          break;
        }
      }
    }
    i = j + 1;
  }
  return out;
}

function parseSexprKicad(text: string, fileName: string): KcDataset {
  const verMatch = /\(version\s+(\d+)\)/i.exec(text);
  const kicadVer = verMatch ? (/^2024/.test(verMatch[1]) ? '8.0' : verMatch[1]) : '8.0';
  const name = prettyModelName(fileName, 'Project');
  const layers: KcLayer[] = [];
  const nets: KcNet[] = [];
  const boardItems: KcBoardItem[] = [];
  const schItems: KcSchItem[] = [];
  const colors = new Map<string, string>();
  const netById = new Map<string, string>();

  const netRe = /\(net\s+(\d+)\s+"?([^"\n)]+)"?\)/g;
  let netMatch: RegExpExecArray | null;
  while ((netMatch = netRe.exec(text))) {
    const nName = netMatch[2].trim();
    if (!nName) continue;
    netById.set(netMatch[1], nName);
    ensureNet(nets, nName, netClass(nName));
  }

  for (const block of extractSexprBlocks(text, 'segment')) {
    const start = /\(start\s+([-\d.]+)\s+([-\d.]+)\)/.exec(block);
    const end = /\(end\s+([-\d.]+)\s+([-\d.]+)\)/.exec(block);
    const layer = attr(block, 'layer') || 'F.Cu';
    const netId = attr(block, 'net');
    const netName = netById.get(netId) || '';
    ensureLayer(layers, colors, layer, layerFunction(layer));
    if (netName) ensureNet(nets, netName);
    if (start && end) {
      boardItems.push(
        makeBoard(
          {
            name: `seg${boardItems.length + 1}`,
            type: 'track',
            layer,
            net: netName,
            x: start[1],
            y: start[2],
            x2: end[1],
            y2: end[2],
            width: attr(block, 'width')
          },
          boardItems.length,
          layer,
          colors
        )
      );
    }
  }

  for (const block of extractSexprBlocks(text, 'via')) {
    const at = /\(at\s+([-\d.]+)\s+([-\d.]+)\)/.exec(block);
    const drill = Number(attr(block, 'drill') || attr(block, 'size') || 0.35);
    const netName = netById.get(attr(block, 'net')) || '';
    const layer = 'F.Cu';
    ensureLayer(layers, colors, layer, 'copper');
    if (netName) ensureNet(nets, netName);
    if (at) {
      boardItems.push(
        makeBoard({ name: `via${boardItems.length + 1}`, type: 'via', layer, net: netName, x: at[1], y: at[2], r: drill / 2 || 0.35 }, boardItems.length, layer, colors)
      );
    }
  }

  for (const block of extractSexprBlocks(text, 'gr_text')) {
    const label = /gr_text\s+"([^"]+)"/.exec(block)?.[1] || 'text';
    const at = /\(at\s+([-\d.]+)\s+([-\d.]+)/.exec(block);
    const layer = attr(block, 'layer') || 'F.SilkS';
    ensureLayer(layers, colors, layer, layerFunction(layer));
    if (at) {
      boardItems.push(makeBoard({ name: label, type: 'text', layer, x: at[1], y: at[2], text: label }, boardItems.length, layer, colors));
    }
  }

  for (const block of extractSexprBlocks(text, 'wire')) {
    const pts = [...block.matchAll(/\(xy\s+([-\d.]+)\s+([-\d.]+)\)/g)];
    if (pts.length >= 2) {
      schItems.push(
        makeSch(
          { name: `w${schItems.length + 1}`, type: 'wire', x: pts[0][1], y: pts[0][2], x2: pts[1][1], y2: pts[1][2] },
          schItems.length
        )
      );
    }
  }

  for (const block of extractSexprBlocks(text, 'label')) {
    const label = /label\s+"([^"]+)"/.exec(block)?.[1] || '';
    const at = /\(at\s+([-\d.]+)\s+([-\d.]+)/.exec(block);
    if (label) ensureNet(nets, label);
    if (at) {
      schItems.push(makeSch({ name: label || `lbl${schItems.length + 1}`, type: 'label', net: label, x: at[1], y: at[2], text: label }, schItems.length));
    }
  }

  for (const block of extractSexprBlocks(text, 'symbol')) {
    const at = /\(at\s+([-\d.]+)\s+([-\d.]+)/.exec(block);
    const ref = /\(property\s+"Reference"\s+"([^"]+)"/.exec(block)?.[1] || `U${schItems.length + 1}`;
    if (at) {
      schItems.push(makeSch({ name: ref, type: 'symbol', x: at[1], y: at[2], text: ref }, schItems.length));
    }
  }

  if (!layers.length && !boardItems.length && !schItems.length && !nets.length) {
    throw new Error('KiCad s-expr contains no board or schematic items');
  }
  return finishDataset(name, 'kicad', name, 'ASCII', kicadVer, 'mm', layers, nets, boardItems, schItems, []);
}

function parseAsciiKicad(text: string, fileName: string): KcDataset {
  if (/^\s*\(kicad_(?:pcb|sch)\b/m.test(text)) return parseSexprKicad(text, fileName);
  return parseDumpKicad(text, fileName);
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

function parseCsvAsKc(text: string, fileName: string): KcDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('KiCad CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: KcLayer[] = [];
  const nets: KcNet[] = [];
  const boardItems: KcBoardItem[] = [];
  const schItems: KcSchItem[] = [];
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
    if (domain === 'schematic' || type === 'symbol' || type === 'wire' || type === 'pin' || type === 'label') {
      schItems.push(makeSch({ name: row.name, type: row.type, net: row.net, x: row.x, y: row.y, x2: row.x2, y2: row.y2, r: row.r, text: row.text }, schItems.length));
      return;
    }
    boardItems.push(
      makeBoard(
        { name: row.name, type: row.type, layer: row.layer, net: row.net, x: row.x, y: row.y, x2: row.x2, y2: row.y2, r: row.r, text: row.text },
        boardItems.length,
        row.layer || 'F.Cu',
        colors
      )
    );
  });
  return finishDataset(prettyModelName(fileName, 'Project'), 'csv', prettyModelName(fileName, 'Project'), 'UTF-8', '8.0', 'mm', layers, nets, boardItems, schItems, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: KcSourceKind): KcDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Project')).trim();
  const keys: string[] = [];
  const layers: KcLayer[] = [];
  const nets: KcNet[] = [];
  const boardItems: KcBoardItem[] = [];
  const schItems: KcSchItem[] = [];
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
      if (domain === 'schematic' || type === 'symbol' || type === 'wire' || type === 'pin' || type === 'label') {
        schItems.push(makeSch({ name: row.name, type: row.type, net: row.net, text: row.text }, schItems.length));
        continue;
      }
      boardItems.push(makeBoard({ name: row.name, type: row.type, layer: row.layer, net: row.net, text: row.text }, boardItems.length, row.layer || 'F.Cu', colors));
    }
  }
  if (!layers.length && !nets.length && !boardItems.length && !schItems.length) {
    throw new Error('KiCad markdown contains no board or schematic items');
  }
  return finishDataset(name, sourceKind, name, 'UTF-8', '8.0', 'mm', layers, nets, boardItems, schItems, []);
}

function isKc01(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === KC01[0] && bytes[1] === KC01[1] && bytes[2] === KC01[2] && bytes[3] === KC01[3];
}

export function buildSampleKcBytes(): Uint8Array {
  return te.encode(KC_ASCII_SAMPLE);
}

export function buildSampleKcJson(): string {
  return KC_JSON_SAMPLE;
}

export function parseKcText(text: string, fileName = ''): KcDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('KiCad dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = kicadExt(fileName);
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeKicad(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid KiCad JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'kicad_pcb' || ext === 'kicad_sch' || ext === 'kicad_pro' || looksLikeKicad(raw)) return parseAsciiKicad(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsKc(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a KiCad dump');
}

export function parseKcBytes(bytes: Uint8Array, fileName = ''): KcDataset {
  if (!bytes.length) throw new Error('KiCad dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed KiCad files are not supported — decompress first');
  const ext = kicadExt(fileName);
  if (isKc01(bytes)) {
    const payload = td.decode(bytes.subarray(4));
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error('Invalid KC01 JSON payload');
    }
    return ingestJson(parsed, fileName, 'kicad', ['Decoded KC01 project dump']);
  }
  if ((ext === 'kicad_pcb' || ext === 'kicad_sch' || ext === 'kicad_pro') && !isMostlyText(bytes)) {
    throw new Error('Not an ASCII KiCad file (binary project is not expanded — export s-expr/JSON)');
  }
  return parseKcText(td.decode(bytes), fileName);
}

export function filterKcLayers(layers: KcLayer[], query: string): KcLayer[] {
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
      if (token.startsWith('net:') || token.startsWith('track:') || token.startsWith('sch:') || token.startsWith('board:') || token.startsWith('type:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.function}`.toLowerCase().includes(token);
    })
  );
}

export function filterKcNets(nets: KcNet[], query: string): KcNet[] {
  const q = query.trim().toLowerCase();
  if (!q) return nets;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nets.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('net:') || token.startsWith('name:')) return n.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('class:')) return n.netClass.toLowerCase().includes(token.slice(6));
      if (token === 'power' || token === 'ground' || token === 'signal') return n.netClass === token;
      if (token.startsWith('layer:') || token.startsWith('track:') || token.startsWith('sch:') || token.startsWith('board:') || token.startsWith('type:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${n.name} ${n.netClass}`.toLowerCase().includes(token);
    })
  );
}

export function filterKcBoardItems(items: KcBoardItem[], query: string): KcBoardItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((b) =>
    tokens.every((token) => {
      if (token.startsWith('track:') || token.startsWith('via:') || token.startsWith('pad:') || token.startsWith('fp:') || token.startsWith('footprint:') || token.startsWith('name:') || token.startsWith('board:')) {
        return `${b.name} ${b.text} ${b.type}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return b.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:') || token.startsWith('stack:')) return b.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('net:')) return b.net.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('sch:') || token.startsWith('sym:') || token.startsWith('wire:') || token.startsWith('row:') || token.startsWith('class:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${b.name} ${b.type} ${b.layer} ${b.net} ${b.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterKcSchItems(items: KcSchItem[], query: string): KcSchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('sym:') || token.startsWith('symbol:') || token.startsWith('wire:') || token.startsWith('pin:') || token.startsWith('label:') || token.startsWith('sch:') || token.startsWith('name:')) {
        return `${s.name} ${s.text} ${s.type}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return s.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('net:')) return s.net.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('layer:') || token.startsWith('track:') || token.startsWith('via:') || token.startsWith('board:') || token.startsWith('row:') || token.startsWith('class:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.type} ${s.net} ${s.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterKcRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('board:') ||
        token.startsWith('sch:') ||
        token.startsWith('track:') ||
        token.startsWith('sym:') ||
        token.startsWith('symbol:')
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
