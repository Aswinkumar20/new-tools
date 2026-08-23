import type {
  NwClash,
  NwClashStatus,
  NwClashType,
  NwColumn,
  NwDataset,
  NwItem,
  NwModel,
  NwSolidKind,
  NwSourceKind
} from '../types/navisworks-viewer.types';
import { NW_JSON_SAMPLE } from '../constants/navisworks-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const NW_MAGIC = new Uint8Array([0x4e, 0x57, 0x30, 0x31]); // NW01
const NW_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#c4b5fd', '#38bdf8'];

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

function looksLikeNavis(text: string): boolean {
  const t = text.trim();
  if (/\bBIM clash dump\b/i.test(t) || /<clashreport\b/i.test(t)) return false;
  if (/\bNAVIS dump\b/i.test(t)) return true;
  if (/^\s*MODEL\s+\S+/m.test(t) && /^\s*(?:ITEM|CLASH)\s+/m.test(t)) return true;
  if (/\bNavisworks\b/i.test(t) && /\b(?:ITEM|CLASH|MODEL)\b/i.test(t)) return true;
  return false;
}

function isOleMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
  );
}

function isNwMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === NW_MAGIC[0] && bytes[1] === NW_MAGIC[1] && bytes[2] === NW_MAGIC[2] && bytes[3] === NW_MAGIC[3];
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

function solidKind(raw: unknown): NwSolidKind {
  const v = asString(raw).toLowerCase();
  if (v === 'box' || v === 'block' || v === 'cube' || v === 'slab' || v === 'wall' || v === 'duct') return 'box';
  if (v === 'cylinder' || v === 'cyl' || v === 'column') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'plane' || v === 'face') return 'plane';
  return 'other';
}

function clashTypeOf(raw: unknown): NwClashType {
  const v = asString(raw).toLowerCase();
  if (v === 'hard' || v === 'hardclash') return 'hard';
  if (v === 'clearance' || v === 'clear') return 'clearance';
  if (v === 'duplicate' || v === 'dup') return 'duplicate';
  return 'other';
}

function clashStatusOf(raw: unknown): NwClashStatus {
  const v = asString(raw).toLowerCase();
  if (v === 'active' || v === 'new' || v === 'open') return 'active';
  if (v === 'reviewed' || v === 'review') return 'reviewed';
  if (v === 'resolved' || v === 'approved' || v === 'closed') return 'resolved';
  return 'other';
}

function modelOf(raw: unknown, name: string): string {
  const v = asString(raw);
  if (v) return v;
  const n = name.toLowerCase();
  if (n.includes('column') || n.includes('beam') || n.includes('struct')) return 'Structure';
  if (n.includes('duct') || n.includes('pipe') || n.includes('mep')) return 'MEP';
  return 'Architecture';
}

function itemVolume(kind: NwSolidKind, sx: number, sy: number, sz: number, r: number, h: number): number {
  if (kind === 'cylinder') return Number((Math.PI * r * r * (h || sz || 1)).toFixed(4));
  if (kind === 'sphere') return Number(((4 / 3) * Math.PI * r * r * r).toFixed(4));
  return Number((Math.max(0, sx) * Math.max(0, sy) * Math.max(0, sz || h)).toFixed(4));
}

function shopGeom(name: string): CadDumpRec {
  const n = name.toLowerCase();
  if (n.includes('slab') || n.includes('floor')) {
    return { kind: 'box', model: 'Architecture', sx: 12, sy: 8, sz: 0.15, cx: 6, cy: 4, cz: 0.075 };
  }
  if (n.includes('counter') || n.includes('furnish') || n.includes('mount')) {
    return { kind: 'box', model: 'Architecture', sx: 3, sy: 1.2, sz: 0.9, cx: 2.5, cy: 1.6, cz: 0.45 };
  }
  if (n.includes('column')) {
    return { kind: 'cylinder', model: 'Structure', r: 0.35, h: 2.4, cx: 10, cy: 6, cz: 1.2 };
  }
  if (n.includes('duct') || n.includes('pipe')) {
    return { kind: 'box', model: 'MEP', sx: 0.4, sy: 2, sz: 0.4, cx: 10, cy: 6, cz: 1.2 };
  }
  return {};
}

