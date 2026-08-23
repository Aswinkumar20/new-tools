import type {
  FpColumn,
  FpDataset,
  FpDrawType,
  FpLevel,
  FpRoom,
  FpSourceKind,
  FpSpace,
  FpSpaceKind
} from '../types/building-floor-plan-viewer.types';
import { FP_JSON_SAMPLE } from '../constants/building-floor-plan-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const FP_MAGIC = new Uint8Array([0x46, 0x50, 0x30, 0x31]); // FP01
const FP_COLORS = ['#67e8f9', '#38bdf8', '#fbbf24', '#4ade80', '#c4b5fd', '#fb7185'];

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

function looksLikeFloorPlan(text: string): boolean {
  const t = text.trim();
  if (/\b(?:NAVIS|MEP|BIM clash|IFC) dump\b/i.test(t)) return false;
  if (/\bFLOOR dump\b/i.test(t) || /\bPLAN dump\b/i.test(t)) return true;
  if (/^\s*LEVEL\s+\S+/m.test(t) && /^\s*ROOM\s+\S+/m.test(t)) return true;
  if (/ISO-10303-21/i.test(t) && /\bIFC(?:BUILDINGSTOREY|SPACE)\b/i.test(t)) return true;
  return false;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isFpMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === FP_MAGIC[0] && bytes[1] === FP_MAGIC[1] && bytes[2] === FP_MAGIC[2] && bytes[3] === FP_MAGIC[3];
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function spaceKind(raw: unknown, name = ''): FpSpaceKind {
  const v = `${asString(raw)} ${name}`.toLowerCase();
  if (v.includes('column') || v.includes('col')) return 'column';
  if (v.includes('aisle')) return 'aisle';
  if (v.includes('text') || v.includes('label') || v.includes('shopranker')) return 'text';
  if (v.includes('room') || v.includes('space') || v.includes('shop') || v.includes('counter') || v.includes('storage')) return 'room';
  return 'other';
}

function drawTypeOf(kind: FpSpaceKind, raw?: unknown): FpDrawType {
  const v = asString(raw).toLowerCase();
  if (v === 'lwpolyline' || v === 'polyline' || v === 'rect') return 'lwpolyline';
  if (v === 'circle') return 'circle';
  if (v === 'line') return 'line';
  if (v === 'text') return 'text';
  if (v === 'point') return 'point';
  if (kind === 'column') return 'circle';
  if (kind === 'aisle') return 'line';
  if (kind === 'text') return 'text';
  return 'lwpolyline';
}

function rectPoints(x: number, y: number, x2: number, y2: number): Array<{ x: number; y: number }> {
  return [
    { x, y },
    { x: x2, y },
    { x: x2, y: y2 },
    { x, y: y2 },
    { x, y }
  ];
}

function shopGeom(name: string): CadDumpRec {
  const n = name.toLowerCase();
  if (n.includes('shop') && !n.includes('ranker')) return { kind: 'room', level: 'Ground', x: 0, y: 0, x2: 12, y2: 8 };
  if (n.includes('counter')) return { kind: 'room', level: 'Ground', x: 1, y: 1, x2: 4, y2: 2.2 };
  if (n.includes('storage')) return { kind: 'room', level: 'Ground', x: 8, y: 0.5, x2: 11.5, y2: 2.5 };
  if (n.includes('col')) return { kind: 'column', level: 'Ground', x: 10, y: 6, r: 0.35 };
  if (n.includes('aisle')) return { kind: 'aisle', level: 'Ground', x: 6, y: 1, x2: 6, y2: 7 };
  if (n.includes('shopranker') || n.includes('ranker')) {
    return { kind: 'text', level: 'Ground', x: 4.2, y: 4.2, text: 'ShopRanker' };
  }
  return {};
}

function makeSpace(raw: CadDumpRec, index: number): FpSpace {
  const name = asString(raw.name || raw.id, `space${index + 1}`);
  const shop = shopGeom(name);
  const merged = { ...shop, ...raw };
  const kind = spaceKind(merged.kind || merged.type, name);
  const drawType = drawTypeOf(kind, merged.drawType || merged.type);
  const x = asNumber(merged.x);
  const y = asNumber(merged.y);
  const x2 = asNumber(merged.x2, kind === 'room' ? x + 1 : x);
  const y2 = asNumber(merged.y2, kind === 'room' ? y + 1 : y);
  const r = asNumber(merged.r ?? merged.radius, kind === 'column' ? 0.35 : 0);
  const points = Array.isArray(merged.points)
    ? (merged.points as unknown[]).map((p) => ({ x: asNumber(rec(p).x), y: asNumber(rec(p).y) }))
    : kind === 'room' || drawType === 'lwpolyline'
      ? rectPoints(x, y, x2, y2)
      : [];
  return {
    id: name,
    index,
    name,
    kind,
    drawType,
    level: asString(merged.level, 'Ground') || 'Ground',
    colorHex: asString(raw.colorHex) || FP_COLORS[index % FP_COLORS.length],
    x,
    y,
    x2,
    y2,
    r,
    text: asString(merged.text, kind === 'text' ? name : ''),
    points
  };
}

function makeRoom(raw: CadDumpRec, index: number): FpRoom {
  const name = asString(raw.name || raw.id, `room${index + 1}`);
  const shop = shopGeom(name);
  const merged = { ...shop, ...raw };
  const x = asNumber(merged.x);
  const y = asNumber(merged.y);
  const x2 = asNumber(merged.x2, x + 1);
  const y2 = asNumber(merged.y2, y + 1);
  return {
    id: name,
    index,
    name,
    level: asString(merged.level, 'Ground') || 'Ground',
    x,
    y,
    x2,
    y2,
    area: asNumber(raw.area, Number((Math.abs(x2 - x) * Math.abs(y2 - y)).toFixed(4)))
  };
}

function makeLevel(raw: CadDumpRec, index: number, roomCount = 0): FpLevel {
  const name = asString(raw.name || raw.id, `L${index}`);
  return {
    id: name,
    index,
    name,
    elevation: asNumber(raw.elevation ?? raw.value),
    description: asString(raw.description || raw.desc || raw.kind),
    roomCount: asNumber(raw.roomCount, roomCount)
  };
}

function finishDataset(
  name: string,
  sourceKind: FpSourceKind,
  title: string,
  encoding: string,
  planVer: string,
  units: string,
  spaces: FpSpace[],
  rooms: FpRoom[],
  levels: FpLevel[],
  warnings: string[]
): FpDataset {
  if (!spaces.length && !rooms.length && !levels.length) throw new Error('Floor plan dump contains no levels or rooms');
  for (const room of rooms) {
    if (!spaces.some((s) => s.name === room.name && s.kind === 'room')) {
      spaces.push(makeSpace({ name: room.name, kind: 'room', level: room.level, x: room.x, y: room.y, x2: room.x2, y2: room.y2 }, spaces.length));
    }
  }
  spaces.forEach((s, i) => (s.index = i));
  rooms.forEach((r, i) => (r.index = i));
  const counts = new Map<string, number>();
  for (const r of rooms) counts.set(r.level, (counts.get(r.level) || 0) + 1);
  if (!levels.length) {
    [...new Set([...spaces.map((s) => s.level), ...rooms.map((r) => r.level)])].forEach((n, i) => levels.push(makeLevel({ name: n }, i)));
  }
  levels.forEach((d, i) => {
    d.index = i;
    d.roomCount = counts.get(d.name) || d.roomCount || 0;
  });
  const columns: FpColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'level', index: 2, name: 'level', type: 'STRING' },
    { id: 'room', index: 3, name: 'room', type: 'STRING' },
    { id: 'x', index: 4, name: 'x', type: 'NUMBER' }
  ];
  const rows = [
    ...levels.map((d) => ({ name: d.name, type: 'level', level: d.name, room: '', x: String(d.elevation) })),
    ...rooms.map((r) => ({ name: r.name, type: 'room', level: r.level, room: r.name, x: String(r.x) })),
    ...spaces.map((s) => ({ name: s.name, type: 'space', level: s.level, room: s.kind === 'room' ? s.name : '', x: String(s.x) }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    planVer: planVer || '—',
    units: units || 'm',
    spaceCount: spaces.length,
    roomCount: rooms.length,
    levelCount: levels.length,
    spaces,
    rooms,
    levels,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: FpSourceKind = 'json', warnings: string[] = []): FpDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'FloorPlan'));
  const spaces = ((Array.isArray(root.spaces) ? root.spaces : []) as unknown[]).map((item, i) => makeSpace(rec(item), i));
  const rooms = ((Array.isArray(root.rooms) ? root.rooms : []) as unknown[]).map((item, i) => makeRoom(rec(item), i));
  const levels = ((Array.isArray(root.levels) ? root.levels : []) as unknown[]).map((item, i) => makeLevel(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'plan' ? 'ASCII' : 'UTF-8',
    asString(root.planVer || root.version, '1.0'),
    asString(root.units, 'm'),
    spaces,
    rooms,
    levels,
    warnings
  );
}

