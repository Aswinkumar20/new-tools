import type {
  StColumn,
  StDataset,
  StMeasurement,
  StMeasureType,
  StProduct,
  StSolid,
  StSolidKind,
  StSourceKind
} from '../types/step-viewer.types';
import { ST_JSON_SAMPLE } from '../constants/step-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const ST_MAGIC = new Uint8Array([0x53, 0x54, 0x30, 0x31]); // ST01
const ST_COLORS = ['#60a5fa', '#38bdf8', '#34d399', '#fbbf24', '#c4b5fd', '#fb7185'];

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

function looksLikeStep(text: string): boolean {
  return /^\s*ISO-10303-21\s*;/i.test(text) || /\bEND-ISO-10303-21\s*;/i.test(text);
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isStMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === ST_MAGIC[0] && bytes[1] === ST_MAGIC[1] && bytes[2] === ST_MAGIC[2] && bytes[3] === ST_MAGIC[3];
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function solidKind(raw: unknown): StSolidKind {
  const v = asString(raw).toLowerCase();
  if (v === 'box' || v === 'block' || v === 'cube') return 'box';
  if (v === 'cylinder' || v === 'cyl') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'plane' || v === 'face') return 'plane';
  return 'other';
}

function measureType(raw: unknown): StMeasureType {
  const v = asString(raw).toLowerCase();
  if (v === 'distance' || v === 'angle' || v === 'volume') return v;
  return 'distance';
}

function solidVolume(kind: StSolidKind, sx: number, sy: number, sz: number, r: number, h: number): number {
  if (kind === 'cylinder') return Number((Math.PI * r * r * (h || sz || 1)).toFixed(4));
  if (kind === 'sphere') return Number(((4 / 3) * Math.PI * r * r * r).toFixed(4));
  return Number((Math.max(0, sx) * Math.max(0, sy) * Math.max(0, sz || h)).toFixed(4));
}

function makeSolid(raw: CadDumpRec, index: number): StSolid {
  const name = asString(raw.name || raw.id, `solid${index + 1}`);
  const kind = solidKind(raw.kind || raw.type || raw.shape);
  const sx = asNumber(raw.sx ?? raw.width ?? raw.dx, kind === 'box' ? 1 : 0);
  const sy = asNumber(raw.sy ?? raw.depth ?? raw.dy, kind === 'box' ? 1 : 0);
  const sz = asNumber(raw.sz ?? raw.height ?? raw.dz, kind === 'box' ? 1 : 0);
  const r = asNumber(raw.r ?? raw.radius, kind === 'cylinder' || kind === 'sphere' ? 0.35 : 0);
  const h = asNumber(raw.h ?? raw.height, kind === 'cylinder' ? 1 : sz);
  return {
    id: name,
    index,
    name,
    kind,
    colorHex: asString(raw.colorHex) || ST_COLORS[index % ST_COLORS.length],
    cx: asNumber(raw.cx ?? raw.x),
    cy: asNumber(raw.cy ?? raw.y),
    cz: asNumber(raw.cz ?? raw.z),
    sx,
    sy,
    sz,
    r,
    h,
    volume: asNumber(raw.volume, solidVolume(kind, sx, sy, sz, r, h))
  };
}

function makeProduct(raw: CadDumpRec, index: number): StProduct {
  const name = asString(raw.name || raw.id, `product${index + 1}`);
  return { id: name, index, name, description: asString(raw.description || raw.desc) };
}

function makeMeas(raw: CadDumpRec, index: number): StMeasurement {
  const name = asString(raw.name || raw.id, `meas${index + 1}`);
  const value = asNumber(raw.value ?? raw.length);
  const unit = asString(raw.unit, 'm');
  return {
    id: name,
    index,
    name,
    type: measureType(raw.type || raw.kind),
    value,
    unit,
    label: asString(raw.label, `${value} ${unit}`)
  };
}

