import type { RhLayer, RhColumn, RhDataset, RhInstance, RhSurface, RhSurfaceKind, RhSourceKind } from '../types/rhino-3dm-viewer.types';
import { RH_JSON_SAMPLE } from '../constants/rhino-3dm-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const RH_MAGIC = new Uint8Array([0x52, 0x48, 0x30, 0x31]); // RH01
const RH_COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#38bdf8', '#c4b5fd', '#fbbf24'];

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

function looksLikeRhino(text: string): boolean {
  const head = text.slice(0, 480);
  return (
    /\bRhino\b/i.test(head) ||
    /^\s*SURFACE\s+\S+/m.test(text) ||
    /^\s*LAYER\s+\S+/m.test(text) ||
    /^\s*INSTANCE\s+\S+/m.test(text)
  );
}

function looksLikeOpenNurbs(bytes: Uint8Array): boolean {
  if (bytes.length < 24) return false;
  return /3D Geometry File Format/i.test(td.decode(bytes.subarray(0, 48)));
}

function isOleMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isRhMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === RH_MAGIC[0] && bytes[1] === RH_MAGIC[1] && bytes[2] === RH_MAGIC[2] && bytes[3] === RH_MAGIC[3];
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function partKind(raw: unknown): RhSurfaceKind {
  const v = asString(raw).toLowerCase();
  if (v === 'box' || v === 'block' || v === 'cube') return 'box';
  if (v === 'cylinder' || v === 'cyl') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'plane' || v === 'face') return 'plane';
  return 'other';
}

function partVolume(kind: RhSurfaceKind, sx: number, sy: number, sz: number, r: number, h: number): number {
  if (kind === 'cylinder') return Number((Math.PI * r * r * (h || sz || 1)).toFixed(4));
  if (kind === 'sphere') return Number(((4 / 3) * Math.PI * r * r * r).toFixed(4));
  return Number((Math.max(0, sx) * Math.max(0, sy) * Math.max(0, sz || h)).toFixed(4));
}

function makeSurface(raw: CadDumpRec, index: number): RhSurface {
  const name = asString(raw.name || raw.id, `part${index + 1}`);
  const kind = partKind(raw.kind || raw.type || raw.shape);
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
    colorHex: asString(raw.colorHex) || RH_COLORS[index % RH_COLORS.length],
    cx: asNumber(raw.cx ?? raw.x),
    cy: asNumber(raw.cy ?? raw.y),
    cz: asNumber(raw.cz ?? raw.z),
    sx,
    sy,
    sz,
    r,
    h,
    volume: asNumber(raw.volume, partVolume(kind, sx, sy, sz, r, h))
  };
}

function makeLayer(raw: CadDumpRec, index: number, instanceCount = 0): RhLayer {
  const name = asString(raw.name || raw.id, `assy${index + 1}`);
  return {
    id: name,
    index,
    name,
    description: asString(raw.description || raw.desc),
    instanceCount: asNumber(raw.instanceCount, instanceCount)
  };
}

function makeInstance(raw: CadDumpRec, index: number): RhInstance {
  const name = asString(raw.name || raw.id, `inst${index + 1}`);
  return {
    id: name,
    index,
    name,
    surface: asString(raw.surface || raw.part),
    layer: asString(raw.layer || raw.assembly),
    cx: asNumber(raw.cx ?? raw.x),
    cy: asNumber(raw.cy ?? raw.y),
    cz: asNumber(raw.cz ?? raw.z)
  };
}