function makeItem(raw: CadDumpRec, index: number): NwItem {
  const name = asString(raw.name || raw.id, `item${index + 1}`);
  const shop = shopGeom(name);
  const merged = { ...shop, ...raw };
  const kind = solidKind(merged.kind || merged.shape || name);
  const model = modelOf(merged.model || merged.discipline, name);
  const sx = asNumber(merged.sx ?? merged.width ?? merged.dx, kind === 'box' ? 1 : 0);
  const sy = asNumber(merged.sy ?? merged.depth ?? merged.dy, kind === 'box' ? 1 : 0);
  const sz = asNumber(merged.sz ?? merged.height ?? merged.dz, kind === 'box' ? 1 : 0);
  const r = asNumber(merged.r ?? merged.radius, kind === 'cylinder' || kind === 'sphere' ? 0.35 : 0);
  const h = asNumber(merged.h ?? merged.height, kind === 'cylinder' ? 1 : sz);
  return {
    id: name,
    index,
    name,
    kind,
    model,
    colorHex: asString(raw.colorHex) || NW_COLORS[index % NW_COLORS.length],
    cx: asNumber(merged.cx ?? merged.x),
    cy: asNumber(merged.cy ?? merged.y),
    cz: asNumber(merged.cz ?? merged.z),
    sx,
    sy,
    sz,
    r,
    h,
    volume: asNumber(raw.volume, itemVolume(kind, sx, sy, sz, r, h))
  };
}

function makeClash(raw: CadDumpRec, index: number): NwClash {
  const name = asString(raw.name || raw.id, `CL-${String(index + 1).padStart(2, '0')}`);
  return {
    id: name,
    index,
    name,
    clashType: clashTypeOf(raw.clashType || raw.type || raw.kind),
    status: clashStatusOf(raw.status),
    itemA: asString(raw.itemA || raw.a || raw.left),
    itemB: asString(raw.itemB || raw.b || raw.right),
    distance: asNumber(raw.distance || raw.dist || raw.value),
    cx: asNumber(raw.cx ?? raw.x),
    cy: asNumber(raw.cy ?? raw.y),
    cz: asNumber(raw.cz ?? raw.z)
  };
}

function makeModel(raw: CadDumpRec, index: number, itemCount = 0): NwModel {
  const name = asString(raw.name || raw.id, `model${index + 1}`);
  return {
    id: name,
    index,
    name,
    description: asString(raw.description || raw.desc),
    itemCount: asNumber(raw.itemCount, itemCount)
  };
}

