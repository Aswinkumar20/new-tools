import type {
  PxBody,
  PxColumn,
  PxDataset,
  PxMeasurement,
  PxMeasureType,
  PxSolid,
  PxSolidKind,
  PxSourceKind
} from '../types/parasolid-viewer.types';
import { PX_JSON_SAMPLE } from '../constants/parasolid-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const PX_MAGIC = new Uint8Array([0x50, 0x58, 0x30, 0x31]); // PX01
const PX_COLORS = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#c4b5fd', '#fb7185'];

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

function looksLikeParasolid(text: string): boolean {
  const head = text.slice(0, 480);
  return (
    /\bparasolid\b/i.test(head) ||
    /\bSCHEME\s+PARASOLID\b/i.test(text) ||
    /\bEND_OF_TRANSMIT\b/i.test(text) ||
    /^\s*\*\*\s*Parasolid/im.test(text) ||
    /^\s*PART\s+\S+/m.test(text)
  );
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isPxMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === PX_MAGIC[0] && bytes[1] === PX_MAGIC[1] && bytes[2] === PX_MAGIC[2] && bytes[3] === PX_MAGIC[3];
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

export function pxTransmitKind(fileName: string): 'x_t' | 'x_b' | '' {
  const lower = fileName.toLowerCase();
  if (/\.(?:x_t|xmt_txt|xt)$/i.test(lower)) return 'x_t';
  if (/\.(?:x_b|xmt_bin|xb)$/i.test(lower)) return 'x_b';
  return '';
}

function solidKind(raw: unknown): PxSolidKind {
  const v = asString(raw).toLowerCase();
  if (v === 'box' || v === 'block' || v === 'cube') return 'box';
  if (v === 'cylinder' || v === 'cyl') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'plane' || v === 'face') return 'plane';
  return 'other';
}

function measureType(raw: unknown): PxMeasureType {
  const v = asString(raw).toLowerCase();
  if (v === 'distance' || v === 'angle' || v === 'volume') return v;
  return 'distance';
}

function solidVolume(kind: PxSolidKind, sx: number, sy: number, sz: number, r: number, h: number): number {
  if (kind === 'cylinder') return Number((Math.PI * r * r * (h || sz || 1)).toFixed(4));
  if (kind === 'sphere') return Number(((4 / 3) * Math.PI * r * r * r).toFixed(4));
  return Number((Math.max(0, sx) * Math.max(0, sy) * Math.max(0, sz || h)).toFixed(4));
}

function makeSolid(raw: CadDumpRec, index: number): PxSolid {
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
    colorHex: asString(raw.colorHex) || PX_COLORS[index % PX_COLORS.length],
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

function makeBody(raw: CadDumpRec, index: number): PxBody {
  const name = asString(raw.name || raw.id, `body${index + 1}`);
  return { id: name, index, name, description: asString(raw.description || raw.desc) };
}

function makeMeas(raw: CadDumpRec, index: number): PxMeasurement {
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
  sourceKind: PxSourceKind,
  title: string,
  encoding: string,
  schema: string,
  units: string,
  bodies: PxBody[],
  solids: PxSolid[],
  measurements: PxMeasurement[],
  warnings: string[]
): PxDataset {
  if (!bodies.length && !solids.length && !measurements.length) throw new Error('Parasolid dump contains no bodies or solids');
  bodies.forEach((b, i) => (b.index = i));
  solids.forEach((s, i) => (s.index = i));
  measurements.forEach((m, i) => (m.index = i));
  const columns: PxColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'kind', index: 2, name: 'kind', type: 'STRING' },
    { id: 'value', index: 3, name: 'value', type: 'NUMBER' }
  ];
  const rows = [
    ...bodies.map((b) => ({ name: b.name, type: 'body', kind: b.description || 'body', value: '' })),
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
    bodyCount: bodies.length,
    solidCount: solids.length,
    measurementCount: measurements.length,
    bodies,
    solids,
    measurements,
    columns,
    rows,
    warnings
  };
}

function inferMeasurements(solids: PxSolid[], units: string): PxMeasurement[] {
  const out: PxMeasurement[] = [];
  const slab = solids.find((s) => s.kind === 'box' && s.sx >= s.sy);
  if (slab) out.push({ id: 'span-x', index: 0, name: 'span-x', type: 'distance', value: Number(slab.sx.toFixed(3)), unit: units, label: `${slab.sx} ${units} width` });
  const cyl = solids.find((s) => s.kind === 'cylinder');
  if (cyl) out.push({ id: 'cyl-h', index: out.length, name: `${cyl.name}-h`, type: 'distance', value: Number((cyl.h || cyl.sz).toFixed(3)), unit: units, label: `${cyl.h || cyl.sz} ${units} height` });
  return out;
}

function ingestJson(raw: unknown, fileName: string, sourceKind: PxSourceKind = 'json', warnings: string[] = []): PxDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Part'));
  const bodies = ((Array.isArray(root.bodies) ? root.bodies : Array.isArray(root.parts) ? root.parts : []) as unknown[]).map((item, i) =>
    makeBody(rec(item), i)
  );
  const solids = ((Array.isArray(root.solids) ? root.solids : Array.isArray(root.shapes) ? root.shapes : []) as unknown[]).map((item, i) =>
    makeSolid(rec(item), i)
  );
  let measurements = ((Array.isArray(root.measurements) ? root.measurements : []) as unknown[]).map((item, i) => makeMeas(rec(item), i));
  if (!measurements.length) measurements = inferMeasurements(solids, asString(root.units, 'm'));
  if (!bodies.length && solids.length) bodies.push(makeBody({ name }, 0));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'parasolid' ? 'ASCII' : 'UTF-8',
    asString(root.schema || root.scheme, 'PARASOLID'),
    asString(root.units, 'm'),
    bodies,
    solids,
    measurements,
    warnings
  );
}

