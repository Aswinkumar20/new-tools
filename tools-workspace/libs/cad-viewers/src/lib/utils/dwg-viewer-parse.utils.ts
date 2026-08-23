import type {
  DwColumn,
  DwDataset,
  DwEntity,
  DwEntityType,
  DwLayer,
  DwMeasurement,
  DwMeasureType,
  DwSourceKind
} from '../types/dwg-viewer.types';
import { DW_JSON_SAMPLE } from '../constants/dwg-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const DW_MAGIC = new Uint8Array([0x44, 0x57, 0x30, 0x31]); // DW01

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

function isDwMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === DW_MAGIC[0] && bytes[1] === DW_MAGIC[1] && bytes[2] === DW_MAGIC[2] && bytes[3] === DW_MAGIC[3];
}

function dwgVersion(bytes: Uint8Array): string | null {
  if (bytes.length < 6) return null;
  const head = td.decode(bytes.subarray(0, 6));
  return /^AC10\d{2}$/.test(head) ? head : null;
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function entityType(raw: unknown, name: string): DwEntityType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'line' || v === 'circle' || v === 'arc' || v === 'polyline' || v === 'text' || v === 'point' || v === 'insert' || v === 'other') return v;
  if (v === 'lwpolyline') return 'polyline';
  return 'other';
}

function measureType(raw: unknown): DwMeasureType {
  const v = asString(raw).toLowerCase();
  if (v === 'distance' || v === 'angle' || v === 'area') return v;
  return 'distance';
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

function inferMeasurements(entities: DwEntity[], unit: string): DwMeasurement[] {
  const lines = entities.filter((e) => e.type === 'line' && e.length > 0);
  return lines.slice(0, 8).map((e, i) => ({
    id: `meas-${e.id}`,
    index: i,
    name: `${e.name}-len`,
    type: 'distance' as const,
    layer: e.layer,
    value: Number(e.length.toFixed(3)),
    unit,
    label: `${e.length.toFixed(2)} ${unit}`
  }));
}

function finishDataset(
  name: string,
  sourceKind: DwSourceKind,
  title: string,
  encoding: string,
  version: string,
  units: string,
  layers: DwLayer[],
  entities: DwEntity[],
  measurements: DwMeasurement[],
  warnings: string[]
): DwDataset {
  if (!layers.length && !entities.length && !measurements.length) throw new Error('DWG dump contains no layers or entities');
  entities.forEach((e, i) => (e.index = i));
  measurements.forEach((m, i) => (m.index = i));
  layers.forEach((l) => {
    if (!l.entityCount) l.entityCount = entities.filter((e) => e.layer === l.name).length;
  });
  const columns: DwColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'layer', index: 2, name: 'layer', type: 'STRING' },
    { id: 'length', index: 3, name: 'length', type: 'NUMBER' }
  ];
  const rows = [...layers.map((l) => ({ name: l.name, type: 'layer', layer: l.name, length: String(l.entityCount) })), ...entities.map((e) => ({ name: e.name, type: e.type, layer: e.layer, length: String(e.length || '') }))];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    version: version || '—',
    units: units || 'm',
    layerCount: layers.length,
    entityCount: entities.length,
    measurementCount: measurements.length,
    layers,
    entities,
    measurements,
    columns,
    rows,
    warnings
  };
}

function makeLayer(name: string, color: number, visible = true, entityCount = 0, index = 0): DwLayer {
  return { id: name, index, name, color, colorHex: aciToHex(color || 7), visible, entityCount };
}

function makeEntity(raw: CadDumpRec, index: number, fallbackLayer: string): DwEntity {
  const name = asString(raw.name || raw.id, `ent${index + 1}`);
  const type = entityType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius);
  const length = type === 'line' ? lineLength(x, y, x2, y2) : type === 'circle' ? Number((2 * Math.PI * r).toFixed(3)) : asNumber(raw.length);
  const layer = asString(raw.layer, fallbackLayer || '0');
  const color = asNumber(raw.color, 0);
  return {
    id: name,
    index,
    name,
    type,
    layer,
    colorHex: asString(raw.colorHex) || aciToHex(color || 7),
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

function ingestJson(raw: unknown, fileName: string, sourceKind: DwSourceKind = 'json', warnings: string[] = []): DwDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Drawing'));
  const units = asString(root.units || root.unit, 'm');
  const layerSrc = (Array.isArray(root.layers) ? root.layers : []) as unknown[];
  const entSrc = (Array.isArray(root.entities) ? root.entities : Array.isArray(root.objects) ? root.objects : []) as unknown[];
  const measSrc = (Array.isArray(root.measurements) ? root.measurements : Array.isArray(root.dims) ? root.dims : []) as unknown[];
  const layers: DwLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    return makeLayer(asString(n.name, `layer${index + 1}`), asNumber(n.color ?? n.aci, 7), n.visible !== false, asNumber(n.entityCount), index);
  });
  const entities: DwEntity[] = entSrc.map((item, index) => makeEntity(rec(item), index, layers[0]?.name || '0'));
  if (!layers.length) {
    const names = [...new Set(entities.map((e) => e.layer || '0'))];
    names.forEach((ln, i) => layers.push(makeLayer(ln, 7 - (i % 6), true, 0, i)));
  }
  let measurements: DwMeasurement[] = measSrc.map((item, index) => {
    const m = rec(item);
    return {
      id: asString(m.name, `meas${index + 1}`),
      index,
      name: asString(m.name, `meas${index + 1}`),
      type: measureType(m.type || m.kind),
      layer: asString(m.layer, 'DIMENSIONS'),
      value: asNumber(m.value ?? m.length),
      unit: asString(m.unit, units),
      label: asString(m.label, `${asNumber(m.value)} ${units}`)
    };
  });
  if (!measurements.length) measurements = inferMeasurements(entities, units);
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'dwg' ? 'binary' : 'UTF-8',
    asString(root.version || root.acadVer, 'AC1027'),
    units,
    layers,
    entities,
    measurements,
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

