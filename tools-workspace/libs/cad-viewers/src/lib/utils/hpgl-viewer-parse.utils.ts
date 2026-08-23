import type { HgColumn, HgCommand, HgCommandType, HgDataset, HgLayer, HgSourceKind } from '../types/hpgl-viewer.types';
import { HG_ASCII_SAMPLE, HG_JSON_SAMPLE } from '../constants/hpgl-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const HG01 = [0x48, 0x47, 0x30, 0x31];

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

function looksLikeHpgl(text: string): boolean {
  const t = text.trim();
  if (/\bHPGL dump\b/i.test(t)) return true;
  if (/^\s*PEN\s+\S+/m.test(t)) return true;
  if (/^\s*(?:LINE|CIRCLE|POLYLINE|TEXT)\s+\S+\s+\S+/m.test(t)) return true;
  if (/^\s*IN\s*;/m.test(t) && /(?:^|;|\n)\s*(?:SP|PU|PD)\s*[;\d.-]/im.test(t)) return true;
  return false;
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function commandType(raw: unknown, name: string): HgCommandType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'line' || v === 'circle' || v === 'arc' || v === 'polyline' || v === 'text' || v === 'point' || v === 'other') return v;
  if (v === 'lwpolyline') return 'polyline';
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

function polylineLength(points: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

function makeLayer(name: string, color: number, visible = true, commandCount = 0, index = 0): HgLayer {
  return { id: name, index, name, color, colorHex: aciToHex(color || 7), visible, commandCount };
}

function makeCommand(raw: CadDumpRec, index: number, fallbackLayer: string, layerColors: Map<string, string>): HgCommand {
  const name = asString(raw.name || raw.id, `cmd${index + 1}`);
  const type = commandType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius);
  const layer = asString(raw.layer || raw.pen, fallbackLayer || 'PEN1');
  const length =
    type === 'line'
      ? lineLength(x, y, x2, y2)
      : type === 'circle'
        ? Number((2 * Math.PI * r).toFixed(3))
        : type === 'polyline'
          ? polylineLength(points.length ? points : [
              { x, y },
              { x: x2, y: y2 }
            ])
          : asNumber(raw.length);
  return {
    id: name,
    index,
    name,
    type,
    layer,
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
  sourceKind: HgSourceKind,
  title: string,
  encoding: string,
  plotterVer: string,
  units: string,
  layers: HgLayer[],
  commands: HgCommand[],
  warnings: string[]
): HgDataset {
  if (!layers.length && !commands.length) throw new Error('HPGL dump contains no layers or commands');
  commands.forEach((c, i) => (c.index = i));
  layers.forEach((l) => {
    if (!l.commandCount) l.commandCount = commands.filter((c) => c.layer === l.name).length;
  });
  const columns: HgColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'layer', index: 2, name: 'layer', type: 'STRING' },
    { id: 'x', index: 3, name: 'x', type: 'NUMBER' },
    { id: 'y', index: 4, name: 'y', type: 'NUMBER' }
  ];
  const rows = commands.map((c) => ({
    name: c.name,
    type: c.type,
    layer: c.layer,
    x: String(c.x),
    y: String(c.y)
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    plotterVer: plotterVer || '—',
    units: units || 'm',
    layerCount: layers.length,
    commandCount: commands.length,
    layers,
    commands,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: HgSourceKind = 'json', warnings: string[] = []): HgDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Plot'));
  const layerSrc = (Array.isArray(root.layers) ? root.layers : Array.isArray(root.pens) ? root.pens : []) as unknown[];
  const cmdSrc = (Array.isArray(root.commands) ? root.commands : Array.isArray(root.entities) ? root.entities : []) as unknown[];
  const layers: HgLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    return makeLayer(asString(n.name, `layer${index + 1}`), asNumber(n.color ?? n.aci, 7), n.visible !== false, asNumber(n.commandCount ?? n.entityCount), index);
  });
  const colors = new Map(layers.map((l) => [l.name, l.colorHex] as const));
  const commands: HgCommand[] = cmdSrc.map((item, index) => makeCommand(rec(item), index, layers[0]?.name || 'PEN1', colors));
  if (!layers.length) {
    const names = [...new Set(commands.map((c) => c.layer || 'PEN1'))];
    names.forEach((ln, i) => layers.push(makeLayer(ln, 7 - (i % 6), true, 0, i)));
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'hpgl' ? 'ASCII' : 'UTF-8',
    asString(root.plotterVer || root.version || root.hpglVer, 'HPGL/2'),
    asString(root.units, 'm'),
    layers,
    commands,
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

function tokenizeHpgl(text: string): Array<{ cmd: string; args: string }> {
  const out: Array<{ cmd: string; args: string }> = [];
  let i = 0;
  const s = text;
  const twoLetter = new Set([
    'IN',
    'SP',
    'PU',
    'PD',
    'PA',
    'PR',
    'CI',
    'AA',
    'AR',
    'DT',
    'VS',
    'PW',
    'IP',
    'SC',
    'SI',
    'SR',
    'DI',
    'DR',
    'CP',
    'EA',
    'ER',
    'EW',
    'RA',
    'RR',
    'WG',
    'PM',
    'EP',
    'FP',
    'PG',
    'AF',
    'AH',
    'EC',
    'SM',
    'TL',
    'XT',
    'YT'
  ]);
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (i >= s.length) break;
    const two = s.slice(i, i + 2).toUpperCase();
    if (two === 'LB') {
      i += 2;
      let args = '';
      while (i < s.length && s[i] !== '\x03' && s[i] !== ';') {
        args += s[i];
        i += 1;
      }
      if (s[i] === '\x03' || s[i] === ';') i += 1;
      out.push({ cmd: 'LB', args });
      continue;
    }
    if (twoLetter.has(two) && !/[A-Za-z]/.test(s[i + 2] || '')) {
      i += 2;
      let args = '';
      while (i < s.length && s[i] !== ';' && s[i] !== '\n') {
        args += s[i];
        i += 1;
      }
      if (s[i] === ';' || s[i] === '\n') i += 1;
      out.push({ cmd: two, args: args.trim() });
      continue;
    }
    while (i < s.length && s[i] !== ';' && s[i] !== '\n') i += 1;
    if (s[i] === ';' || s[i] === '\n') i += 1;
  }
  return out;
}

