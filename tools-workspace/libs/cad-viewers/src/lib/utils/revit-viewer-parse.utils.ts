import type {
  RvCategory,
  RvColumn,
  RvDataset,
  RvFamily,
  RvInstance,
  RvSolidKind,
  RvSourceKind,
  RvType
} from '../types/revit-viewer.types';
import { RV_JSON_SAMPLE } from '../constants/revit-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const RV_MAGIC = new Uint8Array([0x52, 0x56, 0x30, 0x31]); // RV01
const RV_COLORS = ['#fb923c', '#f87171', '#34d399', '#38bdf8', '#c4b5fd', '#fbbf24'];

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

function looksLikeRevit(text: string): boolean {
  const t = text.trim();
  if (/\bREVIT dump\b/i.test(t)) return true;
  if (/^\s*FAMILY\s+\S+/m.test(t) && /^\s*(?:INSTANCE|TYPE)\s+\S+/m.test(t)) return true;
  if (/^\s*RVT\b/m.test(t) && /^\s*FAMILY\s+\S+/m.test(t)) return true;
  return false;
}

function isOleMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

function isRvMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === RV_MAGIC[0] && bytes[1] === RV_MAGIC[1] && bytes[2] === RV_MAGIC[2] && bytes[3] === RV_MAGIC[3];
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

function solidKind(raw: unknown): RvSolidKind {
  const v = asString(raw).toLowerCase();
  if (v === 'box' || v === 'block' || v === 'cube' || v === 'floor' || v === 'wall') return 'box';
  if (v === 'cylinder' || v === 'cyl' || v === 'column') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'plane' || v === 'face') return 'plane';
  return 'other';
}

function categoryOf(raw: unknown, name = ''): RvCategory {
  const v = asString(raw || name).toLowerCase();
  if (v === 'walls' || v.includes('wall')) return 'Walls';
  if (v === 'floors' || v.includes('floor') || v.includes('slab')) return 'Floors';
  if (v === 'columns' || v.includes('column')) return 'Columns';
  if (v === 'furniture' || v.includes('furnish') || v.includes('counter') || v.includes('mount')) return 'Furniture';
  if (v === 'generic') return 'Generic';
  return 'other';
}

function instanceVolume(kind: RvSolidKind, sx: number, sy: number, sz: number, r: number, h: number): number {
  if (kind === 'cylinder') return Number((Math.PI * r * r * (h || sz || 1)).toFixed(4));
  if (kind === 'sphere') return Number(((4 / 3) * Math.PI * r * r * r).toFixed(4));
  return Number((Math.max(0, sx) * Math.max(0, sy) * Math.max(0, sz || h)).toFixed(4));
}

function shopGeom(name: string): CadDumpRec {
  const n = name.toLowerCase();
  if (n.includes('slab') || n.includes('floor')) {
    return { kind: 'box', category: 'Floors', family: 'ShopFloor', type: 'Floor', sx: 12, sy: 8, sz: 0.15, cx: 6, cy: 4, cz: 0.075 };
  }
  if (n.includes('counter') || n.includes('mount') || n.includes('furnish')) {
    return {
      kind: 'box',
      category: 'Furniture',
      family: 'ShopRankerMount',
      type: 'Mount',
      sx: 3,
      sy: 1.2,
      sz: 0.9,
      cx: 2.5,
      cy: 1.6,
      cz: 0.45
    };
  }
  if (n.includes('column')) {
    return { kind: 'cylinder', category: 'Columns', family: 'Column', type: 'RoundColumn', r: 0.35, h: 2.4, cx: 10, cy: 6, cz: 1.2 };
  }
  return {};
}