function finishDataset(
  name: string,
  sourceKind: NwSourceKind,
  title: string,
  encoding: string,
  navisVer: string,
  units: string,
  items: NwItem[],
  clashes: NwClash[],
  models: NwModel[],
  warnings: string[]
): NwDataset {
  if (!items.length && !clashes.length && !models.length) throw new Error('Navisworks dump contains no items or clashes');
  items.forEach((e, i) => (e.index = i));
  clashes.forEach((c, i) => (c.index = i));
  const counts = new Map<string, number>();
  for (const e of items) counts.set(e.model, (counts.get(e.model) || 0) + 1);
  if (!models.length) {
    [...counts.keys()].forEach((n, i) => models.push(makeModel({ name: n }, i)));
  }
  models.forEach((d, i) => {
    d.index = i;
    d.itemCount = counts.get(d.name) || d.itemCount || 0;
  });
  const columns: NwColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'model', index: 2, name: 'model', type: 'STRING' },
    { id: 'clash', index: 3, name: 'clash', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...items.map((e) => ({ name: e.name, type: 'item', model: e.model, clash: '', value: e.kind })),
    ...models.map((d) => ({
      name: d.name,
      type: 'model',
      model: d.name,
      clash: '',
      value: d.description || String(d.itemCount)
    })),
    ...clashes.map((c) => ({ name: c.name, type: 'clash', model: '', clash: c.name, value: `${c.itemA}|${c.itemB}` }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    navisVer: navisVer || '—',
    units: units || 'm',
    itemCount: items.length,
    clashCount: clashes.length,
    modelCount: models.length,
    items,
    clashes,
    models,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: NwSourceKind = 'json', warnings: string[] = []): NwDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Coordination'));
  const items = ((Array.isArray(root.items) ? root.items : Array.isArray(root.elements) ? root.elements : []) as unknown[]).map((item, i) =>
    makeItem(rec(item), i)
  );
  const clashes = ((Array.isArray(root.clashes) ? root.clashes : []) as unknown[]).map((item, i) => makeClash(rec(item), i));
  const models = ((Array.isArray(root.models) ? root.models : []) as unknown[]).map((item, i) => makeModel(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'navisworks' ? 'ASCII' : 'UTF-8',
    asString(root.navisVer || root.version, '2024'),
    asString(root.units, 'm'),
    items,
    clashes,
    models,
    warnings
  );
}

function parseAsciiNavis(text: string, fileName: string): NwDataset {
  const version = /NAVIS dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || /20\d{2}/.exec(text)?.[0] || '2024';
  const dumpName = /NAVIS dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'Coordination');
  const name = prettyModelName(fileName, dumpName);
  const items: NwItem[] = [];
  const clashes: NwClash[] = [];
  const models: NwModel[] = [];
  const itemRe =
    /\bITEM\s+([A-Za-z0-9_-]+)\s+(\S+)\s+(BOX|CYLINDER|SPHERE|PLANE)\s+([-\d.eE]+)(?:\s+([-\d.eE]+))?(?:\s+([-\d.eE]+))?(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(text))) {
    const kind = solidKind(m[3]);
    if (kind === 'cylinder') {
      items.push(makeItem({ name: m[1], model: m[2], kind, r: m[4], h: m[5], cx: m[7], cy: m[8], cz: m[9] }, items.length));
    } else {
      items.push(makeItem({ name: m[1], model: m[2], kind, sx: m[4], sy: m[5], sz: m[6], cx: m[7], cy: m[8], cz: m[9] }, items.length));
    }
  }
  const modelRe = /\bMODEL\s+([A-Za-z0-9_-]+)(?:\s+(.+))?$/gim;
  while ((m = modelRe.exec(text))) {
    const matchName = m?.[1] ?? '';
    if (matchName && !models.some((d) => d.name === matchName)) {
      models.push(makeModel({ name: matchName, description: (m[2] || '').trim() }, models.length));
    }
  }
  const clashRe =
    /\bCLASH\s+([A-Za-z0-9_-]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([-\d.eE]+)(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  while ((m = clashRe.exec(text))) {
    clashes.push(
      makeClash(
        { name: m[1], clashType: m[2], status: m[3], itemA: m[4], itemB: m[5], distance: m[6], cx: m[7], cy: m[8], cz: m[9] },
        clashes.length
      )
    );
  }
  if (!items.length && !clashes.length) throw new Error('Navisworks dump has no ITEM or CLASH entries');
  const warnings = ['ASCII Navisworks dump is a metadata subset — tessellation uses dump items, not the Autodesk Navisworks kernel.'];
  return finishDataset(name, 'navisworks', name, 'ASCII', version, 'm', items, clashes, models, warnings);
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

function parseCsvAsNw(text: string, fileName: string): NwDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Navisworks CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const items: NwItem[] = [];
  const clashes: NwClash[] = [];
  const models: NwModel[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'model') {
      models.push(makeModel({ name: row.name || row.model, description: row.kind || row.value }, models.length));
      return;
    }
    if (type === 'clash') {
      clashes.push(
        makeClash(
          { name: row.name || row.clash, clashType: row.kind || row.type, itemA: row.value, itemB: row.itemB, distance: row.distance },
          clashes.length
        )
      );
      return;
    }
    items.push(
      makeItem(
        {
          name: row.name,
          model: row.model,
          kind: row.kind || row.value,
          cx: row.cx,
          cy: row.cy,
          cz: row.cz,
          sx: row.sx,
          sy: row.sy,
          sz: row.sz,
          r: row.r,
          h: row.h
        },
        items.length
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Coordination');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '2024', 'm', items, clashes, models, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: NwSourceKind): NwDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Coordination')).trim();
  const keys: string[] = [];
  const items: NwItem[] = [];
  const clashes: NwClash[] = [];
  const models: NwModel[] = [];
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
      if (type === 'model') {
        models.push(makeModel({ name: row.name, description: row.kind }, models.length));
        continue;
      }
      if (type === 'clash') {
        clashes.push(makeClash({ name: row.name, clashType: row.kind, itemA: row.value }, clashes.length));
        continue;
      }
      items.push(makeItem({ name: row.name, kind: row.kind || row.type, model: row.model }, items.length));
    }
  }
  if (!items.length && !clashes.length && !models.length) throw new Error('Navisworks markdown contains no items or clashes');
  return finishDataset(name, sourceKind, name, 'UTF-8', '2024', 'm', items, clashes, models, []);
}