function parseAsciiHpgl(text: string, fileName: string): HgDataset {
  const dumpMatch = /HPGL dump\s+(\S+)(?:\s+(\S+))?/i.exec(text);
  const plotterVer = dumpMatch?.[2] || (/HPGL\/?\s*2/i.test(text) ? 'HPGL/2' : 'HPGL');
  const name = prettyModelName(fileName, dumpMatch?.[1] || 'Plot');
  const layers: HgLayer[] = [];
  const commands: HgCommand[] = [];
  const layerByNumber = new Map<number, string>();
  const colors = new Map<string, string>();

  const penRe = /^\s*PEN\s+(\S+)(?:\s+(\d+))?/gim;
  let penMatch: RegExpExecArray | null;
  while ((penMatch = penRe.exec(text))) {
    const layerName = penMatch[1];
    const color = penMatch[2] ? Number(penMatch[2]) : layers.length + 1;
    if (!layers.some((l) => l.name === layerName)) {
      const layer = makeLayer(layerName, color, true, 0, layers.length);
      layers.push(layer);
      colors.set(layer.name, layer.colorHex);
      layerByNumber.set(color, layer.name);
    }
  }

  const dumpLineRe = /^\s*(LINE|CIRCLE|POLYLINE|TEXT|ARC)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/gim;
  let dumpMatchRow: RegExpExecArray | null;
  while ((dumpMatchRow = dumpLineRe.exec(text))) {
    const kind = dumpMatchRow[1].toLowerCase();
    const cmdName = dumpMatchRow[2];
    const layerName = dumpMatchRow[3];
    const rest = (dumpMatchRow[4] || '').trim();
    if (!layers.some((l) => l.name === layerName)) {
      const layer = makeLayer(layerName, layers.length + 1, true, 0, layers.length);
      layers.push(layer);
      colors.set(layer.name, layer.colorHex);
    }
    if (kind === 'line') {
      const nums = parseCoordList(rest);
      commands.push(
        makeCommand(
          { name: cmdName, type: 'line', layer: layerName, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3] },
          commands.length,
          layerName,
          colors
        )
      );
    } else if (kind === 'circle') {
      const nums = parseCoordList(rest);
      commands.push(
        makeCommand({ name: cmdName, type: 'circle', layer: layerName, x: nums[0], y: nums[1], r: nums[2] }, commands.length, layerName, colors)
      );
    } else if (kind === 'arc') {
      const nums = parseCoordList(rest);
      commands.push(
        makeCommand(
          { name: cmdName, type: 'arc', layer: layerName, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3], r: nums[4] },
          commands.length,
          layerName,
          colors
        )
      );
    } else if (kind === 'polyline') {
      const pts = pairsFromCoords(parseCoordList(rest));
      commands.push(makeCommand({ name: cmdName, type: 'polyline', layer: layerName, points: pts }, commands.length, layerName, colors));
    } else if (kind === 'text') {
      const nums = parseCoordList(rest);
      const label = rest.replace(/^[\d.\s,-]+/, '').trim() || cmdName;
      commands.push(
        makeCommand(
          { name: cmdName, type: 'text', layer: layerName, x: nums[0], y: nums[1], text: label },
          commands.length,
          layerName,
          colors
        )
      );
    }
  }

  let cx = 0;
  let cy = 0;
  let penDown = false;
  let currentLayer = layers[0]?.name || 'PEN1';
  const tokens = tokenizeHpgl(text);
  for (const token of tokens) {
    const nums = parseCoordList(token.args);
    if (token.cmd === 'SP') {
      const n = Math.max(1, Math.round(nums[0] || 1));
      currentLayer = layerByNumber.get(n) || `PEN${n}`;
      if (!layers.some((l) => l.name === currentLayer)) {
        const layer = makeLayer(currentLayer, n, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
        layerByNumber.set(n, currentLayer);
      }
      continue;
    }
    if (token.cmd === 'PU') {
      penDown = false;
      const pts = pairsFromCoords(nums);
      if (pts.length) {
        cx = pts[pts.length - 1].x;
        cy = pts[pts.length - 1].y;
      }
      continue;
    }
    if (token.cmd === 'PD') {
      const pts = pairsFromCoords(nums);
      if (!pts.length) {
        penDown = true;
        continue;
      }
      const chain = [{ x: cx, y: cy }, ...pts];
      if (chain.length >= 3) {
        commands.push(
          makeCommand(
            { name: `poly${commands.length + 1}`, type: 'polyline', layer: currentLayer, points: chain },
            commands.length,
            currentLayer,
            colors
          )
        );
      } else {
        commands.push(
          makeCommand(
            { name: `line${commands.length + 1}`, type: 'line', layer: currentLayer, x: cx, y: cy, x2: pts[0].x, y2: pts[0].y },
            commands.length,
            currentLayer,
            colors
          )
        );
      }
      cx = pts[pts.length - 1].x;
      cy = pts[pts.length - 1].y;
      penDown = true;
      continue;
    }
    if (token.cmd === 'PA' || token.cmd === 'PR') {
      const pts = pairsFromCoords(nums);
      if (!pts.length) continue;
      const abs = token.cmd === 'PA';
      for (const pt of pts) {
        const nx = abs ? pt.x : cx + pt.x;
        const ny = abs ? pt.y : cy + pt.y;
        if (penDown) {
          commands.push(
            makeCommand(
              { name: `line${commands.length + 1}`, type: 'line', layer: currentLayer, x: cx, y: cy, x2: nx, y2: ny },
              commands.length,
              currentLayer,
              colors
            )
          );
        }
        cx = nx;
        cy = ny;
      }
      continue;
    }
    if (token.cmd === 'CI') {
      const r = nums[0] || 0;
      commands.push(
        makeCommand(
          { name: `circle${commands.length + 1}`, type: 'circle', layer: currentLayer, x: cx, y: cy, r },
          commands.length,
          currentLayer,
          colors
        )
      );
      continue;
    }
    if (token.cmd === 'AA' || token.cmd === 'AR') {
      const pts = pairsFromCoords(nums);
      const sweep = nums.length >= 3 ? nums[2] : 90;
      const target = pts[0] || { x: cx, y: cy };
      commands.push(
        makeCommand(
          { name: `arc${commands.length + 1}`, type: 'arc', layer: currentLayer, x: cx, y: cy, x2: target.x, y2: target.y, r: sweep },
          commands.length,
          currentLayer,
          colors
        )
      );
      continue;
    }
    if (token.cmd === 'LB') {
      commands.push(
        makeCommand(
          { name: token.args.trim() || `text${commands.length + 1}`, type: 'text', layer: currentLayer, x: cx, y: cy, text: token.args.trim() },
          commands.length,
          currentLayer,
          colors
        )
      );
    }
  }

  if (!layers.length && !commands.length) throw new Error('HPGL contains no layers or commands');
  if (!layers.length) {
    const names = [...new Set(commands.map((c) => c.layer || 'PEN1'))];
    names.forEach((ln, idx) => layers.push(makeLayer(ln, 7 - (idx % 6), true, 0, idx)));
  }
  return finishDataset(name, 'hpgl', name, 'ASCII', plotterVer, 'm', layers, commands, []);
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

function parseCsvAsHg(text: string, fileName: string): HgDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('HPGL CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: HgLayer[] = [];
  const commands: HgCommand[] = [];
  const colors = new Map<string, string>();
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'layer' || type === 'pen') {
      const layer = makeLayer(row.name || row.layer || row.pen || `layer${layers.length + 1}`, asNumber(row.color, 7), true, 0, layers.length);
      layers.push(layer);
      colors.set(layer.name, layer.colorHex);
      return;
    }
    commands.push(
      makeCommand(
        {
          name: row.name,
          type: row.type,
          layer: row.layer || row.pen,
          x: row.x,
          y: row.y,
          x2: row.x2,
          y2: row.y2,
          r: row.r,
          text: row.text,
          color: row.color
        },
        index,
        row.layer || row.pen || 'PEN1',
        colors
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Plot');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'HPGL/2', 'm', layers, commands, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: HgSourceKind): HgDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Plot')).trim();
  const keys: string[] = [];
  const layers: HgLayer[] = [];
  const commands: HgCommand[] = [];
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
      if (type === 'layer' || type === 'pen') {
        const layer = makeLayer(row.name || row.layer || row.pen || `layer${layers.length + 1}`, 7, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
        continue;
      }
      commands.push(
        makeCommand(
          { name: row.name, type: row.type, layer: row.layer || row.pen, text: row.text },
          commands.length,
          row.layer || row.pen || 'PEN1',
          colors
        )
      );
    }
  }
  if (!layers.length && !commands.length) throw new Error('HPGL markdown contains no layers or commands');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'HPGL/2', 'm', layers, commands, []);
}