function parseCsvAsDw(text: string, fileName: string): DwDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('DWG CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: DwLayer[] = [];
  const entities: DwEntity[] = [];
  const measurements: DwMeasurement[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'layer') {
      layers.push(makeLayer(row.name || row.layer || `layer${layers.length + 1}`, asNumber(row.color, 7), true, 0, layers.length));
      return;
    }
    if (type === 'distance' || type === 'angle' || type === 'area' || type === 'measurement') {
      measurements.push({
        id: row.name || `meas${measurements.length + 1}`,
        index: measurements.length,
        name: row.name || `meas${measurements.length + 1}`,
        type: measureType(type === 'measurement' ? 'distance' : type),
        layer: row.layer || 'DIMENSIONS',
        value: asNumber(row.value || row.length || row.text),
        unit: row.unit || 'm',
        label: row.text || row.label || row.name || ''
      });
      return;
    }
    entities.push(
      makeEntity(
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
        row.layer || '0'
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Drawing');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'AC1027', 'm', layers, entities, measurements.length ? measurements : inferMeasurements(entities, 'm'), []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: DwSourceKind): DwDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Drawing')).trim();
  const keys: string[] = [];
  const layers: DwLayer[] = [];
  const entities: DwEntity[] = [];
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
        layers.push(makeLayer(row.name || row.layer || `layer${layers.length + 1}`, 7, true, 0, layers.length));
        continue;
      }
      entities.push(makeEntity({ name: row.name, type: row.type, layer: row.layer, text: row.text }, entities.length, row.layer || '0'));
    }
  }
  if (!layers.length && !entities.length) throw new Error('DWG markdown contains no layers or entities');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'AC1027', 'm', layers, entities, inferMeasurements(entities, 'm'), []);
}

function parseDw01(bytes: Uint8Array, fileName: string): DwDataset {
  if (bytes.length < 8) throw new Error('DWG dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('DWG dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid DW01 JSON');
  }
  return ingestJson(parsed, fileName, 'dwg');
}

export function buildSampleDwBytes(): Uint8Array {
  const json = te.encode(DW_JSON_SAMPLE);
  const out: number[] = [...DW_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleDwJson(): string {
  return DW_JSON_SAMPLE;
}

export function parseDwText(text: string, fileName = ''): DwDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('DWG dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || looksLikeJson(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid DWG JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsDw(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a DWG dump');
}

export function parseDwBytes(bytes: Uint8Array, fileName = ''): DwDataset {
  if (!bytes.length) throw new Error('DWG dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed DWG files are not supported — decompress first');
  if (isDwMagic(bytes)) return parseDw01(bytes, fileName);
  const ver = dwgVersion(bytes);
  if (ver) {
    throw new Error(`Binary DWG (${ver}) is not expanded here — export DXF/JSON or load the sample dump`);
  }
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'dwg' && !isMostlyText(bytes)) {
    throw new Error('Not a DWG dump (expected DW01 header or JSON)');
  }
  return parseDwText(td.decode(bytes), fileName);
}

export function filterDwLayers(layers: DwLayer[], query: string): DwLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:')) return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('color:')) return `${l.color} ${l.colorHex}`.toLowerCase().includes(token.slice(6));
      if (token.startsWith('type:') || token.startsWith('ent:') || token.startsWith('meas:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.colorHex}`.toLowerCase().includes(token);
    })
  );
}

export function filterDwMeasurements(items: DwMeasurement[], query: string): DwMeasurement[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((m) =>
    tokens.every((token) => {
      if (token.startsWith('meas:') || token.startsWith('name:')) return `${m.name} ${m.label}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return m.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:') || token.startsWith('ent:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${m.name} ${m.type} ${m.label} ${m.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterDwEntities(entities: DwEntity[], query: string): DwEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return entities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return entities.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('ent:') || token.startsWith('name:')) return e.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return e.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:')) return e.layer.toLowerCase().includes(token.slice(6));
      if (token.startsWith('meas:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.type} ${e.layer} ${e.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterDwRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('name:') || token.startsWith('type:') || token.startsWith('layer:') || token.startsWith('ent:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('meas:') || token.startsWith('color:')) return true;
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
