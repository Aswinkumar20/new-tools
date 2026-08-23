import type { WfColumn, WfDataset, WfEntity, WfEntityType, WfLayer, WfSheet, WfSourceKind } from '../types/dwf-viewer.types';
import { WF_JSON_SAMPLE } from '../constants/dwf-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const WF_MAGIC = new Uint8Array([0x57, 0x46, 0x30, 0x31]); // WF01

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

function isWfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === WF_MAGIC[0] && bytes[1] === WF_MAGIC[1] && bytes[2] === WF_MAGIC[2] && bytes[3] === WF_MAGIC[3];
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isClassicDwf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  const head = td.decode(bytes.subarray(0, Math.min(bytes.length, 16))).trim();
  return /^\(?DWF/i.test(head);
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function entityType(raw: unknown, name: string): WfEntityType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'line' || v === 'circle' || v === 'arc' || v === 'polyline' || v === 'text' || v === 'point' || v === 'markup' || v === 'other') return v;
  if (v === 'lwpolyline') return 'polyline';
  if (v === 'note' || v === 'cloud' || v === 'revision') return 'markup';
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

function makeLayer(name: string, color: number, visible = true, entityCount = 0, index = 0): WfLayer {
  return { id: name, index, name, color, colorHex: aciToHex(color || 7), visible, entityCount };
}

function makeSheet(name: string, width: number, height: number, entityCount = 0, index = 0): WfSheet {
  return { id: name, index, name, width: width || 12, height: height || 8, entityCount };
}

function makeEntity(raw: CadDumpRec, index: number, fallbackSheet: string, fallbackLayer: string): WfEntity {
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
    sheet: asString(raw.sheet || raw.page, fallbackSheet || 'Plan'),
    layer: asString(raw.layer, fallbackLayer || '0'),
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

function finishDataset(
  name: string,
  sourceKind: WfSourceKind,
  title: string,
  encoding: string,
  version: string,
  units: string,
  sheets: WfSheet[],
  layers: WfLayer[],
  entities: WfEntity[],
  warnings: string[]
): WfDataset {
  if (!sheets.length && !layers.length && !entities.length) throw new Error('DWF dump contains no sheets or entities');
  entities.forEach((e, i) => (e.index = i));
  sheets.forEach((s, i) => {
    s.index = i;
    if (!s.entityCount) s.entityCount = entities.filter((e) => e.sheet === s.name).length;
  });
  layers.forEach((l, i) => {
    l.index = i;
    if (!l.entityCount) l.entityCount = entities.filter((e) => e.layer === l.name).length;
  });
  const columns: WfColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'sheet', index: 2, name: 'sheet', type: 'STRING' },
    { id: 'layer', index: 3, name: 'layer', type: 'STRING' }
  ];
  const rows = [
    ...sheets.map((s) => ({ name: s.name, type: 'sheet', sheet: s.name, layer: '' })),
    ...layers.map((l) => ({ name: l.name, type: 'layer', sheet: '', layer: l.name })),
    ...entities.map((e) => ({ name: e.name, type: e.type, sheet: e.sheet, layer: e.layer }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    version: version || '—',
    units: units || 'm',
    sheetCount: sheets.length,
    layerCount: layers.length,
    entityCount: entities.length,
    sheets,
    layers,
    entities,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: WfSourceKind = 'json', warnings: string[] = []): WfDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Publish'));
  const sheetSrc = (Array.isArray(root.sheets) ? root.sheets : Array.isArray(root.pages) ? root.pages : []) as unknown[];
  const layerSrc = (Array.isArray(root.layers) ? root.layers : []) as unknown[];
  const entSrc = (Array.isArray(root.entities) ? root.entities : Array.isArray(root.markups) ? root.markups : []) as unknown[];
  const sheets: WfSheet[] = sheetSrc.map((item, index) => {
    const n = rec(item);
    return makeSheet(asString(n.name, `sheet${index + 1}`), asNumber(n.width, 12), asNumber(n.height, 8), asNumber(n.entityCount), index);
  });
  const layers: WfLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    return makeLayer(asString(n.name, `layer${index + 1}`), asNumber(n.color ?? n.aci, 7), n.visible !== false, asNumber(n.entityCount), index);
  });
  const entities: WfEntity[] = entSrc.map((item, index) => makeEntity(rec(item), index, sheets[0]?.name || 'Plan', layers[0]?.name || '0'));
  if (!sheets.length) {
    const names = [...new Set(entities.map((e) => e.sheet || 'Plan'))];
    names.forEach((sn, i) => sheets.push(makeSheet(sn, 12, 8, 0, i)));
  }
  if (!layers.length) {
    const names = [...new Set(entities.map((e) => e.layer || '0'))];
    names.forEach((ln, i) => layers.push(makeLayer(ln, 7 - (i % 6), true, 0, i)));
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'dwf' || sourceKind === 'dwfx' ? 'binary' : 'UTF-8',
    asString(root.version || root.dwfVer, '6.01'),
    asString(root.units, 'm'),
    sheets,
    layers,
    entities,
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

function parseCsvAsWf(text: string, fileName: string): WfDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('DWF CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const sheets: WfSheet[] = [];
  const layers: WfLayer[] = [];
  const entities: WfEntity[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'sheet' || type === 'page') {
      sheets.push(makeSheet(row.name || row.sheet || `sheet${sheets.length + 1}`, asNumber(row.width, 12), asNumber(row.height, 8), 0, sheets.length));
      return;
    }
    if (type === 'layer') {
      layers.push(makeLayer(row.name || row.layer || `layer${layers.length + 1}`, asNumber(row.color, 7), true, 0, layers.length));
      return;
    }
    entities.push(
      makeEntity(
        {
          name: row.name,
          type: row.type,
          sheet: row.sheet,
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
        row.sheet || 'Plan',
        row.layer || '0'
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Publish');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '6.01', 'm', sheets, layers, entities, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: WfSourceKind): WfDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Publish')).trim();
  const keys: string[] = [];
  const sheets: WfSheet[] = [];
  const layers: WfLayer[] = [];
  const entities: WfEntity[] = [];
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
      if (type === 'sheet' || type === 'page') {
        sheets.push(makeSheet(row.name || row.sheet || `sheet${sheets.length + 1}`, 12, 8, 0, sheets.length));
        continue;
      }
      if (type === 'layer') {
        layers.push(makeLayer(row.name || row.layer || `layer${layers.length + 1}`, 7, true, 0, layers.length));
        continue;
      }
      entities.push(makeEntity({ name: row.name, type: row.type, sheet: row.sheet, layer: row.layer, text: row.text }, entities.length, row.sheet || 'Plan', row.layer || '0'));
    }
  }
  if (!sheets.length && !layers.length && !entities.length) throw new Error('DWF markdown contains no sheets or entities');
  return finishDataset(name, sourceKind, name, 'UTF-8', '6.01', 'm', sheets, layers, entities, []);
}