function isHg01(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === HG01[0] && bytes[1] === HG01[1] && bytes[2] === HG01[2] && bytes[3] === HG01[3];
}

export function buildSampleHgBytes(): Uint8Array {
  return te.encode(HG_ASCII_SAMPLE);
}

export function buildSampleHgJson(): string {
  return HG_JSON_SAMPLE;
}

export function parseHgText(text: string, fileName = ''): HgDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('HPGL dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeHpgl(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid HPGL JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'hpgl' || ext === 'hgl' || looksLikeHpgl(raw)) return parseAsciiHpgl(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsHg(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a HPGL dump');
}

export function parseHgBytes(bytes: Uint8Array, fileName = ''): HgDataset {
  if (!bytes.length) throw new Error('HPGL dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed HPGL files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (isHg01(bytes)) {
    const payload = td.decode(bytes.subarray(4));
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error('Invalid HG01 JSON payload');
    }
    return ingestJson(parsed, fileName, 'hpgl', ['Decoded HG01 plot dump']);
  }
  if ((ext === 'hpgl' || ext === 'hgl') && !isMostlyText(bytes)) {
    throw new Error('Not an ASCII HPGL file (binary plot is not expanded — export HP-GL/JSON)');
  }
  return parseHgText(td.decode(bytes), fileName);
}

export function filterHgLayers(layers: HgLayer[], query: string): HgLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:') || token.startsWith('pen:')) {
        return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('color:')) return `${l.color} ${l.colorHex}`.toLowerCase().includes(token.slice(6));
      if (token.startsWith('type:') || token.startsWith('cmd:') || token.startsWith('command:') || token.startsWith('ent:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.colorHex}`.toLowerCase().includes(token);
    })
  );
}

export function filterHgCommands(commands: HgCommand[], query: string): HgCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const tokens = q.split(/\s+/).filter(Boolean);
  return commands.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('cmd:') || token.startsWith('command:') || token.startsWith('ent:') || token.startsWith('name:')) {
        return `${c.name} ${c.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return c.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:') || token.startsWith('pen:')) return c.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('color:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.name} ${c.type} ${c.layer} ${c.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterHgRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('pen:') ||
        token.startsWith('cmd:') ||
        token.startsWith('command:') ||
        token.startsWith('ent:')
      ) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('color:')) return true;
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