function parseAsciiFloor(text: string, fileName: string): FpDataset {
  const version = /(?:FLOOR|PLAN) dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /(?:FLOOR|PLAN) dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'FloorPlan');
  const name = prettyModelName(fileName, dumpName);
  const spaces: FpSpace[] = [];
  const rooms: FpRoom[] = [];
  const levels: FpLevel[] = [];
  let m: RegExpExecArray | null;
  const levelRe = /\bLEVEL\s+([A-Za-z0-9_-]+)\s+([-\d.eE]+)(?:\s+(.+))?$/gim;
  while ((m = levelRe.exec(text))) {
    const matchName = m?.[1] ?? '';
    if (matchName && !levels.some((d) => d.name === matchName)) {
      levels.push(makeLevel({ name: matchName, elevation: m[2], description: (m[3] || '').trim() }, levels.length));
    }
  }
  const roomRe = /\bROOM\s+([A-Za-z0-9_-]+)\s+(\S+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/gi;
  while ((m = roomRe.exec(text))) {
    rooms.push(makeRoom({ name: m[1], level: m[2], x: m[3], y: m[4], x2: m[5], y2: m[6] }, rooms.length));
  }
  const colRe = /\bCOLUMN\s+([A-Za-z0-9_-]+)\s+(\S+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/gi;
  while ((m = colRe.exec(text))) {
    spaces.push(makeSpace({ name: m[1], kind: 'column', level: m[2], x: m[3], y: m[4], r: m[5] }, spaces.length));
  }
  const aisleRe = /\bAISLE\s+([A-Za-z0-9_-]+)\s+(\S+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/gi;
  while ((m = aisleRe.exec(text))) {
    spaces.push(makeSpace({ name: m[1], kind: 'aisle', level: m[2], x: m[3], y: m[4], x2: m[5], y2: m[6] }, spaces.length));
  }
  const textRe = /\bTEXT\s+([A-Za-z0-9_-]+)\s+(\S+)\s+([-\d.eE]+)\s+([-\d.eE]+)/gi;
  while ((m = textRe.exec(text))) {
    spaces.push(makeSpace({ name: m[1], kind: 'text', level: m[2], x: m[3], y: m[4], text: m[1] }, spaces.length));
  }
  if (!rooms.length && !spaces.length) throw new Error('Floor plan dump has no ROOM or space entries');
  const warnings = ['ASCII floor-plan dump is a metadata subset — not Revit floor plans, ArchiCAD, or full IFC storeys.'];
  return finishDataset(name, 'plan', name, 'ASCII', version, 'm', spaces, rooms, levels, warnings);
}

function quotedStrings(args: string): string[] {
  const out: string[] = [];
  const re = /'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(args))) out.push(m[1]);
  return out;
}

function parseStepFloor(text: string, fileName: string): FpDataset {
  const name = prettyModelName(fileName, 'FloorPlan');
  const spaces: FpSpace[] = [];
  const rooms: FpRoom[] = [];
  const levels: FpLevel[] = [];
  const entRe = /#\d+\s*=\s*(IFC[A-Z0-9]+)\s*\(([\s\S]*?)\)\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = entRe.exec(text))) {
    const entity = m[1].toUpperCase();
    const strs = quotedStrings(m[2]);
    const label = strs[0] || entity.toLowerCase();
    if (entity === 'IFCBUILDINGSTOREY') {
      const elev = /,\s*([-\d.eE]+)\s*\)\s*$/.exec(m[2].replace(/\s+/g, ''));
      levels.push(makeLevel({ name: label, elevation: elev?.[1] || 0 }, levels.length));
      continue;
    }
    if (entity === 'IFCSPACE') {
      rooms.push(makeRoom({ name: label, level: levels[0]?.name || 'Ground' }, rooms.length));
      continue;
    }
    if (entity === 'IFCCOLUMN') {
      spaces.push(makeSpace({ name: label, kind: 'column', level: levels[0]?.name || 'Ground' }, spaces.length));
      continue;
    }
    if (entity === 'IFCTEXT' || entity === 'IFCANNOTATION') {
      spaces.push(makeSpace({ name: label, kind: 'text', level: levels[0]?.name || 'Ground' }, spaces.length));
    }
  }
  if (!rooms.length && !spaces.length && !levels.length) throw new Error('IFC plan subset has no storeys or spaces');
  const warnings = ['IFC storey/space subset maps named entities to shop tessellation — full IFC geometry is not expanded.'];
  return finishDataset(name, 'plan', name, 'ASCII', 'IFC4', 'm', spaces, rooms, levels, warnings);
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

function parseCsvAsFp(text: string, fileName: string): FpDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Floor plan CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const spaces: FpSpace[] = [];
  const rooms: FpRoom[] = [];
  const levels: FpLevel[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'level') {
      levels.push(makeLevel({ name: row.name || row.level, elevation: row.x || row.value, description: row.kind }, levels.length));
      return;
    }
    if (type === 'room') {
      rooms.push(makeRoom({ name: row.name || row.room, level: row.level, x: row.x, y: row.y, x2: row.x2, y2: row.y2 }, rooms.length));
      return;
    }
    spaces.push(makeSpace({ name: row.name, kind: row.kind || row.type, level: row.level, x: row.x, y: row.y }, spaces.length));
  });
  const modelName = prettyModelName(fileName, 'FloorPlan');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '1.0', 'm', spaces, rooms, levels, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: FpSourceKind): FpDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'FloorPlan')).trim();
  const keys: string[] = [];
  const spaces: FpSpace[] = [];
  const rooms: FpRoom[] = [];
  const levels: FpLevel[] = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      keys.push(schema[1]);
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const cols = line
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean);
      if (!cols.length) continue;
      if (!keys.length) {
        cols.forEach((p) => keys.push(p));
        continue;
      }
      const row: Record<string, string> = {};
      keys.forEach((k, i) => (row[k] = cols[i] || ''));
      const type = (row.type || '').toLowerCase();
      if (type === 'level') {
        levels.push(makeLevel({ name: row.name, description: row.kind }, levels.length));
        continue;
      }
      if (type === 'room') {
        rooms.push(makeRoom({ name: row.name, level: row.level || 'Ground' }, rooms.length));
        continue;
      }
      spaces.push(makeSpace({ name: row.name, kind: row.kind || row.type, level: row.level || 'Ground' }, spaces.length));
    }
  }
  if (!spaces.length && !rooms.length && !levels.length) throw new Error('Floor plan markdown contains no levels or rooms');
  return finishDataset(name, sourceKind, name, 'UTF-8', '1.0', 'm', spaces, rooms, levels, []);
}

