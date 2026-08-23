import type {
  EgBoardItem,
  EgBoardType,
  EgColumn,
  EgDataset,
  EgLayer,
  EgLayerFunction,
  EgNet,
  EgNetClass,
  EgSchItem,
  EgSchType,
  EgSourceKind
} from '../types/eagle-pcb-viewer.types';
import { EG_ASCII_SAMPLE, EG_JSON_SAMPLE } from '../constants/eagle-pcb-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const EG01 = [0x45, 0x47, 0x30, 0x31];

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

function looksLikeEagle(text: string): boolean {
  const t = text.trim();
  if (/\bEagle dump\b/i.test(t)) return true;
  if (/<\s*eagle\b/i.test(t) && (/<\s*board\b/i.test(t) || /<\s*schematic\b/i.test(t))) return true;
  if (/^\s*LAYER\s+\S+/m.test(t) && /^\s*WIRE\s+\S+/m.test(t) && /^\s*(?:VIA|PAD|RECT)\s+/m.test(t)) return true;
  if (/^\s*INSTANCE\s+\S+/m.test(t) && /^\s*SCHWIRE\s+\S+/m.test(t)) return true;
  return false;
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function layerFunction(raw: unknown): EgLayerFunction {
  const v = asString(raw).toLowerCase();
  if (v === 'copper' || v === 'silk' || v === 'mask' || v === 'paste' || v === 'outline') return v;
  if (/silk|place|legend|overlay/.test(v)) return 'silk';
  if (/mask|stop|solder/.test(v)) return 'mask';
  if (/paste|cream|stencil/.test(v)) return 'paste';
  if (/outline|edge|dim|profile/.test(v)) return 'outline';
  if (/copper|top|bottom|inner|route|signal/.test(v)) return 'copper';
  return 'other';
}

function netClass(raw: unknown, name = ''): EgNetClass {
  const v = asString(raw, name).toLowerCase();
  if (v === 'power' || v === 'signal' || v === 'ground' || v === 'other') return v;
  if (/gnd|ground|agnd|dgnd/.test(v)) return 'ground';
  if (/vcc|vdd|power|3v3|5v|vin/.test(v)) return 'power';
  if (v) return 'signal';
  return 'other';
}

function boardType(raw: unknown, name: string): EgBoardType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'wire' || v === 'via' || v === 'pad' || v === 'rect' || v === 'text' || v === 'other') return v;
  if (v === 'track' || v === 'line' || v === 'trace' || v === 'segment') return 'wire';
  if (v === 'polygon' || v === 'zone' || v === 'rectangle') return 'rect';
  return 'other';
}

function schType(raw: unknown, name: string): EgSchType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'instance' || v === 'schwire' || v === 'pin' || v === 'label' || v === 'text' || v === 'other') return v;
  if (v === 'symbol' || v === 'part' || v === 'component') return 'instance';
  if (v === 'wire' || v === 'netwire') return 'schwire';
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

function functionColor(fn: EgLayerFunction, fallback = 7): number {
  if (fn === 'copper') return 4;
  if (fn === 'silk') return 7;
  if (fn === 'mask') return 3;
  if (fn === 'paste') return 2;
  if (fn === 'outline') return 5;
  return fallback;
}

function makeLayer(name: string, fn: EgLayerFunction, stackIndex = 0, color = 0, visible = true, itemCount = 0, index = 0): EgLayer {
  const c = color || functionColor(fn);
  return { id: name, index, name, function: fn, stackIndex, color: c, colorHex: aciToHex(c), visible, itemCount };
}

function makeNet(name: string, klass: EgNetClass, itemCount = 0, index = 0): EgNet {
  return { id: name, index, name, netClass: klass, itemCount };
}

function makeBoard(raw: CadDumpRec, index: number, fallbackLayer: string, colors: Map<string, string>): EgBoardItem {
  const name = asString(raw.name || raw.id, `bd${index + 1}`);
  const type = boardType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius ?? raw.drill);
  const layer = asString(raw.layer, fallbackLayer || '1');
  const net = asString(raw.net);
  const width = asNumber(raw.width, type === 'wire' ? 0.15 : 0);
  const length =
    type === 'wire'
      ? lineLength(x, y, x2, y2)
      : type === 'via' || type === 'pad'
        ? Number((2 * Math.PI * r).toFixed(3))
        : type === 'rect'
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
    text: asString(raw.text || raw.label || name),
    length,
    points
  };
}