function finishDataset(
  name: string,
  sourceKind: StSourceKind,
  title: string,
  encoding: string,
  schema: string,
  units: string,
  products: StProduct[],
  solids: StSolid[],
  measurements: StMeasurement[],
  warnings: string[]
): StDataset {
  if (!products.length && !solids.length && !measurements.length) throw new Error('STEP dump contains no products or solids');
  products.forEach((p, i) => (p.index = i));
  solids.forEach((s, i) => (s.index = i));
  measurements.forEach((m, i) => (m.index = i));
  const columns: StColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'kind', index: 2, name: 'kind', type: 'STRING' },
    { id: 'value', index: 3, name: 'value', type: 'NUMBER' }
  ];
  const rows = [
    ...products.map((p) => ({ name: p.name, type: 'product', kind: p.description || 'product', value: '' })),
    ...solids.map((s) => ({ name: s.name, type: 'solid', kind: s.kind, value: String(s.volume) })),
    ...measurements.map((m) => ({ name: m.name, type: m.type, kind: 'measure', value: String(m.value) }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    schema: schema || '—',
    units: units || 'm',
    productCount: products.length,
    solidCount: solids.length,
    measurementCount: measurements.length,
    products,
    solids,
    measurements,
    columns,
    rows,
    warnings
  };
}

function inferMeasurements(solids: StSolid[], units: string): StMeasurement[] {
  const out: StMeasurement[] = [];
  const slab = solids.find((s) => s.kind === 'box' && s.sx >= s.sy);
  if (slab) out.push({ id: 'span-x', index: 0, name: 'span-x', type: 'distance', value: Number(slab.sx.toFixed(3)), unit: units, label: `${slab.sx} ${units} width` });
  const cyl = solids.find((s) => s.kind === 'cylinder');
  if (cyl) out.push({ id: 'cyl-h', index: out.length, name: `${cyl.name}-h`, type: 'distance', value: Number((cyl.h || cyl.sz).toFixed(3)), unit: units, label: `${cyl.h || cyl.sz} ${units} height` });
  return out;
}

function ingestJson(raw: unknown, fileName: string, sourceKind: StSourceKind = 'json', warnings: string[] = []): StDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Part'));
  const products = ((Array.isArray(root.products) ? root.products : []) as unknown[]).map((item, i) => makeProduct(rec(item), i));
  const solids = ((Array.isArray(root.solids) ? root.solids : Array.isArray(root.shapes) ? root.shapes : []) as unknown[]).map((item, i) =>
    makeSolid(rec(item), i)
  );
  let measurements = ((Array.isArray(root.measurements) ? root.measurements : []) as unknown[]).map((item, i) => makeMeas(rec(item), i));
  if (!measurements.length) measurements = inferMeasurements(solids, asString(root.units, 'm'));
  if (!products.length && solids.length) products.push(makeProduct({ name }, 0));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'step' ? 'ASCII' : 'UTF-8',
    asString(root.schema || root.fileSchema, 'AUTOMOTIVE_DESIGN'),
    asString(root.units, 'm'),
    products,
    solids,
    measurements,
    warnings
  );
}

function parseAsciiStep(text: string, fileName: string): StDataset {
  const schema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i.exec(text)?.[1] || 'AUTOMOTIVE_DESIGN';
  const fileDesc = /FILE_DESCRIPTION\s*\(\s*\(\s*'([^']*)'/i.exec(text)?.[1] || '';
  const name = prettyModelName(fileName, fileDesc || 'Part');
  const products: StProduct[] = [];
  const productRe = /PRODUCT\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'/gi;
  let m: RegExpExecArray | null;
  while ((m = productRe.exec(text))) {
    products.push(makeProduct({ name: m[1] || m[2], description: m[3] || m[2] }, products.length));
  }
  const solids: StSolid[] = [];
  const brepRe = /MANIFOLD_SOLID_BREP\s*\(\s*'([^']*)'/gi;
  while ((m = brepRe.exec(text))) {
    solids.push(makeSolid({ name: m[1] || `solid${solids.length + 1}`, kind: 'box', cx: 2 + solids.length * 3, cy: 2, cz: 0.5, sx: 2, sy: 1.2, sz: 1 }, solids.length));
  }
  const points: Array<{ x: number; y: number; z: number }> = [];
  const ptRe = /CARTESIAN_POINT\s*\(\s*'[^']*'\s*,\s*\(\s*([-\d.eE]+)\s*,\s*([-\d.eE]+)\s*,\s*([-\d.eE]+)/gi;
  while ((m = ptRe.exec(text))) {
    points.push({ x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) });
  }
  if (points.length >= 2) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const zs = points.map((p) => p.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const bbox = makeSolid(
      {
        name: 'bbox',
        kind: 'box',
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        cz: (minZ + maxZ) / 2,
        sx: Math.max(0.1, maxX - minX),
        sy: Math.max(0.1, maxY - minY),
        sz: Math.max(0.1, maxZ - minZ)
      },
      solids.length
    );
    if (!solids.some((s) => s.name === 'bbox')) solids.unshift(bbox);
  }
  if (!products.length) products.push(makeProduct({ name }, 0));
  if (!solids.length) throw new Error('STEP file has no solids or cartesian points');
  const warnings = ['ASCII STEP is a metadata subset — tessellation uses dump solids or a bounding box.'];
  return finishDataset(name, 'step', name, 'ASCII', schema, 'm', products, solids, inferMeasurements(solids, 'm'), warnings);
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