function parseWf01(bytes: Uint8Array, fileName: string): WfDataset {
  if (bytes.length < 8) throw new Error('DWF dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('DWF dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid WF01 JSON');
  }
  return ingestJson(parsed, fileName, 'dwf');
}

export function buildSampleWfBytes(): Uint8Array {
  const json = te.encode(WF_JSON_SAMPLE);
  const out: number[] = [...WF_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleWfJson(): string {
  return WF_JSON_SAMPLE;
}

export function parseWfText(text: string, fileName = ''): WfDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('DWF dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || looksLikeJson(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid DWF JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsWf(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a DWF dump');
}

export function parseWfBytes(bytes: Uint8Array, fileName = ''): WfDataset {
  if (!bytes.length) throw new Error('DWF dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed DWF files are not supported — decompress first');
  if (isWfMagic(bytes)) return parseWf01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('DWFX/XPS packages are not expanded here — export JSON or load the sample dump');
  if (isClassicDwf(bytes)) throw new Error('Classic W2D DWF is not expanded here — export JSON or load the sample dump');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'dwf' || ext === 'dwfx') && !isMostlyText(bytes)) {
    throw new Error('Not a DWF dump (expected WF01 header or JSON)');
  }
  return parseWfText(td.decode(bytes), fileName);
}

export function filterWfSheets(sheets: WfSheet[], query: string): WfSheet[] {
  const q = query.trim().toLowerCase();
  if (!q) return sheets;
  const tokens = q.split(/\s+/).filter(Boolean);
  return sheets.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('sheet:') || token.startsWith('name:')) return s.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('layer:') || token.startsWith('type:') || token.startsWith('ent:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.width}x${s.height}`.toLowerCase().includes(token);
    })
  );
}

export function filterWfLayers(layers: WfLayer[], query: string): WfLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:')) return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('color:')) return `${l.color} ${l.colorHex}`.toLowerCase().includes(token.slice(6));
      if (token.startsWith('sheet:') || token.startsWith('type:') || token.startsWith('ent:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.colorHex}`.toLowerCase().includes(token);
    })
  );
}

export function filterWfEntities(entities: WfEntity[], query: string): WfEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return entities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return entities.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('ent:') || token.startsWith('name:')) return `${e.name} ${e.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return e.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:')) return e.layer.toLowerCase().includes(token.slice(6));
      if (token.startsWith('sheet:')) return e.sheet.toLowerCase().includes(token.slice(6));
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.type} ${e.sheet} ${e.layer} ${e.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterWfRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('name:') || token.startsWith('type:') || token.startsWith('layer:') || token.startsWith('sheet:') || token.startsWith('ent:')) {
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