function makeSch(raw: CadDumpRec, index: number): EgSchItem {
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
    colorHex: asString(raw.colorHex) || (type === 'schwire' ? '#38bdf8' : type === 'instance' ? '#fb923c' : '#e2e8f0'),
    x,
    y,
    x2,
    y2,
    r,
    text: asString(raw.text || raw.label || name),
    length: type === 'schwire' ? lineLength(x, y, x2, y2) : asNumber(raw.length),
    points
  };
}

function finishDataset(
  name: string,
  sourceKind: EgSourceKind,
  title: string,
  encoding: string,
  eagleVer: string,
  units: string,
  layers: EgLayer[],
  nets: EgNet[],
  boardItems: EgBoardItem[],
  schItems: EgSchItem[],
  warnings: string[]
): EgDataset {
  if (!layers.length && !nets.length && !boardItems.length && !schItems.length) {
    throw new Error('Eagle dump contains no board, schematic, layers, or nets');
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
  const columns: EgColumn[] = [
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
    eagleVer: eagleVer || '—',
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

function ingestJson(raw: unknown, fileName: string, sourceKind: EgSourceKind = 'json', warnings: string[] = []): EgDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Project'));
  const layerSrc = (Array.isArray(root.layers) ? root.layers : Array.isArray(root.stack) ? root.stack : []) as unknown[];
  const netSrc = (Array.isArray(root.nets) ? root.nets : []) as unknown[];
  const boardSrc = (Array.isArray(root.boardItems) ? root.boardItems : Array.isArray(root.wires) ? root.wires : []) as unknown[];
  const schSrc = (Array.isArray(root.schItems) ? root.schItems : Array.isArray(root.schematic) ? root.schematic : []) as unknown[];
  const layers: EgLayer[] = layerSrc.map((item, index) => {
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
  const nets: EgNet[] = netSrc.map((item, index) => {
    const n = rec(item);
    return makeNet(asString(n.name, `net${index + 1}`), netClass(n.netClass || n.class || n.name), asNumber(n.itemCount), index);
  });
  const colors = new Map(layers.map((l) => [l.name, l.colorHex] as const));
  const boardItems = boardSrc.map((item, index) => makeBoard(rec(item), index, layers[0]?.name || '1', colors));
  const schItems = schSrc.map((item, index) => makeSch(rec(item), index));
  if (!layers.length) {
    const names = [...new Set(boardItems.map((b) => b.layer || '1'))];
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
    sourceKind === 'eagle' ? 'ASCII' : 'UTF-8',
    asString(root.eagleVer || root.version, '9.6.2'),
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

function ensureLayer(layers: EgLayer[], colors: Map<string, string>, name: string, fn?: EgLayerFunction, stackIndex?: number): EgLayer {
  let layer = layers.find((l) => l.name === name);
  if (!layer) {
    layer = makeLayer(name, fn || layerFunction(name), stackIndex ?? layers.length, 0, true, 0, layers.length);
    layers.push(layer);
    colors.set(layer.name, layer.colorHex);
  }
  return layer;
}

function ensureNet(nets: EgNet[], name: string, klass?: EgNetClass): EgNet {
  let net = nets.find((n) => n.name === name);
  if (!net && name) {
    net = makeNet(name, klass || netClass(name), 0, nets.length);
    nets.push(net);
  }
  return net || makeNet(name || 'NC', 'other');
}

function parseDumpEagle(text: string, fileName: string): EgDataset {
  const dumpMatch = /Eagle dump\s+(\S+)(?:\s+(\S+))?/i.exec(text);
  const eagleVer = dumpMatch?.[2] || (/Eagle dump \S+ ([\d.]+)/i.exec(text)?.[1] ?? '9.6.2');
  const name = prettyModelName(fileName, dumpMatch?.[1] || 'Project');
  const layers: EgLayer[] = [];
  const nets: EgNet[] = [];
  const boardItems: EgBoardItem[] = [];
  const schItems: EgSchItem[] = [];
  const colors = new Map<string, string>();

  const layerRe = /^\s*LAYER\s+(\S+)(?:\s+(\S+))?(?:\s+(\S+))?(?:\s+(\d+))?/gim;
  let layerMatch: RegExpExecArray | null;
  while ((layerMatch = layerRe.exec(text))) {
    const layerName = layerMatch[1];
    const maybeFn = layerMatch[2] || '';
    const maybeFn2 = layerMatch[3] || '';
    const fn = layerFunction(/copper|silk|mask|paste|outline/i.test(maybeFn2) ? maybeFn2 : maybeFn || layerName);
    const stack = layerMatch[4] ? Number(layerMatch[4]) : /copper|silk|mask|paste|outline/i.test(maybeFn2) ? Number(layerMatch[3]) || layers.length : layers.length;
    ensureLayer(layers, colors, layerName, fn, Number.isFinite(stack) ? stack : layers.length);
  }

  const netRe = /^\s*NET\s+(\S+)(?:\s+(\S+))?/gim;
  let netMatch: RegExpExecArray | null;
  while ((netMatch = netRe.exec(text))) {
    ensureNet(nets, netMatch[1], netClass(netMatch[2] || netMatch[1]));
  }

  const boardRe = /^\s*(WIRE|VIA|PAD|RECT|TEXT)\s+(\S+)\s+(\S+)(?:\s+(\S+))?(?:\s+(.+))?$/gim;
  let boardMatch: RegExpExecArray | null;
  while ((boardMatch = boardRe.exec(text))) {
    const kind = boardMatch[1].toUpperCase();
    const itemName = boardMatch[2];
    const third = boardMatch[3];
    const fourth = boardMatch[4] || '';
    const rest = (boardMatch[5] || '').trim();
    if (kind === 'WIRE') {
      ensureLayer(layers, colors, third, layerFunction(third));
      if (fourth) ensureNet(nets, fourth);
      const nums = parseCoordList(rest);
      boardItems.push(
        makeBoard(
          { name: itemName, type: 'wire', layer: third, net: fourth, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3], width: nums[4] },
          boardItems.length,
          third,
          colors
        )
      );
    } else if (kind === 'VIA') {
      if (third) ensureNet(nets, third);
      const nums = parseCoordList([fourth, rest].filter(Boolean).join(' '));
      const layerName = layers.find((l) => l.function === 'copper')?.name || '1';
      boardItems.push(makeBoard({ name: itemName, type: 'via', layer: layerName, net: third, x: nums[0], y: nums[1], r: nums[2] }, boardItems.length, layerName, colors));
    } else if (kind === 'PAD') {
      if (third) ensureNet(nets, third);
      const layerName = fourth || '1';
      ensureLayer(layers, colors, layerName, layerFunction(layerName));
      const nums = parseCoordList(rest);
      boardItems.push(makeBoard({ name: itemName, type: 'pad', layer: layerName, net: third, x: nums[0], y: nums[1], r: nums[2] }, boardItems.length, layerName, colors));
    } else if (kind === 'RECT') {
      ensureLayer(layers, colors, third, layerFunction(third));
      if (fourth) ensureNet(nets, fourth);
      const pts = pairsFromCoords(parseCoordList(rest));
      boardItems.push(makeBoard({ name: itemName, type: 'rect', layer: third, net: fourth, points: pts }, boardItems.length, third, colors));
    } else if (kind === 'TEXT') {
      ensureLayer(layers, colors, third, layerFunction(third));
      const nums = parseCoordList([fourth, rest].filter(Boolean).join(' '));
      const label = [fourth, rest].filter(Boolean).join(' ').replace(/^[\d.\s,-]+/, '').trim() || itemName;
      boardItems.push(makeBoard({ name: itemName, type: 'text', layer: third, x: nums[0], y: nums[1], text: label }, boardItems.length, third, colors));
    }
  }

  const schRe = /^\s*(INSTANCE|SCHWIRE|PIN|LABEL)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/gim;
  let schMatch: RegExpExecArray | null;
  while ((schMatch = schRe.exec(text))) {
    const kind = schMatch[1].toLowerCase();
    const itemName = schMatch[2];
    const netName = schMatch[3];
    const rest = (schMatch[4] || '').trim();
    if (netName) ensureNet(nets, netName);
    const nums = parseCoordList(rest);
    if (kind === 'instance') {
      schItems.push(makeSch({ name: itemName, type: 'instance', net: netName, x: nums[0], y: nums[1], text: itemName }, schItems.length));
    } else if (kind === 'schwire') {
      schItems.push(makeSch({ name: itemName, type: 'schwire', net: netName, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3] }, schItems.length));
    } else if (kind === 'pin') {
      schItems.push(makeSch({ name: itemName, type: 'pin', net: netName, x: nums[0], y: nums[1], r: 0.12 }, schItems.length));
    } else if (kind === 'label') {
      schItems.push(makeSch({ name: itemName, type: 'label', net: netName, x: nums[0] || 0, y: nums[1] || 0, text: itemName }, schItems.length));
    }
  }

  return finishDataset(name, 'eagle', name, 'ASCII', eagleVer, 'mm', layers, nets, boardItems, schItems, []);
}

function xmlAttr(tag: string, key: string): string {
  const m = new RegExp(`\\b${key}\\s*=\\s*"([^"]*)"`, 'i').exec(tag);
  return m ? m[1] : '';
}

function parseXmlEagle(text: string, fileName: string): EgDataset {
  const verMatch = /<\s*eagle\b[^>]*\bversion\s*=\s*"([^"]+)"/i.exec(text);
  const eagleVer = verMatch?.[1] || '9.6.2';
  const name = prettyModelName(fileName, 'Project');
  const layers: EgLayer[] = [];
  const nets: EgNet[] = [];
  const boardItems: EgBoardItem[] = [];
  const schItems: EgSchItem[] = [];
  const colors = new Map<string, string>();

  const layerRe = /<\s*layer\b([^>]*)\/?\s*>/gi;
  let layerMatch: RegExpExecArray | null;
  while ((layerMatch = layerRe.exec(text))) {
    const attrs = layerMatch[1];
    const number = xmlAttr(attrs, 'number') || xmlAttr(attrs, 'name');
    const layerName = number || xmlAttr(attrs, 'name');
    if (!layerName) continue;
    ensureLayer(layers, colors, layerName, layerFunction(xmlAttr(attrs, 'name') || layerName), layers.length);
  }

  const boardBlock = /<\s*board\b[^>]*>([\s\S]*?)<\s*\/\s*board\s*>/i.exec(text)?.[1] || '';
  const schBlock = /<\s*schematic\b[^>]*>([\s\S]*?)<\s*\/\s*schematic\s*>/i.exec(text)?.[1] || '';

  const signalRe = /<\s*signal\b([^>]*)>([\s\S]*?)<\s*\/\s*signal\s*>/gi;
  let signalMatch: RegExpExecArray | null;
  while ((signalMatch = signalRe.exec(boardBlock))) {
    const netName = xmlAttr(signalMatch[1], 'name');
    if (netName) ensureNet(nets, netName);
    const body = signalMatch[2];
    const wireRe = /<\s*wire\b([^>]*)\/?\s*>/gi;
    let wireMatch: RegExpExecArray | null;
    while ((wireMatch = wireRe.exec(body))) {
      const a = wireMatch[1];
      const layer = xmlAttr(a, 'layer') || '1';
      ensureLayer(layers, colors, layer, layerFunction(layer));
      boardItems.push(
        makeBoard(
          {
            name: `w${boardItems.length + 1}`,
            type: 'wire',
            layer,
            net: netName,
            x: xmlAttr(a, 'x1'),
            y: xmlAttr(a, 'y1'),
            x2: xmlAttr(a, 'x2'),
            y2: xmlAttr(a, 'y2'),
            width: xmlAttr(a, 'width')
          },
          boardItems.length,
          layer,
          colors
        )
      );
    }
    const viaRe = /<\s*via\b([^>]*)\/?\s*>/gi;
    let viaMatch: RegExpExecArray | null;
    while ((viaMatch = viaRe.exec(body))) {
      const a = viaMatch[1];
      const layer = xmlAttr(a, 'layer') || layers.find((l) => l.function === 'copper')?.name || '1';
      ensureLayer(layers, colors, layer, layerFunction(layer));
      boardItems.push(
        makeBoard(
          { name: `via${boardItems.length + 1}`, type: 'via', layer, net: netName, x: xmlAttr(a, 'x'), y: xmlAttr(a, 'y'), r: xmlAttr(a, 'drill') || xmlAttr(a, 'diameter') },
          boardItems.length,
          layer,
          colors
        )
      );
    }
  }

  const textRe = /<\s*text\b([^>]*)>([\s\S]*?)<\s*\/\s*text\s*>/gi;
  let textMatch: RegExpExecArray | null;
  while ((textMatch = textRe.exec(boardBlock))) {
    const a = textMatch[1];
    const label = textMatch[2].replace(/<[^>]+>/g, '').trim();
    const layer = xmlAttr(a, 'layer') || '21';
    ensureLayer(layers, colors, layer, layerFunction(layer));
    boardItems.push(makeBoard({ name: label || `t${boardItems.length + 1}`, type: 'text', layer, x: xmlAttr(a, 'x'), y: xmlAttr(a, 'y'), text: label }, boardItems.length, layer, colors));
  }

  const instRe = /<\s*instance\b([^>]*)\/?\s*>/gi;
  let instMatch: RegExpExecArray | null;
  while ((instMatch = instRe.exec(schBlock))) {
    const a = instMatch[1];
    const part = xmlAttr(a, 'part') || xmlAttr(a, 'name') || `U${schItems.length + 1}`;
    schItems.push(makeSch({ name: part, type: 'instance', x: xmlAttr(a, 'x'), y: xmlAttr(a, 'y'), text: part }, schItems.length));
  }

  const netRe = /<\s*net\b([^>]*)>([\s\S]*?)<\s*\/\s*net\s*>/gi;
  let netMatch: RegExpExecArray | null;
  while ((netMatch = netRe.exec(schBlock))) {
    const netName = xmlAttr(netMatch[1], 'name');
    if (netName) ensureNet(nets, netName);
    const body = netMatch[2];
    const wireRe = /<\s*wire\b([^>]*)\/?\s*>/gi;
    let wireMatch: RegExpExecArray | null;
    while ((wireMatch = wireRe.exec(body))) {
      const a = wireMatch[1];
      schItems.push(
        makeSch(
          { name: `sw${schItems.length + 1}`, type: 'schwire', net: netName, x: xmlAttr(a, 'x1'), y: xmlAttr(a, 'y1'), x2: xmlAttr(a, 'x2'), y2: xmlAttr(a, 'y2') },
          schItems.length
        )
      );
    }
    const labelRe = /<\s*label\b([^>]*)>([\s\S]*?)<\s*\/\s*label\s*>/gi;
    let labelMatch: RegExpExecArray | null;
    while ((labelMatch = labelRe.exec(body))) {
      const a = labelMatch[1];
      const label = labelMatch[2].replace(/<[^>]+>/g, '').trim() || netName;
      schItems.push(makeSch({ name: label, type: 'label', net: netName, x: xmlAttr(a, 'x'), y: xmlAttr(a, 'y'), text: label }, schItems.length));
    }
  }

  if (!layers.length && !boardItems.length && !schItems.length && !nets.length) {
    throw new Error('Eagle XML contains no board or schematic items');
  }
  return finishDataset(name, 'eagle', name, 'ASCII', eagleVer, 'mm', layers, nets, boardItems, schItems, []);
}

function parseAsciiEagle(text: string, fileName: string): EgDataset {
  if (/<\s*eagle\b/i.test(text)) return parseXmlEagle(text, fileName);
  return parseDumpEagle(text, fileName);
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

function parseCsvAsEg(text: string, fileName: string): EgDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Eagle CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: EgLayer[] = [];
  const nets: EgNet[] = [];
  const boardItems: EgBoardItem[] = [];
  const schItems: EgSchItem[] = [];
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
    if (domain === 'schematic' || type === 'instance' || type === 'schwire' || type === 'pin' || type === 'label') {
      schItems.push(makeSch({ name: row.name, type: row.type, net: row.net, x: row.x, y: row.y, x2: row.x2, y2: row.y2, r: row.r, text: row.text }, schItems.length));
      return;
    }
    boardItems.push(
      makeBoard(
        { name: row.name, type: row.type, layer: row.layer, net: row.net, x: row.x, y: row.y, x2: row.x2, y2: row.y2, r: row.r, text: row.text },
        boardItems.length,
        row.layer || '1',
        colors
      )
    );
  });
  return finishDataset(prettyModelName(fileName, 'Project'), 'csv', prettyModelName(fileName, 'Project'), 'UTF-8', '9.6.2', 'mm', layers, nets, boardItems, schItems, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: EgSourceKind): EgDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Project')).trim();
  const keys: string[] = [];
  const layers: EgLayer[] = [];
  const nets: EgNet[] = [];
  const boardItems: EgBoardItem[] = [];
  const schItems: EgSchItem[] = [];
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
      if (domain === 'schematic' || type === 'instance' || type === 'schwire' || type === 'pin' || type === 'label') {
        schItems.push(makeSch({ name: row.name, type: row.type, net: row.net, text: row.text }, schItems.length));
        continue;
      }
      boardItems.push(makeBoard({ name: row.name, type: row.type, layer: row.layer, net: row.net, text: row.text }, boardItems.length, row.layer || '1', colors));
    }
  }
  if (!layers.length && !nets.length && !boardItems.length && !schItems.length) {
    throw new Error('Eagle markdown contains no board or schematic items');
  }
  return finishDataset(name, sourceKind, name, 'UTF-8', '9.6.2', 'mm', layers, nets, boardItems, schItems, []);
}