function parseFp01(bytes: Uint8Array, fileName: string): FpDataset {
  if (bytes.length < 8) throw new Error('Floor plan dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('Floor plan dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid FP01 JSON');
  }
  return ingestJson(parsed, fileName, 'plan');
}

export function buildSampleFpBytes(): Uint8Array {
  const json = te.encode(FP_JSON_SAMPLE);
  const out: number[] = [...FP_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleFpJson(): string {
  return FP_JSON_SAMPLE;
}

export function parseFpText(text: string, fileName = ''): FpDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Floor plan dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeFloorPlan(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid floor plan JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (/ISO-10303-21/i.test(raw) && /\bIFC(?:BUILDINGSTOREY|SPACE)\b/i.test(raw)) return parseStepFloor(raw, fileName);
  if (ext === 'ifc' || ext === 'ifcxml' || looksLikeFloorPlan(raw)) return parseAsciiFloor(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsFp(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a floor plan dump');
}

export function parseFpBytes(bytes: Uint8Array, fileName = ''): FpDataset {
  if (!bytes.length) throw new Error('Floor plan dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed floor-plan files are not supported — decompress first');
  if (isFpMagic(bytes)) return parseFp01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('IFCZIP / ZIP plans are not expanded here — export an ASCII dump or JSON');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'ifc' || ext === 'ifcxml') && !isMostlyText(bytes)) {
    throw new Error('Binary IFC plan is not expanded here — export an ASCII dump or JSON');
  }
  return parseFpText(td.decode(bytes), fileName);
}

export function filterFpSpaces(items: FpSpace[], query: string): FpSpace[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('space:') || token.startsWith('name:') || token.startsWith('plan:')) {
        return e.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) {
        return `${e.kind} ${e.drawType}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('level:')) return e.level.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('room:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.kind} ${e.level} ${e.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterFpRooms(items: FpRoom[], query: string): FpRoom[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('room:') || token.startsWith('name:')) {
        return r.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('level:')) return r.level.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('space:') || token.startsWith('type:') || token.startsWith('kind:') || token.startsWith('row:') || token.startsWith('plan:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${r.name} ${r.level}`.toLowerCase().includes(token);
    })
  );
}

export function filterFpLevels(items: FpLevel[], query: string): FpLevel[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((d) =>
    tokens.every((token) => {
      if (token.startsWith('level:') || token.startsWith('name:')) {
        return `${d.name} ${d.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('room:') || token.startsWith('space:') || token.startsWith('row:') || token.startsWith('plan:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${d.name} ${d.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterFpRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('level:') ||
        token.startsWith('room:') ||
        token.startsWith('space:') ||
        token.startsWith('kind:') ||
        token.startsWith('plan:')
      ) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
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
