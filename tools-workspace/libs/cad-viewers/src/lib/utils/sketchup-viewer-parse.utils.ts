import type { SkComponent, SkColumn, SkDataset, SkInstance, SkGroup, SkGroupKind, SkSourceKind } from '../types/sketchup-viewer.types';
import { SK_JSON_SAMPLE } from '../constants/sketchup-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const SK_MAGIC = new Uint8Array([0x53, 0x4B, 0x30, 0x31]); // SK01
const SK_COLORS = ['#fb7185', '#f59e0b', '#34d399', '#38bdf8', '#c4b5fd', '#fbbf24'];

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

function looksLikeSketchUp(text: string): boolean {
  const head = text.slice(0, 480);
  return (
    /\bSketchUp\b/i.test(head) ||
    /^\s*GROUP\s+\S+/m.test(text) ||
    /^\s*COMPONENT\s+\S+/m.test(text) ||
    /^\s*INSTANCE\s+\S+/m.test(text)
  );
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

function isSkMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === SK_MAGIC[0] && bytes[1] === SK_MAGIC[1] && bytes[2] === SK_MAGIC[2] && bytes[3] === SK_MAGIC[3];
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function partKind(raw: unknown): SkGroupKind {
  const v = asString(raw).toLowerCase();
  if (v === 'box' || v === 'block' || v === 'cube') return 'box';
  if (v === 'cylinder' || v === 'cyl') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'plane' || v === 'face') return 'plane';
  return 'other';
}

function partVolume(kind: SkGroupKind, sx: number, sy: number, sz: number, r: number, h: number): number {
  if (kind === 'cylinder') return Number((Math.PI * r * r * (h || sz || 1)).toFixed(4));
  if (kind === 'sphere') return Number(((4 / 3) * Math.PI * r * r * r).toFixed(4));
  return Number((Math.max(0, sx) * Math.max(0, sy) * Math.max(0, sz || h)).toFixed(4));
}