function isEg01(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === EG01[0] && bytes[1] === EG01[1] && bytes[2] === EG01[2] && bytes[3] === EG01[3];
}

export function buildSampleEgBytes(): Uint8Array {
  return te.encode(EG_ASCII_SAMPLE);
}

export function buildSampleEgJson(): string {
  return EG_JSON_SAMPLE;
}

export function parseEgText(text: string, fileName = ''): EgDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Eagle dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeEagle(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Eagle JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'brd' || ext === 'sch' || looksLikeEagle(raw)) return parseAsciiEagle(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsEg(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an Eagle dump');
}

export function parseEgBytes(bytes: Uint8Array, fileName = ''): EgDataset {
  if (!bytes.length) throw new Error('Eagle dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Eagle files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (isEg01(bytes)) {
    const payload = td.decode(bytes.subarray(4));
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error('Invalid EG01 JSON payload');
    }
    return ingestJson(parsed, fileName, 'eagle', ['Decoded EG01 project dump']);
  }
  if ((ext === 'brd' || ext === 'sch') && !isMostlyText(bytes)) {
    throw new Error('Not an ASCII Eagle file (binary board/schematic is not expanded — export XML/JSON)');
  }
  return parseEgText(td.decode(bytes), fileName);
}

export function filterEgLayers(layers: EgLayer[], query: string): EgLayer[] {
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
      if (token.startsWith('net:') || token.startsWith('wire:') || token.startsWith('sch:') || token.startsWith('board:') || token.startsWith('type:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.function}`.toLowerCase().includes(token);
    })
  );
}

