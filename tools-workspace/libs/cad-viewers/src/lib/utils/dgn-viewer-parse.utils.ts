import type { DgCivil, DgCivilType, DgColumn, DgDataset, DgEntity, DgEntityType, DgLayer, DgSourceKind } from '../types/dgn-viewer.types';
import { DG_JSON_SAMPLE } from '../constants/dgn-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const DG_MAGIC = new Uint8Array([0x44, 0x47, 0x30, 0x31]); // DG01

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

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isDgMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === DG_MAGIC[0] && bytes[1] === DG_MAGIC[1] && bytes[2] === DG_MAGIC[2] && bytes[3] === DG_MAGIC[3];
}

function isOleMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function entityType(raw: unknown, name: string): DgEntityType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'line' || v === 'circle' || v === 'arc' || v === 'polyline' || v === 'text' || v === 'point' || v === 'cell' || v === 'other') return v;
  if (v === 'lwpolyline') return 'polyline';
  return 'other';
}

function civilType(raw: unknown): DgCivilType {
  const v = asString(raw).toLowerCase();
  if (v === 'alignment' || v === 'contour' || v === 'station' || v === 'parcel') return v;
  if (v === 'align') return 'alignment';
  return 'alignment';
}

function isCivilType(raw: unknown): boolean {
  const v = asString(raw).toLowerCase();
  return v === 'alignment' || v === 'align' || v === 'contour' || v === 'station' || v === 'parcel';
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
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += lineLength(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
  return Number(sum.toFixed(3));
}

function makeLayer(name: string, color: number, visible = true, entityCount = 0, index = 0): DgLayer {
  return { id: name, index, name, color, colorHex: aciToHex(color || 7), visible, entityCount };
}

function makeEntity(raw: CadDumpRec, index: number, fallbackLevel: string): DgEntity {
  const name = asString(raw.name || raw.id, `ent${index + 1}`);
  const type = entityType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius);
  const length = type === 'line' ? lineLength(x, y, x2, y2) : type === 'circle' ? Number((2 * Math.PI * r).toFixed(3)) : asNumber(raw.length);
  return {
    id: name,
    index,
    name,
    type,
    level: asString(raw.level || raw.layer, fallbackLevel || 'Default'),
    colorHex: asString(raw.colorHex) || aciToHex(asNumber(raw.color, 7)),
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

function makeCivil(raw: CadDumpRec, index: number, fallbackLevel: string): DgCivil {
  const name = asString(raw.name || raw.id, `civil${index + 1}`);
  const type = civilType(raw.type || raw.kind);
  const points = asPoints(raw.points);
  if (!points.length) {
    const x = asNumber(raw.x);
    const y = asNumber(raw.y);
    const x2 = asNumber(raw.x2);
    const y2 = asNumber(raw.y2);
    if (x || y || x2 || y2) {
      points.push({ x, y });
      if (x2 || y2) points.push({ x: x2, y: y2 });
    }
  }
  const length = asNumber(raw.length, polyLength(points));
  return {
    id: name,
    index,
    name,
    type,
    level: asString(raw.level || raw.layer, fallbackLevel || 'CIVIL'),
    elevation: asNumber(raw.elevation ?? raw.z ?? raw.elev),
    length,
    label: asString(raw.label || raw.text, name),
    points
  };
}

function finishDataset(
  name: string,
  sourceKind: DgSourceKind,
  title: string,
  encoding: string,
  version: string,
  units: string,
  layers: DgLayer[],
  entities: DgEntity[],
  civil: DgCivil[],
  warnings: string[]
): DgDataset {
  if (!layers.length && !entities.length && !civil.length) throw new Error('DGN dump contains no levels or entities');
  entities.forEach((e, i) => (e.index = i));
  civil.forEach((c, i) => (c.index = i));
  layers.forEach((l, i) => {
    l.index = i;
    if (!l.entityCount) {
      l.entityCount = entities.filter((e) => e.level === l.name).length + civil.filter((c) => c.level === l.name).length;
    }
  });
  const columns: DgColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'level', index: 2, name: 'level', type: 'STRING' },
    { id: 'x', index: 3, name: 'x', type: 'NUMBER' },
    { id: 'y', index: 4, name: 'y', type: 'NUMBER' }
  ];
  const rows = [
    ...layers.map((l) => ({ name: l.name, type: 'level', level: l.name, x: '', y: '' })),
    ...entities.map((e) => ({ name: e.name, type: e.type, level: e.level, x: String(e.x), y: String(e.y) })),
    ...civil.map((c) => ({ name: c.name, type: c.type, level: c.level, x: String(c.points[0]?.x ?? ''), y: String(c.points[0]?.y ?? '') }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    version: version || '—',
    units: units || 'm',
    layerCount: layers.length,
    entityCount: entities.length,
    civilCount: civil.length,
    layers,
    entities,
    civil,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: DgSourceKind = 'json', warnings: string[] = []): DgDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Design'));
  const layerSrc = (Array.isArray(root.levels) ? root.levels : Array.isArray(root.layers) ? root.layers : []) as unknown[];
  const entSrc = (Array.isArray(root.entities) ? root.entities : []) as unknown[];
  const civilSrc = (Array.isArray(root.civil) ? root.civil : Array.isArray(root.alignments) ? root.alignments : []) as unknown[];
  const layers: DgLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    return makeLayer(asString(n.name, `level${index + 1}`), asNumber(n.color ?? n.aci, 7), n.visible !== false, asNumber(n.entityCount), index);
  });
  const entities: DgEntity[] = entSrc.map((item, index) => makeEntity(rec(item), index, layers[0]?.name || 'Default'));
  const civil: DgCivil[] = civilSrc.map((item, index) => makeCivil(rec(item), index, 'CIVIL'));
  if (!layers.length) {
    const names = [...new Set([...entities.map((e) => e.level || 'Default'), ...civil.map((c) => c.level || 'CIVIL')])];
    names.forEach((ln, i) => layers.push(makeLayer(ln, 7 - (i % 6), true, 0, i)));
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'dgn' ? 'binary' : 'UTF-8',
    asString(root.version || root.dgnVer, 'V8'),
    asString(root.units, 'm'),
    layers,
    entities,
    civil,
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

function parseCsvAsDg(text: string, fileName: string): DgDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('DGN CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: DgLayer[] = [];
  const entities: DgEntity[] = [];
  const civil: DgCivil[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'level' || type === 'layer') {
      layers.push(makeLayer(row.name || row.level || row.layer || `level${layers.length + 1}`, asNumber(row.color, 7), true, 0, layers.length));
      return;
    }
    if (isCivilType(type)) {
      civil.push(
        makeCivil(
          {
            name: row.name,
            type: row.type,
            level: row.level || row.layer,
            x: row.x,
            y: row.y,
            x2: row.x2,
            y2: row.y2,
            text: row.text,
            label: row.text,
            elevation: row.elevation
          },
          civil.length,
          row.level || 'CIVIL'
        )
      );
      return;
    }
    entities.push(
      makeEntity(
        {
          name: row.name,
          type: row.type,
          level: row.level || row.layer,
          x: row.x,
          y: row.y,
          x2: row.x2,
          y2: row.y2,
          r: row.r,
          text: row.text,
          color: row.color
        },
        index,
        row.level || row.layer || 'Default'
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Design');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'V8', 'm', layers, entities, civil, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: DgSourceKind): DgDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Design')).trim();
  const keys: string[] = [];
  const layers: DgLayer[] = [];
  const entities: DgEntity[] = [];
  const civil: DgCivil[] = [];
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
      if (type === 'level' || type === 'layer') {
        layers.push(makeLayer(row.name || row.level || `level${layers.length + 1}`, 7, true, 0, layers.length));
        continue;
      }
      if (isCivilType(type)) {
        civil.push(makeCivil({ name: row.name, type: row.type, level: row.level || row.layer, text: row.text }, civil.length, row.level || 'CIVIL'));
        continue;
      }
      entities.push(makeEntity({ name: row.name, type: row.type, level: row.level || row.layer, text: row.text }, entities.length, row.level || 'Default'));
    }
  }
  if (!layers.length && !entities.length && !civil.length) throw new Error('DGN markdown contains no levels or entities');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'V8', 'm', layers, entities, civil, []);
}

