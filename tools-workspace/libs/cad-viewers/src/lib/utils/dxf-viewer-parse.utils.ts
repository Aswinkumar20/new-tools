import type { DxColumn, DxDataset, DxEntity, DxEntityType, DxLayer, DxSourceKind } from '../types/dxf-viewer.types';
import { DX_ASCII_SAMPLE, DX_JSON_SAMPLE } from '../constants/dxf-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

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

function looksLikeDxf(text: string): boolean {
  const t = text.trim();
  return /^0\s*\n(?:SECTION|HEADER|ENTITIES|EOF)/im.test(t) || /\n0\s*\nSECTION\s*\n/i.test(`\n${t}\n`);
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function entityType(raw: unknown, name: string): DxEntityType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'line' || v === 'circle' || v === 'arc' || v === 'lwpolyline' || v === 'text' || v === 'point' || v === 'insert' || v === 'other') return v;
  if (v === 'polyline') return 'lwpolyline';
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

function makeLayer(name: string, color: number, visible = true, entityCount = 0, index = 0): DxLayer {
  return { id: name, index, name, color, colorHex: aciToHex(color || 7), visible, entityCount };
}

function makeEntity(raw: CadDumpRec, index: number, fallbackLayer: string, layerColors: Map<string, string>): DxEntity {
  const name = asString(raw.name || raw.id, `ent${index + 1}`);
  const type = entityType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius);
  const layer = asString(raw.layer, fallbackLayer || '0');
  const length = type === 'line' ? lineLength(x, y, x2, y2) : type === 'circle' ? Number((2 * Math.PI * r).toFixed(3)) : asNumber(raw.length);
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
  sourceKind: DxSourceKind,
  title: string,
  encoding: string,
  acadVer: string,
  units: string,
  layers: DxLayer[],
  entities: DxEntity[],
  warnings: string[]
): DxDataset {
  if (!layers.length && !entities.length) throw new Error('DXF dump contains no layers or entities');
  entities.forEach((e, i) => (e.index = i));
  layers.forEach((l) => {
    if (!l.entityCount) l.entityCount = entities.filter((e) => e.layer === l.name).length;
  });
  const columns: DxColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'layer', index: 2, name: 'layer', type: 'STRING' },
    { id: 'x', index: 3, name: 'x', type: 'NUMBER' },
    { id: 'y', index: 4, name: 'y', type: 'NUMBER' }
  ];
  const rows = entities.map((e) => ({
    name: e.name,
    type: e.type,
    layer: e.layer,
    x: String(e.x),
    y: String(e.y)
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    acadVer: acadVer || '—',
    units: units || 'm',
    layerCount: layers.length,
    entityCount: entities.length,
    layers,
    entities,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: DxSourceKind = 'json', warnings: string[] = []): DxDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Drawing'));
  const layerSrc = (Array.isArray(root.layers) ? root.layers : []) as unknown[];
  const entSrc = (Array.isArray(root.entities) ? root.entities : []) as unknown[];
  const layers: DxLayer[] = layerSrc.map((item, index) => {
    const n = rec(item);
    return makeLayer(asString(n.name, `layer${index + 1}`), asNumber(n.color ?? n.aci, 7), n.visible !== false, asNumber(n.entityCount), index);
  });
  const colors = new Map(layers.map((l) => [l.name, l.colorHex] as const));
  const entities: DxEntity[] = entSrc.map((item, index) => makeEntity(rec(item), index, layers[0]?.name || '0', colors));
  if (!layers.length) {
    const names = [...new Set(entities.map((e) => e.layer || '0'))];
    names.forEach((ln, i) => layers.push(makeLayer(ln, 7 - (i % 6), true, 0, i)));
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'dxf' ? 'ASCII' : 'UTF-8',
    asString(root.acadVer || root.version, 'AC1027'),
    asString(root.units, 'm'),
    layers,
    entities,
    warnings
  );
}

function parseDxfPairs(text: string): Array<{ code: number; value: string }> {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: Array<{ code: number; value: string }> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (!Number.isFinite(code)) continue;
    out.push({ code, value: (lines[i + 1] ?? '').trim() });
  }
  return out;
}