function finishDataset(
  name: string,
  sourceKind: RhSourceKind,
  title: string,
  encoding: string,
  version: string,
  units: string,
  parts: RhSurface[],
  assemblies: RhLayer[],
  instances: RhInstance[],
  warnings: string[]
): RhDataset {
  if (!parts.length && !assemblies.length && !instances.length) throw new Error('Rhino dump contains no surfaces or layers');
  parts.forEach((p, i) => (p.index = i));
  instances.forEach((inst, i) => (inst.index = i));
  const counts = new Map<string, number>();
  for (const inst of instances) counts.set(inst.layer, (counts.get(inst.layer) || 0) + 1);
  assemblies.forEach((a, i) => {
    a.index = i;
    a.instanceCount = counts.get(a.name) || a.instanceCount || 0;
  });
  const columns: RhColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'surface', index: 2, name: 'surface', type: 'STRING' },
    { id: 'layer', index: 3, name: 'layer', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...parts.map((p) => ({ name: p.name, type: 'surface', surface: p.name, layer: '', value: p.kind })),
    ...assemblies.map((a) => ({ name: a.name, type: 'layer', surface: '', layer: a.name, value: a.description || String(a.instanceCount) })),
    ...instances.map((inst) => ({
      name: inst.name,
      type: 'instance',
      surface: inst.surface,
      layer: inst.layer,
      value: `${inst.cx},${inst.cy},${inst.cz}`
    }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    version: version || '—',
    units: units || 'm',
    surfaceCount: parts.length,
    layerCount: assemblies.length,
    instanceCount: instances.length,
    surfaces: parts,
    layers: assemblies,
    instances,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: RhSourceKind = 'json', warnings: string[] = []): RhDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Product'));
  const parts = ((Array.isArray(root.surfaces) ? root.surfaces : []) as unknown[]).map((item, i) => makeSurface(rec(item), i));
  const assemblies = ((Array.isArray(root.layers) ? root.layers : Array.isArray(root.products) ? root.products : []) as unknown[]).map(
    (item, i) => makeLayer(rec(item), i)
  );
  const instances = ((Array.isArray(root.instances) ? root.instances : []) as unknown[]).map((item, i) => makeInstance(rec(item), i));
  if (!assemblies.length && instances.length) {
    const names = [...new Set(instances.map((inst) => inst.layer).filter(Boolean))];
    names.forEach((n, i) => assemblies.push(makeLayer({ name: n }, i)));
  }
  if (!assemblies.length && parts.length) assemblies.push(makeLayer({ name }, 0));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'rhino' ? 'ASCII' : 'UTF-8',
    asString(root.version, '8.0'),
    asString(root.units, 'm'),
    parts,
    assemblies,
    instances,
    warnings
  );
}

function parseAsciiRhino(text: string, fileName: string): RhDataset {
  const version = /Rhino dump \S+ ([\d.]+)/i.exec(text)?.[1] || /LAYER\s+\S+\s+(V[\w.]+)/i.exec(text)?.[1] || '8.0';
  const productName = /LAYER\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'Product');
  const name = prettyModelName(fileName, productName);
  const parts: RhSurface[] = [];
  const assemblies: RhLayer[] = [];
  const instances: RhInstance[] = [];
  if (productName) assemblies.push(makeLayer({ name: productName, description: 'layer' }, 0));
  const partRe =
    /\bSURFACE\s+([A-Za-z0-9_-]+)\s+(BOX|CYLINDER|SPHERE|PLANE)\s+([-\d.eE]+)(?:\s+([-\d.eE]+))?(?:\s+([-\d.eE]+))?(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = partRe.exec(text))) {
    const kind = partKind(m[2]);
    if (kind === 'cylinder') {
      parts.push(makeSurface({ name: m[1], kind, r: m[3], h: m[4], cx: m[6], cy: m[7], cz: m[8] }, parts.length));
    } else {
      parts.push(makeSurface({ name: m[1], kind, sx: m[3], sy: m[4], sz: m[5], cx: m[6], cy: m[7], cz: m[8] }, parts.length));
    }
  }
  const prodRe = /\b(?:LAYER|ASSEMBLY)\s+([A-Za-z0-9_-]+)/gi;
  while ((m = prodRe.exec(text))) {
    const matchName = m?.[1] ?? '';
    if (matchName && !assemblies.some((a) => a.name === matchName)) assemblies.push(makeLayer({ name: matchName, description: 'layer' }, assemblies.length));
  }
  const instRe =
    /\bINSTANCE\s+([A-Za-z0-9_-]+)\s+SURFACE\s+([A-Za-z0-9_-]+)\s+IN\s+([A-Za-z0-9_-]+)(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  while ((m = instRe.exec(text))) {
    instances.push(makeInstance({ name: m[1], surface: m[2], layer: m[3], cx: m[4], cy: m[5], cz: m[6] }, instances.length));
  }
  if (!parts.length && !assemblies.length) throw new Error('Rhino dump has no SURFACE or LAYER entries');
  const warnings = ['ASCII Rhino dump is a metadata subset — tessellation uses dump parts and instances.'];
  return finishDataset(name, 'rhino', name, 'ASCII', version, 'm', parts, assemblies, instances, warnings);
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

function parseCsvAsRh(text: string, fileName: string): RhDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Rhino CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const parts: RhSurface[] = [];
  const assemblies: RhLayer[] = [];
  const instances: RhInstance[] = [];
  lines.slice(1).forEach((line, index) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'layer') {
      assemblies.push(makeLayer({ name: row.name, description: row.kind || row.description }, assemblies.length));
      return;
    }
    if (type === 'instance') {
      instances.push(
        makeInstance(
          { name: row.name, surface: row.surface || row.kind, layer: row.layer, cx: row.cx, cy: row.cy, cz: row.cz },
          instances.length
        )
      );
      return;
    }
    parts.push(
      makeSurface(
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
  const modelName = prettyModelName(fileName, 'Product');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '8.0', 'm', parts, assemblies, instances, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: RhSourceKind): RhDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Product')).trim();
  const keys: string[] = [];
  const parts: RhSurface[] = [];
  const assemblies: RhLayer[] = [];
  const instances: RhInstance[] = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      keys.push(schema[1]);
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const cols = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (!cols.length) continue;
      if (!keys.length) {
        cols.forEach((p) => keys.push(p));
        continue;
      }
      const row: Record<string, string> = {};
      keys.forEach((k, i) => (row[k] = cols[i] || ''));
      const type = (row.type || '').toLowerCase();
      if (type === 'layer') {
        assemblies.push(makeLayer({ name: row.name, description: row.kind }, assemblies.length));
        continue;
      }
      if (type === 'instance') {
        instances.push(makeInstance({ name: row.name, surface: row.kind || row.surface, layer: row.layer || name }, instances.length));
        continue;
      }
      parts.push(makeSurface({ name: row.name, kind: row.kind || row.type }, parts.length));
    }
  }
  if (!parts.length && !assemblies.length && !instances.length) throw new Error('Rhino markdown contains no surfaces or layers');
  return finishDataset(name, sourceKind, name, 'UTF-8', '8.0', 'm', parts, assemblies, instances, []);
}