function parseDg01(bytes: Uint8Array, fileName: string): DgDataset {
  if (bytes.length < 8) throw new Error('DGN dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('DGN dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid DG01 JSON');
  }
  return ingestJson(parsed, fileName, 'dgn');
}

export function buildSampleDgBytes(): Uint8Array {
  const json = te.encode(DG_JSON_SAMPLE);
  const out: number[] = [...DG_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleDgJson(): string {
  return DG_JSON_SAMPLE;
}

export function parseDgText(text: string, fileName = ''): DgDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('DGN dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || looksLikeJson(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid DGN JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsDg(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a DGN dump');
}

export function parseDgBytes(bytes: Uint8Array, fileName = ''): DgDataset {
  if (!bytes.length) throw new Error('DGN dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed DGN files are not supported — decompress first');
  if (isDgMagic(bytes)) return parseDg01(bytes, fileName);
  if (isOleMagic(bytes)) throw new Error('DGN V8 compound file is not expanded here — export JSON or load the sample dump');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'dgn' && !isMostlyText(bytes)) {
    throw new Error('Binary DGN is not expanded here — export JSON or load the sample dump');
  }
  return parseDgText(td.decode(bytes), fileName);
}

export function filterDgLayers(layers: DgLayer[], query: string): DgLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('level:') || token.startsWith('layer:') || token.startsWith('name:')) {
        return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('color:')) return `${l.color} ${l.colorHex}`.toLowerCase().includes(token.slice(6));
      if (token.startsWith('type:') || token.startsWith('civil:') || token.startsWith('ent:') || token.startsWith('row:') || token.startsWith('elev:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.colorHex}`.toLowerCase().includes(token);
    })
  );
}

export function filterDgCivil(items: DgCivil[], query: string): DgCivil[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('civil:') || token.startsWith('name:')) return `${c.name} ${c.label}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return c.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('level:') || token.startsWith('layer:')) return c.level.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('elev:')) return String(c.elevation).includes(token.slice(5));
      if (token.startsWith('ent:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.name} ${c.type} ${c.level} ${c.label} ${c.elevation}`.toLowerCase().includes(token);
    })
  );
}

export function filterDgEntities(entities: DgEntity[], query: string): DgEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return entities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return entities.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('ent:') || token.startsWith('name:')) return `${e.name} ${e.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return e.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('level:') || token.startsWith('layer:')) return e.level.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('civil:') || token.startsWith('elev:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.type} ${e.level} ${e.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterDgRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('name:') || token.startsWith('type:') || token.startsWith('level:') || token.startsWith('layer:') || token.startsWith('ent:') || token.startsWith('civil:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('elev:')) return true;
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