function parseAsciiDxf(text: string, fileName: string): DxDataset {
  const pairs = parseDxfPairs(text);
  if (!pairs.length) throw new Error('DXF file has no group codes');
  let acadVer = 'AC1027';
  let units = 'm';
  const layers: DxLayer[] = [];
  const entities: DxEntity[] = [];
  const layerColors = new Map<string, string>();
  let i = 0;
  let section = '';
  let table = '';
  let currentType = '';
  let recBuf: CadDumpRec = {};
  let points: Array<{ x: number; y: number }> = [];
  const flushEntity = () => {
    if (!currentType) return;
    const type = entityType(currentType, '');
    if (type === 'other' && !['line', 'circle', 'arc', 'lwpolyline', 'polyline', 'text', 'point', 'insert'].includes(currentType.toLowerCase())) {
      recBuf = {};
      points = [];
      currentType = '';
      return;
    }
    if (points.length) recBuf.points = points;
    recBuf.type = currentType.toLowerCase();
    recBuf.name = asString(recBuf.name, asString(recBuf.text, `${currentType.toLowerCase()}${entities.length + 1}`));
    entities.push(makeEntity(recBuf, entities.length, asString(recBuf.layer, '0'), layerColors));
    recBuf = {};
    points = [];
    currentType = '';
  };
  while (i < pairs.length) {
    const { code, value } = pairs[i];
    if (code === 0) {
      if (section === 'ENTITIES') {
        if (value === 'ENDSEC' || value === 'EOF') {
          flushEntity();
          section = '';
          i += 1;
          continue;
        }
        flushEntity();
        currentType = value;
        recBuf = { type: value };
        points = [];
        i += 1;
        continue;
      }
      if (section === 'TABLES' && table === 'LAYER') {
        if (value === 'LAYER') {
          if (asString(recBuf.name)) {
            const layer = makeLayer(asString(recBuf.name), asNumber(recBuf.color, 7), true, 0, layers.length);
            layers.push(layer);
            layerColors.set(layer.name, layer.colorHex);
          }
          recBuf = {};
          i += 1;
          continue;
        }
        if (value === 'ENDTAB') {
          if (asString(recBuf.name)) {
            const layer = makeLayer(asString(recBuf.name), asNumber(recBuf.color, 7), true, 0, layers.length);
            layers.push(layer);
            layerColors.set(layer.name, layer.colorHex);
          }
          recBuf = {};
          table = '';
          i += 1;
          continue;
        }
      }
      if (value === 'SECTION') {
        section = '';
        i += 1;
        continue;
      }
      if (value === 'ENDSEC') {
        section = '';
        i += 1;
        continue;
      }
      if (value === 'TABLE') {
        table = '';
        i += 1;
        continue;
      }
      if (value === 'ENDTAB') {
        table = '';
        i += 1;
        continue;
      }
      if (value === 'EOF') break;
    }
    if (code === 2 && !section && value) {
      section = value.toUpperCase();
      i += 1;
      continue;
    }
    if (code === 2 && section === 'TABLES' && !table) {
      table = value.toUpperCase();
      i += 1;
      continue;
    }
    if (section === 'HEADER' && code === 9 && value === '$ACADVER' && pairs[i + 1]?.code === 1) {
      acadVer = pairs[i + 1].value;
      i += 2;
      continue;
    }
    if (section === 'HEADER' && code === 9 && value === '$INSUNITS' && pairs[i + 1]) {
      const u = Number(pairs[i + 1].value);
      if (u === 1) units = 'in';
      else if (u === 4) units = 'mm';
      else if (u === 5) units = 'cm';
      else if (u === 6) units = 'm';
      i += 2;
      continue;
    }
    if (section === 'TABLES' && table === 'LAYER') {
      if (code === 2) recBuf.name = value;
      if (code === 62) recBuf.color = Number(value);
      if (code === 0 && asString(recBuf.name) && value !== 'LAYER') {
        const layer = makeLayer(asString(recBuf.name), asNumber(recBuf.color, 7), true, 0, layers.length);
        layers.push(layer);
        layerColors.set(layer.name, layer.colorHex);
        recBuf = {};
      }
    }
    if (section === 'ENTITIES' && currentType) {
      if (code === 8) recBuf.layer = value;
      else if (code === 10) {
        recBuf.x = Number(value);
        if (currentType.toUpperCase() === 'LWPOLYLINE' || currentType.toUpperCase() === 'POLYLINE') {
          points.push({ x: Number(value), y: 0 });
        }
      } else if (code === 20) {
        recBuf.y = Number(value);
        if ((currentType.toUpperCase() === 'LWPOLYLINE' || currentType.toUpperCase() === 'POLYLINE') && points.length) {
          points[points.length - 1].y = Number(value);
        }
      } else if (code === 11) recBuf.x2 = Number(value);
      else if (code === 21) recBuf.y2 = Number(value);
      else if (code === 40) recBuf.r = Number(value);
      else if (code === 1) recBuf.text = value;
      else if (code === 62) recBuf.color = Number(value);
      else if (code === 50) recBuf.x2 = Number(value);
      else if (code === 51) recBuf.y2 = Number(value);
    }
    i += 1;
  }
  flushEntity();
  if (!layers.length && !entities.length) throw new Error('DXF contains no layers or entities');
  if (!layers.length) {
    const names = [...new Set(entities.map((e) => e.layer || '0'))];
    names.forEach((ln, idx) => layers.push(makeLayer(ln, 7 - (idx % 6), true, 0, idx)));
  }
  const name = prettyModelName(fileName, 'Drawing');
  return finishDataset(name, 'dxf', name, 'ASCII', acadVer, units, layers, entities, []);
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

function parseCsvAsDx(text: string, fileName: string): DxDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('DXF CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const layers: DxLayer[] = [];
  const entities: DxEntity[] = [];
  const colors = new Map<string, string>();
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'layer') {
      const layer = makeLayer(row.name || row.layer || `layer${layers.length + 1}`, asNumber(row.color, 7), true, 0, layers.length);
      layers.push(layer);
      colors.set(layer.name, layer.colorHex);
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
        row.layer || '0',
        colors
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Drawing');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'AC1027', 'm', layers, entities, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: DxSourceKind): DxDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Drawing')).trim();
  const keys: string[] = [];
  const layers: DxLayer[] = [];
  const entities: DxEntity[] = [];
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
        const layer = makeLayer(row.name || row.layer || `layer${layers.length + 1}`, 7, true, 0, layers.length);
        layers.push(layer);
        colors.set(layer.name, layer.colorHex);
        continue;
      }
      entities.push(makeEntity({ name: row.name, type: row.type, layer: row.layer, text: row.text }, entities.length, row.layer || '0', colors));
    }
  }
  if (!layers.length && !entities.length) throw new Error('DXF markdown contains no layers or entities');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'AC1027', 'm', layers, entities, []);
}