function parseRh01(bytes: Uint8Array, fileName: string): RhDataset {
  if (bytes.length < 8) throw new Error('Rhino dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('Rhino dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid RH01 JSON');
  }
  return ingestJson(parsed, fileName, 'rhino');
}

export function buildSampleRhBytes(): Uint8Array {
  const json = te.encode(RH_JSON_SAMPLE);
  const out: number[] = [...RH_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleRhJson(): string {
  return RH_JSON_SAMPLE;
}

export function parseRhText(text: string, fileName = ''): RhDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Rhino dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeRhino(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Rhino JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === '3dm' || looksLikeRhino(raw)) return parseAsciiRhino(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsRh(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a Rhino dump');
}

export function parseRhBytes(bytes: Uint8Array, fileName = ''): RhDataset {
  if (!bytes.length) throw new Error('Rhino dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Rhino files are not supported — decompress first');
  if (isRhMagic(bytes)) return parseRh01(bytes, fileName);
  if (isOleMagic(bytes) || looksLikeOpenNurbs(bytes)) throw new Error('Binary Rhino 3DM is not expanded here — export a dump or JSON');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === '3dm' && !isMostlyText(bytes)) {
    throw new Error('Binary Rhino 3DM is not expanded here — export a dump or JSON');
  }
  return parseRhText(td.decode(bytes), fileName);
}

export function filterRhSurfaces(parts: RhSurface[], query: string): RhSurface[] {
  const q = query.trim().toLowerCase();
  if (!q) return parts;
  const tokens = q.split(/\s+/).filter(Boolean);
  return parts.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('surf:') || token.startsWith('surface:') || token.startsWith('name:')) return p.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('kind:')) return p.kind.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('layer:') || token.startsWith('inst:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterRhLayers(items: RhLayer[], query: string): RhLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((a) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:')) {
        return `${a.name} ${a.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('surf:') || token.startsWith('surface:') || token.startsWith('inst:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${a.name} ${a.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterRhInstances(items: RhInstance[], query: string): RhInstance[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((inst) =>
    tokens.every((token) => {
      if (token.startsWith('inst:') || token.startsWith('name:')) return inst.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('surf:') || token.startsWith('surface:')) {
        return inst.surface.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('layer:')) return inst.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${inst.name} ${inst.surface} ${inst.layer}`.toLowerCase().includes(token);
    })
  );
}

export function filterRhRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('surf:') || token.startsWith('surface:') ||
        token.startsWith('assy:') ||
        token.startsWith('assembly:') ||
        token.startsWith('inst:')
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