export function filterEgNets(nets: EgNet[], query: string): EgNet[] {
  const q = query.trim().toLowerCase();
  if (!q) return nets;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nets.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('net:') || token.startsWith('name:')) return n.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('class:')) return n.netClass.toLowerCase().includes(token.slice(6));
      if (token === 'power' || token === 'ground' || token === 'signal') return n.netClass === token;
      if (token.startsWith('layer:') || token.startsWith('wire:') || token.startsWith('sch:') || token.startsWith('board:') || token.startsWith('type:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${n.name} ${n.netClass}`.toLowerCase().includes(token);
    })
  );
}

export function filterEgBoardItems(items: EgBoardItem[], query: string): EgBoardItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((b) =>
    tokens.every((token) => {
      if (token.startsWith('wire:') || token.startsWith('via:') || token.startsWith('pad:') || token.startsWith('inst:') || token.startsWith('instance:') || token.startsWith('name:') || token.startsWith('board:')) {
        return `${b.name} ${b.text} ${b.type}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return b.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:') || token.startsWith('stack:')) return b.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('net:')) return b.net.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('sch:') || token.startsWith('schwire:') || token.startsWith('row:') || token.startsWith('class:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${b.name} ${b.type} ${b.layer} ${b.net} ${b.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterEgSchItems(items: EgSchItem[], query: string): EgSchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('inst:') || token.startsWith('instance:') || token.startsWith('schwire:') || token.startsWith('pin:') || token.startsWith('label:') || token.startsWith('sch:') || token.startsWith('name:')) {
        return `${s.name} ${s.text} ${s.type}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return s.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('net:')) return s.net.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('layer:') || token.startsWith('wire:') || token.startsWith('via:') || token.startsWith('board:') || token.startsWith('row:') || token.startsWith('class:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.type} ${s.net} ${s.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterEgRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('wire:') ||
        token.startsWith('inst:') ||
        token.startsWith('instance:')
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