function makeInstance(raw: CadDumpRec, index: number): RvInstance {
  const name = asString(raw.name || raw.id, `inst${index + 1}`);
  const shop = shopGeom(name);
  const merged = { ...shop, ...raw };
  const kind = solidKind(merged.kind || merged.shape || merged.category);
  const category = categoryOf(merged.category || merged.cat, name);
  const sx = asNumber(merged.sx ?? merged.width ?? merged.dx, kind === 'box' ? 1 : 0);
  const sy = asNumber(merged.sy ?? merged.depth ?? merged.dy, kind === 'box' ? 1 : 0);
  const sz = asNumber(merged.sz ?? merged.height ?? merged.dz, kind === 'box' ? 1 : 0);
  const r = asNumber(merged.r ?? merged.radius, kind === 'cylinder' || kind === 'sphere' ? 0.35 : 0);
  const h = asNumber(merged.h ?? merged.height, kind === 'cylinder' ? 1 : sz);
  return {
    id: name,
    index,
    name,
    family: asString(merged.family || merged.fam),
    type: asString(merged.type || merged.typeName),
    category,
    kind,
    colorHex: asString(raw.colorHex) || RV_COLORS[index % RV_COLORS.length],
    cx: asNumber(merged.cx ?? merged.x),
    cy: asNumber(merged.cy ?? merged.y),
    cz: asNumber(merged.cz ?? merged.z),
    sx,
    sy,
    sz,
    r,
    h,
    volume: asNumber(raw.volume, instanceVolume(kind, sx, sy, sz, r, h))
  };
}

function makeFamily(raw: CadDumpRec, index: number, instanceCount = 0): RvFamily {
  const name = asString(raw.name || raw.id, `fam${index + 1}`);
  return {
    id: name,
    index,
    name,
    category: categoryOf(raw.category || raw.cat, name),
    description: asString(raw.description || raw.desc),
    instanceCount: asNumber(raw.instanceCount, instanceCount)
  };
}

function makeType(raw: CadDumpRec, index: number, instanceCount = 0): RvType {
  const name = asString(raw.name || raw.id, `type${index + 1}`);
  const family = asString(raw.family || raw.fam);
  return {
    id: `${name}-${family || index}`,
    index,
    name,
    family,
    category: categoryOf(raw.category || raw.cat, family || name),
    description: asString(raw.description || raw.desc),
    instanceCount: asNumber(raw.instanceCount, instanceCount)
  };
}