function parseNw01(bytes: Uint8Array, fileName: string): NwDataset {
  if (bytes.length < 8) throw new Error('Navisworks dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('Navisworks dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid NW01 JSON');
  }
  return ingestJson(parsed, fileName, 'navisworks');
}

export function buildSampleNwBytes(): Uint8Array {
  const json = te.encode(NW_JSON_SAMPLE);
  const out: number[] = [...NW_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleNwJson(): string {
  return NW_JSON_SAMPLE;
}

export function parseNwText(text: string, fileName = ''): NwDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Navisworks dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeNavis(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Navisworks JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'nwd' || ext === 'nwf' || ext === 'nwc' || looksLikeNavis(raw)) return parseAsciiNavis(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsNw(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a Navisworks dump');
}

export function parseNwBytes(bytes: Uint8Array, fileName = ''): NwDataset {
  if (!bytes.length) throw new Error('Navisworks dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed Navisworks files are not supported — decompress first');
  if (isNwMagic(bytes)) return parseNw01(bytes, fileName);
  if (isOleMagic(bytes)) throw new Error('Binary / OLE Navisworks (.nwd/.nwf) is not expanded here — export an ASCII dump or JSON');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'nwd' || ext === 'nwf' || ext === 'nwc') && !isMostlyText(bytes)) {
    throw new Error('Binary Navisworks is not expanded here — export an ASCII dump or JSON');
  }
  return parseNwText(td.decode(bytes), fileName);
}

export function filterNwItems(items: NwItem[], query: string): NwItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('item:') || token.startsWith('name:')) {
        return e.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) {
        return `${e.kind}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('model:')) {
        return e.model.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('clash:') || token.startsWith('status:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.kind} ${e.model}`.toLowerCase().includes(token);
    })
  );
}

export function filterNwClashes(items: NwClash[], query: string): NwClash[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('clash:') || token.startsWith('name:') || token.startsWith('status:')) {
        return `${c.name} ${c.clashType} ${c.status}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('item:') || token.startsWith('type:') || token.startsWith('kind:')) {
        return `${c.itemA} ${c.itemB} ${c.clashType}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('hard:') || token === 'hard') return c.clashType === 'hard';
      if (token.startsWith('clearance:') || token === 'clearance') return c.clashType === 'clearance';
      if (token.startsWith('model:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.name} ${c.clashType} ${c.status} ${c.itemA} ${c.itemB}`.toLowerCase().includes(token);
    })
  );
}

export function filterNwModels(items: NwModel[], query: string): NwModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((d) =>
    tokens.every((token) => {
      if (token.startsWith('model:') || token.startsWith('name:')) {
        return `${d.name} ${d.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('item:') || token.startsWith('clash:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${d.name} ${d.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterNwRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('item:') ||
        token.startsWith('model:') ||
        token.startsWith('clash:') ||
        token.startsWith('kind:') ||
        token.startsWith('status:')
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