function parseAsciiParasolid(text: string, fileName: string): PxDataset {
  const schema = /SCHEME\s+PARASOLID\s+([0-9.]+)/i.exec(text)?.[1] ? `PARASOLID ${/SCHEME\s+PARASOLID\s+([0-9.]+)/i.exec(text)?.[1]}` : 'PARASOLID';
  const name = prettyModelName(fileName, /PART\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || 'Part');
  const bodies: PxBody[] = [];
  const partRe = /\bPART\s+([A-Za-z0-9_-]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = partRe.exec(text))) bodies.push(makeBody({ name: m[1] }, bodies.length));
  const solids: PxSolid[] = [];
  const bodyRe =
    /\bBODY\s+([A-Za-z0-9_-]+)\s+(BOX|CYLINDER|SPHERE|PLANE)\s+([-\d.eE]+)(?:\s+([-\d.eE]+))?(?:\s+([-\d.eE]+))?(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  while ((m = bodyRe.exec(text))) {
    const kind = solidKind(m[2]);
    if (kind === 'cylinder') {
      solids.push(
        makeSolid(
          { name: m[1], kind, r: m[3], h: m[4], cx: m[6], cy: m[7], cz: m[8] },
          solids.length
        )
      );
    } else {
      solids.push(
        makeSolid(
          { name: m[1], kind, sx: m[3], sy: m[4], sz: m[5], cx: m[6], cy: m[7], cz: m[8] },
          solids.length
        )
      );
    }
  }
  if (!bodies.length) bodies.push(makeBody({ name }, 0));
  if (!solids.length) throw new Error('Parasolid file has no BODY solids');
  const warnings = ['ASCII Parasolid XT is a metadata subset — tessellation uses dump solids.'];
  return finishDataset(name, 'parasolid', name, 'ASCII', schema, 'm', bodies, solids, inferMeasurements(solids, 'm'), warnings);
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

function parseCsvAsPx(text: string, fileName: string): PxDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Parasolid CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const bodies: PxBody[] = [];
  const solids: PxSolid[] = [];
  const measurements: PxMeasurement[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'body' || type === 'part' || type === 'product') {
      bodies.push(makeBody({ name: row.name, description: row.kind || row.description }, bodies.length));
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
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'PARASOLID', 'm', bodies, solids, measurements.length ? measurements : inferMeasurements(solids, 'm'), []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: PxSourceKind): PxDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Part')).trim();
  const keys: string[] = [];
  const bodies: PxBody[] = [];
  const solids: PxSolid[] = [];
  const measurements: PxMeasurement[] = [];
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
      if (type === 'body' || type === 'part' || type === 'product') {
        bodies.push(makeBody({ name: row.name, description: row.kind }, bodies.length));
        continue;
      }
      if (type === 'distance' || type === 'angle' || type === 'volume' || type === 'measurement') {
        measurements.push(makeMeas({ name: row.name, type, value: row.value }, measurements.length));
        continue;
      }
      solids.push(makeSolid({ name: row.name, kind: row.kind || row.type }, solids.length));
    }
  }
  if (!bodies.length && !solids.length && !measurements.length) throw new Error('Parasolid markdown contains no bodies or solids');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'PARASOLID', 'm', bodies, solids, measurements.length ? measurements : inferMeasurements(solids, 'm'), []);
}

function parsePx01(bytes: Uint8Array, fileName: string): PxDataset {
  if (bytes.length < 8) throw new Error('Parasolid dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('Parasolid dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid PX01 JSON');
  }
  return ingestJson(parsed, fileName, 'parasolid');
}

export function buildSamplePxBytes(): Uint8Array {
  const json = te.encode(PX_JSON_SAMPLE);
  const out: number[] = [...PX_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSamplePxJson(): string {
  return PX_JSON_SAMPLE;
}

export function parsePxText(text: string, fileName = ''): PxDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Parasolid dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const transmit = pxTransmitKind(fileName);
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeParasolid(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Parasolid JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (transmit === 'x_t' || looksLikeParasolid(raw)) return parseAsciiParasolid(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsPx(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a Parasolid dump');
}

export function parsePxBytes(bytes: Uint8Array, fileName = ''): PxDataset {
  if (!bytes.length) throw new Error('Parasolid dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Parasolid files are not supported — decompress first');
  if (isPxMagic(bytes)) return parsePx01(bytes, fileName);
  const transmit = pxTransmitKind(fileName);
  if (transmit === 'x_b' && !isMostlyText(bytes)) {
    throw new Error('Binary Parasolid (.x_b) is not expanded here — export ASCII .x_t or JSON dump');
  }
  return parsePxText(td.decode(bytes), fileName);
}

export function filterPxSolids(solids: PxSolid[], query: string): PxSolid[] {
  const q = query.trim().toLowerCase();
  if (!q) return solids;
  const tokens = q.split(/\s+/).filter(Boolean);
  return solids.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('solid:') || token.startsWith('name:') || token.startsWith('body:')) {
        return s.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) return s.kind.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('meas:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterPxMeasurements(items: PxMeasurement[], query: string): PxMeasurement[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((m) =>
    tokens.every((token) => {
      if (token.startsWith('meas:') || token.startsWith('name:')) return `${m.name} ${m.label}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return m.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('solid:') || token.startsWith('body:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${m.name} ${m.type} ${m.label} ${m.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterPxRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('kind:') ||
        token.startsWith('solid:') ||
        token.startsWith('body:') ||
        token.startsWith('meas:')
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