function finishDataset(
  name: string,
  sourceKind: RvSourceKind,
  title: string,
  encoding: string,
  revitVer: string,
  units: string,
  instances: RvInstance[],
  families: RvFamily[],
  types: RvType[],
  warnings: string[]
): RvDataset {
  if (!instances.length && !families.length && !types.length) throw new Error('Revit dump contains no instances or families');
  instances.forEach((inst, i) => (inst.index = i));
  const famCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  for (const inst of instances) {
    famCounts.set(inst.family, (famCounts.get(inst.family) || 0) + 1);
    typeCounts.set(`${inst.type}|${inst.family}`, (typeCounts.get(`${inst.type}|${inst.family}`) || 0) + 1);
  }
  if (!families.length) {
    [...new Set(instances.map((inst) => inst.family).filter(Boolean))].forEach((n, i) =>
      families.push(makeFamily({ name: n, category: instances.find((inst) => inst.family === n)?.category }, i))
    );
  }
  if (!types.length) {
    const seen = new Set<string>();
    instances.forEach((inst) => {
      const key = `${inst.type}|${inst.family}`;
      if (!inst.type || seen.has(key)) return;
      seen.add(key);
      types.push(makeType({ name: inst.type, family: inst.family, category: inst.category }, types.length));
    });
  }
  families.forEach((f, i) => {
    f.index = i;
    f.instanceCount = famCounts.get(f.name) || f.instanceCount || 0;
  });
  types.forEach((t, i) => {
    t.index = i;
    t.instanceCount = typeCounts.get(`${t.name}|${t.family}`) || t.instanceCount || 0;
  });
  const columns: RvColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'family', index: 2, name: 'family', type: 'STRING' },
    { id: 'category', index: 3, name: 'category', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...instances.map((inst) => ({
      name: inst.name,
      type: 'instance',
      family: inst.family,
      category: inst.category,
      value: inst.kind
    })),
    ...families.map((f) => ({ name: f.name, type: 'family', family: f.name, category: f.category, value: f.description || String(f.instanceCount) })),
    ...types.map((t) => ({ name: t.name, type: 'type', family: t.family, category: t.category, value: t.description || String(t.instanceCount) }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    revitVer: revitVer || '—',
    units: units || 'm',
    instanceCount: instances.length,
    familyCount: families.length,
    typeCount: types.length,
    instances,
    families,
    types,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: RvSourceKind = 'json', warnings: string[] = []): RvDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Model'));
  const instances = ((Array.isArray(root.instances) ? root.instances : Array.isArray(root.elements) ? root.elements : []) as unknown[]).map(
    (item, i) => makeInstance(rec(item), i)
  );
  const families = ((Array.isArray(root.families) ? root.families : []) as unknown[]).map((item, i) => makeFamily(rec(item), i));
  const types = ((Array.isArray(root.types) ? root.types : []) as unknown[]).map((item, i) => makeType(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'revit' ? 'ASCII' : 'UTF-8',
    asString(root.revitVer || root.version, '2024'),
    asString(root.units, 'm'),
    instances,
    families,
    types,
    warnings
  );
}

function parseAsciiRevit(text: string, fileName: string): RvDataset {
  const version = /REVIT dump\s+\S+\s+([\d.]+)/i.exec(text)?.[1] || /\b20\d{2}\b/.exec(text)?.[0] || '2024';
  const dumpName = /REVIT dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'Model');
  const name = prettyModelName(fileName, dumpName);
  const instances: RvInstance[] = [];
  const families: RvFamily[] = [];
  const types: RvType[] = [];
  const famRe = /\bFAMILY\s+([A-Za-z0-9_-]+)\s+(\S+)(?:\s+(.+))?$/gim;
  let m: RegExpExecArray | null;
  while ((m = famRe.exec(text))) {
    families.push(makeFamily({ name: m[1], category: m[2], description: (m[3] || '').trim() }, families.length));
  }
  const typeRe = /\bTYPE\s+([A-Za-z0-9_-]+)\s+([A-Za-z0-9_-]+)\s+(\S+)(?:\s+(.+))?$/gim;
  while ((m = typeRe.exec(text))) {
    types.push(makeType({ name: m[1], family: m[2], category: m[3], description: (m[4] || '').trim() }, types.length));
  }
  const instRe =
    /\bINSTANCE\s+([A-Za-z0-9_-]+)\s+FAMILY\s+([A-Za-z0-9_-]+)\s+TYPE\s+([A-Za-z0-9_-]+)\s+CAT\s+(\S+)\s+(BOX|CYLINDER|SPHERE|PLANE)\s+([-\d.eE]+)(?:\s+([-\d.eE]+))?(?:\s+([-\d.eE]+))?(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  while ((m = instRe.exec(text))) {
    const kind = solidKind(m[5]);
    if (kind === 'cylinder') {
      instances.push(
        makeInstance(
          { name: m[1], family: m[2], type: m[3], category: m[4], kind, r: m[6], h: m[7], cx: m[9], cy: m[10], cz: m[11] },
          instances.length
        )
      );
    } else {
      instances.push(
        makeInstance(
          { name: m[1], family: m[2], type: m[3], category: m[4], kind, sx: m[6], sy: m[7], sz: m[8], cx: m[9], cy: m[10], cz: m[11] },
          instances.length
        )
      );
    }
  }
  if (!instances.length && !families.length) throw new Error('Revit dump has no FAMILY or INSTANCE entries');
  const warnings = ['ASCII Revit dump is a metadata subset — tessellation uses dump instances, not a full .rvt kernel.'];
  return finishDataset(name, 'revit', name, 'ASCII', version, 'm', instances, families, types, warnings);
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

function parseCsvAsRv(text: string, fileName: string): RvDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Revit CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const instances: RvInstance[] = [];
  const families: RvFamily[] = [];
  const types: RvType[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'family') {
      families.push(makeFamily({ name: row.name, category: row.category || row.kind, description: row.value }, families.length));
      return;
    }
    if (type === 'type') {
      types.push(makeType({ name: row.name, family: row.family, category: row.category, description: row.value }, types.length));
      return;
    }
    instances.push(
      makeInstance(
        {
          name: row.name,
          family: row.family,
          type: row.value || row.typeName,
          category: row.category,
          kind: row.kind,
          cx: row.cx,
          cy: row.cy,
          cz: row.cz,
          sx: row.sx,
          sy: row.sy,
          sz: row.sz,
          r: row.r,
          h: row.h
        },
        instances.length
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Model');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '2024', 'm', instances, families, types, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: RvSourceKind): RvDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Model')).trim();
  const keys: string[] = [];
  const instances: RvInstance[] = [];
  const families: RvFamily[] = [];
  const types: RvType[] = [];
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
      if (type === 'family') {
        families.push(makeFamily({ name: row.name, category: row.kind, description: row.kind }, families.length));
        continue;
      }
      if (type === 'type') {
        types.push(makeType({ name: row.name, family: row.kind || row.family, category: row.category }, types.length));
        continue;
      }
      instances.push(makeInstance({ name: row.name, kind: row.kind || row.type, family: row.family, category: row.category }, instances.length));
    }
  }
  if (!instances.length && !families.length && !types.length) throw new Error('Revit markdown contains no instances or families');
  return finishDataset(name, sourceKind, name, 'UTF-8', '2024', 'm', instances, families, types, []);
}