export function buildSampleDxBytes(): Uint8Array {
  return te.encode(DX_ASCII_SAMPLE);
}

export function buildSampleDxJson(): string {
  return DX_JSON_SAMPLE;
}

export function parseDxText(text: string, fileName = ''): DxDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('DXF dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeDxf(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid DXF JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'dxf' || looksLikeDxf(raw)) return parseAsciiDxf(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsDx(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a DXF dump');
}

export function parseDxBytes(bytes: Uint8Array, fileName = ''): DxDataset {
  if (!bytes.length) throw new Error('DXF dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed DXF files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'dxf' && !isMostlyText(bytes)) {
    throw new Error('Not an ASCII DXF file (binary DXF is not expanded — export ASCII DXF or JSON)');
  }
  return parseDxText(td.decode(bytes), fileName);
}

export function filterDxLayers(layers: DxLayer[], query: string): DxLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  const tokens = q.split(/\s+/).filter(Boolean);
  return layers.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:')) return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('color:')) return `${l.color} ${l.colorHex}`.toLowerCase().includes(token.slice(6));
      if (token.startsWith('type:') || token.startsWith('ent:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.colorHex}`.toLowerCase().includes(token);
    })
  );
}

export function filterDxEntities(entities: DxEntity[], query: string): DxEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return entities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return entities.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('ent:') || token.startsWith('name:')) return `${e.name} ${e.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return e.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('layer:')) return e.layer.toLowerCase().includes(token.slice(6));
      if (token.startsWith('color:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.type} ${e.layer} ${e.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterDxRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('name:') || token.startsWith('type:') || token.startsWith('layer:') || token.startsWith('ent:')) {
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