function makeGroup(raw: CadDumpRec, index: number): SkGroup {
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
    colorHex: asString(raw.colorHex) || SK_COLORS[index % SK_COLORS.length],
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

function makeComponent(raw: CadDumpRec, index: number, instanceCount = 0): SkComponent {
  const name = asString(raw.name || raw.id, `assy${index + 1}`);
  return {
    id: name,
    index,
    name,
    description: asString(raw.description || raw.desc),
    instanceCount: asNumber(raw.instanceCount, instanceCount)
  };
}

function makeInstance(raw: CadDumpRec, index: number): SkInstance {
  const name = asString(raw.name || raw.id, `inst${index + 1}`);
  return {
    id: name,
    index,
    name,
    group: asString(raw.group || raw.part),
    component: asString(raw.component || raw.assembly),
    cx: asNumber(raw.cx ?? raw.x),
    cy: asNumber(raw.cy ?? raw.y),
    cz: asNumber(raw.cz ?? raw.z)
  };
}

function finishDataset(
  name: string,
  sourceKind: SkSourceKind,
  title: string,
  encoding: string,
  version: string,
  units: string,
  parts: SkGroup[],
  assemblies: SkComponent[],
  instances: SkInstance[],
  warnings: string[]
): SkDataset {
  if (!parts.length && !assemblies.length && !instances.length) throw new Error('SketchUp dump contains no groups or components');
  parts.forEach((p, i) => (p.index = i));
  instances.forEach((inst, i) => (inst.index = i));
  const counts = new Map<string, number>();
  for (const inst of instances) counts.set(inst.component, (counts.get(inst.component) || 0) + 1);
  assemblies.forEach((a, i) => {
    a.index = i;
    a.instanceCount = counts.get(a.name) || a.instanceCount || 0;
  });
  const columns: SkColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'group', index: 2, name: 'group', type: 'STRING' },
    { id: 'component', index: 3, name: 'component', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...parts.map((p) => ({ name: p.name, type: 'group', group: p.name, component: '', value: p.kind })),
    ...assemblies.map((a) => ({
      name: a.name,
      type: 'component',
      group: '',
      component: a.name,
      value: a.description || String(a.instanceCount)
    })),
    ...instances.map((inst) => ({
      name: inst.name,
      type: 'instance',
      group: inst.group,
      component: inst.component,
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
    groupCount: parts.length,
    componentCount: assemblies.length,
    instanceCount: instances.length,
    groups: parts,
    components: assemblies,
    instances,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: SkSourceKind = 'json', warnings: string[] = []): SkDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Product'));
  const parts = ((Array.isArray(root.groups) ? root.groups : []) as unknown[]).map((item, i) => makeGroup(rec(item), i));
  const assemblies = ((Array.isArray(root.components) ? root.components : Array.isArray(root.products) ? root.products : []) as unknown[]).map(
    (item, i) => makeComponent(rec(item), i)
  );
  const instances = ((Array.isArray(root.instances) ? root.instances : []) as unknown[]).map((item, i) => makeInstance(rec(item), i));
  if (!assemblies.length && instances.length) {
    const names = [...new Set(instances.map((inst) => inst.component).filter(Boolean))];
    names.forEach((n, i) => assemblies.push(makeComponent({ name: n }, i)));
  }
  if (!assemblies.length && parts.length) assemblies.push(makeComponent({ name }, 0));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'sketchup' ? 'ASCII' : 'UTF-8',
    asString(root.version, '2024'),
    asString(root.units, 'm'),
    parts,
    assemblies,
    instances,
    warnings
  );
}

function parseAsciiSketchUp(text: string, fileName: string): SkDataset {
  const version = /SketchUp dump \S+ (\d{4})/i.exec(text)?.[1] || /COMPONENT\s+\S+\s+(V[\w.]+)/i.exec(text)?.[1] || '2024';
  const productName = /COMPONENT\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'Product');
  const name = prettyModelName(fileName, productName);
  const parts: SkGroup[] = [];
  const assemblies: SkComponent[] = [];
  const instances: SkInstance[] = [];
  if (productName) assemblies.push(makeComponent({ name: productName, description: 'component' }, 0));
  const partRe =
    /\bGROUP\s+([A-Za-z0-9_-]+)\s+(BOX|CYLINDER|SPHERE|PLANE)\s+([-\d.eE]+)(?:\s+([-\d.eE]+))?(?:\s+([-\d.eE]+))?(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = partRe.exec(text))) {
    const kind = partKind(m[2]);
    if (kind === 'cylinder') {
      parts.push(makeGroup({ name: m[1], kind, r: m[3], h: m[4], cx: m[6], cy: m[7], cz: m[8] }, parts.length));
    } else {
      parts.push(makeGroup({ name: m[1], kind, sx: m[3], sy: m[4], sz: m[5], cx: m[6], cy: m[7], cz: m[8] }, parts.length));
    }
  }
  const prodRe = /\b(?:COMPONENT|ASSEMBLY)\s+([A-Za-z0-9_-]+)/gi;
  while ((m = prodRe.exec(text))) {
    const matchName = m?.[1] ?? '';
    if (matchName && !assemblies.some((a) => a.name === matchName)) assemblies.push(makeComponent({ name: matchName, description: 'component' }, assemblies.length));
  }
  const instRe =
    /\bINSTANCE\s+([A-Za-z0-9_-]+)\s+GROUP\s+([A-Za-z0-9_-]+)\s+IN\s+([A-Za-z0-9_-]+)(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  while ((m = instRe.exec(text))) {
    instances.push(makeInstance({ name: m[1], group: m[2], component: m[3], cx: m[4], cy: m[5], cz: m[6] }, instances.length));
  }
  if (!parts.length && !assemblies.length) throw new Error('SketchUp dump has no GROUP or COMPONENT entries');
  const warnings = ['ASCII SketchUp dump is a metadata subset — tessellation uses dump parts and instances.'];
  return finishDataset(name, 'sketchup', name, 'ASCII', version, 'm', parts, assemblies, instances, warnings);
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

function parseCsvAsSk(text: string, fileName: string): SkDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('SketchUp CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const parts: SkGroup[] = [];
  const assemblies: SkComponent[] = [];
  const instances: SkInstance[] = [];
  lines.slice(1).forEach((line, index) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'component') {
      assemblies.push(makeComponent({ name: row.name, description: row.kind || row.description }, assemblies.length));
      return;
    }
    if (type === 'instance') {
      instances.push(
        makeInstance(
          { name: row.name, group: row.group || row.kind, component: row.component, cx: row.cx, cy: row.cy, cz: row.cz },
          instances.length
        )
      );
      return;
    }
    parts.push(
      makeGroup(
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
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '2024', 'm', parts, assemblies, instances, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: SkSourceKind): SkDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Product')).trim();
  const keys: string[] = [];
  const parts: SkGroup[] = [];
  const assemblies: SkComponent[] = [];
  const instances: SkInstance[] = [];
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
      if (type === 'component') {
        assemblies.push(makeComponent({ name: row.name, description: row.kind }, assemblies.length));
        continue;
      }
      if (type === 'instance') {
        instances.push(makeInstance({ name: row.name, group: row.kind || row.group, component: row.component || name }, instances.length));
        continue;
      }
      parts.push(makeGroup({ name: row.name, kind: row.kind || row.type }, parts.length));
    }
  }
  if (!parts.length && !assemblies.length && !instances.length) throw new Error('SketchUp markdown contains no groups or components');
  return finishDataset(name, sourceKind, name, 'UTF-8', '2024', 'm', parts, assemblies, instances, []);
}

function parseSk01(bytes: Uint8Array, fileName: string): SkDataset {
  if (bytes.length < 8) throw new Error('SketchUp dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('SketchUp dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid SK01 JSON');
  }
  return ingestJson(parsed, fileName, 'sketchup');
}

export function buildSampleSkBytes(): Uint8Array {
  const json = te.encode(SK_JSON_SAMPLE);
  const out: number[] = [...SK_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleSkJson(): string {
  return SK_JSON_SAMPLE;
}

export function parseSkText(text: string, fileName = ''): SkDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('SketchUp dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeSketchUp(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid SketchUp JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'skp' || looksLikeSketchUp(raw)) return parseAsciiSketchUp(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsSk(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a SketchUp dump');
}

export function parseSkBytes(bytes: Uint8Array, fileName = ''): SkDataset {
  if (!bytes.length) throw new Error('SketchUp dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed SketchUp files are not supported — decompress first');
  if (isSkMagic(bytes)) return parseSk01(bytes, fileName);
  if (isOleMagic(bytes)) throw new Error('Binary SketchUp SKP is not expanded here — export a dump or JSON');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'skp') && !isMostlyText(bytes)) {
    throw new Error('Binary SketchUp SKP is not expanded here — export a dump or JSON');
  }
  return parseSkText(td.decode(bytes), fileName);
}

export function filterSkGroups(parts: SkGroup[], query: string): SkGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return parts;
  const tokens = q.split(/\s+/).filter(Boolean);
  return parts.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('group:') || token.startsWith('name:')) return p.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('kind:')) return p.kind.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('comp:') || token.startsWith('component:') || token.startsWith('inst:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterSkComponents(items: SkComponent[], query: string): SkComponent[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((a) =>
    tokens.every((token) => {
      if (token.startsWith('comp:') || token.startsWith('component:') || token.startsWith('name:')) {
        return `${a.name} ${a.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('group:') || token.startsWith('inst:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${a.name} ${a.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterSkInstances(items: SkInstance[], query: string): SkInstance[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((inst) =>
    tokens.every((token) => {
      if (token.startsWith('inst:') || token.startsWith('name:')) return inst.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('group:')) return inst.group.toLowerCase().includes(token.slice(5));
      if (token.startsWith('comp:') || token.startsWith('component:')) return inst.component.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${inst.name} ${inst.group} ${inst.component}`.toLowerCase().includes(token);
    })
  );
}

export function filterSkRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('group:') ||
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