function parseRv01(bytes: Uint8Array, fileName: string): RvDataset {
  if (bytes.length < 8) throw new Error('Revit dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('Revit dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid RV01 JSON');
  }
  return ingestJson(parsed, fileName, 'revit');
}

export function buildSampleRvBytes(): Uint8Array {
  const json = te.encode(RV_JSON_SAMPLE);
  const out: number[] = [...RV_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleRvJson(): string {
  return RV_JSON_SAMPLE;
}

export function parseRvText(text: string, fileName = ''): RvDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Revit dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeRevit(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Revit JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'rvt' || ext === 'rfa' || looksLikeRevit(raw)) return parseAsciiRevit(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsRv(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a Revit dump');
}

export function parseRvBytes(bytes: Uint8Array, fileName = ''): RvDataset {
  if (!bytes.length) throw new Error('Revit dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Revit files are not supported — decompress first');
  if (isRvMagic(bytes)) return parseRv01(bytes, fileName);
  if (isOleMagic(bytes)) throw new Error('Binary Revit .rvt/.rfa is not expanded here — export a dump or JSON');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'rvt' || ext === 'rfa') && !isMostlyText(bytes)) {
    throw new Error('Binary Revit .rvt/.rfa is not expanded here — export a dump or JSON');
  }
  return parseRvText(td.decode(bytes), fileName);
}

export function filterRvInstances(items: RvInstance[], query: string): RvInstance[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((inst) =>
    tokens.every((token) => {
      if (token.startsWith('inst:') || token.startsWith('instance:') || token.startsWith('name:')) {
        return inst.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('fam:') || token.startsWith('family:')) return inst.family.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('kind:')) {
        return `${inst.type} ${inst.kind}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('cat:') || token.startsWith('category:')) {
        return inst.category.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${inst.name} ${inst.family} ${inst.type} ${inst.category} ${inst.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterRvFamilies(items: RvFamily[], query: string): RvFamily[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((f) =>
    tokens.every((token) => {
      if (token.startsWith('fam:') || token.startsWith('family:') || token.startsWith('name:')) {
        return `${f.name} ${f.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('cat:') || token.startsWith('category:')) {
        return f.category.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('inst:') || token.startsWith('type:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${f.name} ${f.category} ${f.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterRvTypes(items: RvType[], query: string): RvType[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('type:') || token.startsWith('name:')) {
        return `${t.name} ${t.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('fam:') || token.startsWith('family:')) return t.family.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('cat:') || token.startsWith('category:')) {
        return t.category.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('inst:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${t.name} ${t.family} ${t.category} ${t.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterRvRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('fam:') ||
        token.startsWith('family:') ||
        token.startsWith('cat:') ||
        token.startsWith('category:') ||
        token.startsWith('inst:') ||
        token.startsWith('instance:')
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