function parseCsvAsSt(text: string, fileName: string): StDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('STEP CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const products: StProduct[] = [];
  const solids: StSolid[] = [];
  const measurements: StMeasurement[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'product') {
      products.push(makeProduct({ name: row.name, description: row.kind || row.description }, products.length));
      return;
    }
    if (type === 'distance' || type === 'angle' || type === 'volume' || type === 'measurement') {
      measurements.push(makeMeas({ name: row.name, type, value: row.value || row.h || row.sx, unit: row.unit || 'm' }, measurements.length));
      return;
    }
    solids.push(
      makeSolid(
        {
          name: row.name,
          kind: row.kind || row.type,
          cx: row.cx,
          cy: row.cy,
          cz: row.cz,
          sx: row.sx,
          sy: row.sy,
          sz: row.sz,
          r: row.r,
          h: row.h
        },
        index
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Part');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'AUTOMOTIVE_DESIGN', 'm', products, solids, measurements.length ? measurements : inferMeasurements(solids, 'm'), []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: StSourceKind): StDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Part')).trim();
  const keys: string[] = [];
  const products: StProduct[] = [];
  const solids: StSolid[] = [];
  const measurements: StMeasurement[] = [];
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
      if (type === 'product') {
        products.push(makeProduct({ name: row.name, description: row.kind }, products.length));
        continue;
      }
      if (type === 'distance' || type === 'angle' || type === 'volume' || type === 'measurement') {
        measurements.push(makeMeas({ name: row.name, type, value: row.value }, measurements.length));
        continue;
      }
      solids.push(makeSolid({ name: row.name, kind: row.kind || row.type }, solids.length));
    }
  }
  if (!products.length && !solids.length && !measurements.length) throw new Error('STEP markdown contains no products or solids');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'AUTOMOTIVE_DESIGN', 'm', products, solids, measurements.length ? measurements : inferMeasurements(solids, 'm'), []);
}

function parseSt01(bytes: Uint8Array, fileName: string): StDataset {
  if (bytes.length < 8) throw new Error('STEP dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('STEP dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid ST01 JSON');
  }
  return ingestJson(parsed, fileName, 'step');
}

export function buildSampleStBytes(): Uint8Array {
  const json = te.encode(ST_JSON_SAMPLE);
  const out: number[] = [...ST_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleStJson(): string {
  return ST_JSON_SAMPLE;
}

export function parseStText(text: string, fileName = ''): StDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('STEP dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeStep(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid STEP JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'step' || ext === 'stp' || looksLikeStep(raw)) return parseAsciiStep(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsSt(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a STEP dump');
}

export function parseStBytes(bytes: Uint8Array, fileName = ''): StDataset {
  if (!bytes.length) throw new Error('STEP dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed STEP files are not supported — decompress first');
  if (isStMagic(bytes)) return parseSt01(bytes, fileName);
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'step' || ext === 'stp') && !isMostlyText(bytes)) {
    throw new Error('Binary STEP is not expanded here — export ASCII STEP or JSON dump');
  }
  return parseStText(td.decode(bytes), fileName);
}

export function filterStSolids(solids: StSolid[], query: string): StSolid[] {
  const q = query.trim().toLowerCase();
  if (!q) return solids;
  const tokens = q.split(/\s+/).filter(Boolean);
  return solids.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('solid:') || token.startsWith('name:')) return s.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('kind:')) return s.kind.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('meas:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterStMeasurements(items: StMeasurement[], query: string): StMeasurement[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((m) =>
    tokens.every((token) => {
      if (token.startsWith('meas:') || token.startsWith('name:')) return `${m.name} ${m.label}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return m.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('solid:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${m.name} ${m.type} ${m.label} ${m.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterStRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('name:') || token.startsWith('type:') || token.startsWith('kind:') || token.startsWith('solid:') || token.startsWith('meas:')) {
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
