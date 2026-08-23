import type {
  BcClash,
  BcClashStatus,
  BcClashType,
  BcColumn,
  BcDataset,
  BcItem,
  BcSolidKind,
  BcSourceKind,
  BcTest
} from '../types/bim-clash-viewer.types';
import { BC_JSON_SAMPLE, BC_XML_SAMPLE } from '../constants/bim-clash-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const BC_MAGIC = new Uint8Array([0x42, 0x43, 0x30, 0x31]); // BC01
const BC_COLORS = ['#f87171', '#c4b5fd', '#60a5fa', '#34d399', '#fbbf24', '#38bdf8'];

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

function looksLikeBimClash(text: string): boolean {
  const t = text.trim();
  if (/\bNAVIS dump\b/i.test(t)) return false;
  if (/\bBIM clash dump\b/i.test(t)) return true;
  if (/<clashreport\b/i.test(t) && /<clash\b/i.test(t)) return true;
  if (/\bclashtest\b/i.test(t) && /\bclash\b/i.test(t)) return true;
  if (/^\s*TEST\s+\S+/m.test(t) && /^\s*CLASH\s+/m.test(t)) return true;
  return false;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isBcMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === BC_MAGIC[0] && bytes[1] === BC_MAGIC[1] && bytes[2] === BC_MAGIC[2] && bytes[3] === BC_MAGIC[3];
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

function solidKind(raw: unknown): BcSolidKind {
  const v = asString(raw).toLowerCase();
  if (v === 'box' || v === 'block' || v === 'cube' || v === 'slab' || v === 'wall' || v === 'duct') return 'box';
  if (v === 'cylinder' || v === 'cyl' || v === 'column') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'plane' || v === 'face') return 'plane';
  return 'other';
}

function clashTypeOf(raw: unknown): BcClashType {
  const v = asString(raw).toLowerCase();
  if (v === 'hard' || v === 'hardclash') return 'hard';
  if (v === 'clearance' || v === 'clear') return 'clearance';
  if (v === 'duplicate' || v === 'dup') return 'duplicate';
  return 'other';
}

function clashStatusOf(raw: unknown): BcClashStatus {
  const v = asString(raw).toLowerCase();
  if (v === 'active' || v === 'new' || v === 'open') return 'active';
  if (v === 'reviewed' || v === 'review') return 'reviewed';
  if (v === 'resolved' || v === 'approved' || v === 'closed') return 'resolved';
  return 'other';
}

function itemVolume(kind: BcSolidKind, sx: number, sy: number, sz: number, r: number, h: number): number {
  if (kind === 'cylinder') return Number((Math.PI * r * r * (h || sz || 1)).toFixed(4));
  if (kind === 'sphere') return Number(((4 / 3) * Math.PI * r * r * r).toFixed(4));
  return Number((Math.max(0, sx) * Math.max(0, sy) * Math.max(0, sz || h)).toFixed(4));
}

function shopGeom(name: string): CadDumpRec {
  const n = name.toLowerCase();
  if (n.includes('slab') || n.includes('floor')) {
    return { kind: 'box', test: 'ShopRankerCoordination', sx: 12, sy: 8, sz: 0.15, cx: 6, cy: 4, cz: 0.075 };
  }
  if (n.includes('counter') || n.includes('furnish') || n.includes('mount')) {
    return { kind: 'box', test: 'ShopRankerCoordination', sx: 3, sy: 1.2, sz: 0.9, cx: 2.5, cy: 1.6, cz: 0.45 };
  }
  if (n.includes('column')) {
    return { kind: 'cylinder', test: 'ShopRankerCoordination', r: 0.35, h: 2.4, cx: 10, cy: 6, cz: 1.2 };
  }
  if (n.includes('duct') || n.includes('pipe')) {
    return { kind: 'box', test: 'ShopRankerCoordination', sx: 0.4, sy: 2, sz: 0.4, cx: 10, cy: 6, cz: 1.2 };
  }
  return {};
}

function makeItem(raw: CadDumpRec, index: number): BcItem {
  const name = asString(raw.name || raw.id, `item${index + 1}`);
  const shop = shopGeom(name);
  const merged = { ...shop, ...raw };
  const kind = solidKind(merged.kind || merged.shape || name);
  const test = asString(merged.test || merged.clashtest, 'ShopRankerCoordination') || 'ShopRankerCoordination';
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
    test,
    colorHex: asString(raw.colorHex) || BC_COLORS[index % BC_COLORS.length],
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

function makeClash(raw: CadDumpRec, index: number): BcClash {
  const name = asString(raw.name || raw.id, `CL-${String(index + 1).padStart(2, '0')}`);
  return {
    id: name,
    index,
    name,
    clashType: clashTypeOf(raw.clashType || raw.type || raw.kind),
    status: clashStatusOf(raw.status),
    test: asString(raw.test || raw.clashtest, 'ShopRankerCoordination') || 'ShopRankerCoordination',
    itemA: asString(raw.itemA || raw.itema || raw.a || raw.left),
    itemB: asString(raw.itemB || raw.itemb || raw.b || raw.right),
    distance: asNumber(raw.distance || raw.dist || raw.value),
    cx: asNumber(raw.cx ?? raw.x),
    cy: asNumber(raw.cy ?? raw.y),
    cz: asNumber(raw.cz ?? raw.z)
  };
}

function makeTest(raw: CadDumpRec, index: number, clashCount = 0): BcTest {
  const name = asString(raw.name || raw.id, `test${index + 1}`);
  return {
    id: name,
    index,
    name,
    description: asString(raw.description || raw.desc),
    clashCount: asNumber(raw.clashCount, clashCount)
  };
}

function finishDataset(
  name: string,
  sourceKind: BcSourceKind,
  title: string,
  encoding: string,
  reportVer: string,
  units: string,
  items: BcItem[],
  clashes: BcClash[],
  tests: BcTest[],
  warnings: string[]
): BcDataset {
  if (!items.length && !clashes.length && !tests.length) throw new Error('BIM clash dump contains no clashes or items');
  items.forEach((e, i) => (e.index = i));
  clashes.forEach((c, i) => (c.index = i));
  const counts = new Map<string, number>();
  for (const c of clashes) counts.set(c.test, (counts.get(c.test) || 0) + 1);
  if (!tests.length) {
    [...counts.keys()].forEach((n, i) => tests.push(makeTest({ name: n }, i)));
  }
  tests.forEach((d, i) => {
    d.index = i;
    d.clashCount = counts.get(d.name) || d.clashCount || 0;
  });
  const columns: BcColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'test', index: 2, name: 'test', type: 'STRING' },
    { id: 'clash', index: 3, name: 'clash', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...items.map((e) => ({ name: e.name, type: 'item', test: e.test, clash: '', value: e.kind })),
    ...tests.map((d) => ({
      name: d.name,
      type: 'test',
      test: d.name,
      clash: '',
      value: d.description || String(d.clashCount)
    })),
    ...clashes.map((c) => ({ name: c.name, type: 'clash', test: c.test, clash: c.name, value: `${c.itemA}|${c.itemB}` }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    reportVer: reportVer || '—',
    units: units || 'm',
    itemCount: items.length,
    clashCount: clashes.length,
    testCount: tests.length,
    items,
    clashes,
    tests,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: BcSourceKind = 'json', warnings: string[] = []): BcDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'ClashReport'));
  const items = ((Array.isArray(root.items) ? root.items : Array.isArray(root.elements) ? root.elements : []) as unknown[]).map((item, i) =>
    makeItem(rec(item), i)
  );
  const clashes = ((Array.isArray(root.clashes) ? root.clashes : []) as unknown[]).map((item, i) => makeClash(rec(item), i));
  const tests = ((Array.isArray(root.tests) ? root.tests : []) as unknown[]).map((item, i) => makeTest(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'clash' || sourceKind === 'xml' ? 'ASCII' : 'UTF-8',
    asString(root.reportVer || root.version, '1.0'),
    asString(root.units, 'm'),
    items,
    clashes,
    tests,
    warnings
  );
}

function parseAsciiBimClash(text: string, fileName: string): BcDataset {
  const version = /BIM clash dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /BIM clash dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'ClashReport');
  const name = prettyModelName(fileName, dumpName);
  const items: BcItem[] = [];
  const clashes: BcClash[] = [];
  const tests: BcTest[] = [];
  const itemRe =
    /\bITEM\s+([A-Za-z0-9_-]+)\s+(BOX|CYLINDER|SPHERE|PLANE)\s+([-\d.eE]+)(?:\s+([-\d.eE]+))?(?:\s+([-\d.eE]+))?(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(text))) {
    const kind = solidKind(m[2]);
    if (kind === 'cylinder') {
      items.push(makeItem({ name: m[1], kind, r: m[3], h: m[4], cx: m[6], cy: m[7], cz: m[8] }, items.length));
    } else {
      items.push(makeItem({ name: m[1], kind, sx: m[3], sy: m[4], sz: m[5], cx: m[6], cy: m[7], cz: m[8] }, items.length));
    }
  }
  const testRe = /\bTEST\s+([A-Za-z0-9_-]+)(?:\s+(.+))?$/gim;
  while ((m = testRe.exec(text))) {
    const matchName = m?.[1] ?? '';
    if (matchName && !tests.some((d) => d.name === matchName)) {
      tests.push(makeTest({ name: matchName, description: (m[2] || '').trim() }, tests.length));
    }
  }
  const clashRe =
    /\bCLASH\s+([A-Za-z0-9_-]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([-\d.eE]+)(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  while ((m = clashRe.exec(text))) {
    clashes.push(
      makeClash(
        {
          name: m[1],
          clashType: m[2],
          status: m[3],
          test: m[4],
          itemA: m[5],
          itemB: m[6],
          distance: m[7],
          cx: m[8],
          cy: m[9],
          cz: m[10]
        },
        clashes.length
      )
    );
  }
  if (!items.length && !clashes.length) throw new Error('BIM clash dump has no ITEM or CLASH entries');
  const warnings = ['ASCII BIM clash dump is a metadata subset — not Navisworks Clash Detective or Solibri geometry.'];
  return finishDataset(name, 'clash', name, 'ASCII', version, 'm', items, clashes, tests, warnings);
}

function xmlAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[2];
  return out;
}

function parseXmlClashReport(text: string, fileName: string): BcDataset {
  const report = /<clashreport\b([^>]*)>/i.exec(text);
  const reportAttrs = report ? xmlAttrs(report[1] || '') : {};
  const name = prettyModelName(fileName, asString(reportAttrs.name, 'ClashReport'));
  const version = asString(reportAttrs.version, '1.0');
  const items: BcItem[] = [];
  const clashes: BcClash[] = [];
  const tests: BcTest[] = [];
  const testRe = /<clashtest\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = testRe.exec(text))) {
    const a = xmlAttrs(m[1] || '');
    if (a.name && !tests.some((d) => d.name === a.name)) {
      tests.push(makeTest({ name: a.name, description: a.description || '' }, tests.length));
    }
  }
  const clashRe = /<clash\b([^>]*)\/?>/gi;
  while ((m = clashRe.exec(text))) {
    const a = xmlAttrs(m[1] || '');
    clashes.push(
      makeClash(
        {
          name: a.name,
          clashType: a.type,
          status: a.status,
          test: a.test || tests[0]?.name,
          itemA: a.itema,
          itemB: a.itemb,
          distance: a.distance,
          cx: a.x,
          cy: a.y,
          cz: a.z
        },
        clashes.length
      )
    );
  }
  const itemRe = /<item\b([^>]*)\/?>/gi;
  while ((m = itemRe.exec(text))) {
    const a = xmlAttrs(m[1] || '');
    items.push(
      makeItem(
        {
          name: a.name,
          kind: a.kind,
          test: a.test || tests[0]?.name,
          sx: a.sx,
          sy: a.sy,
          sz: a.sz,
          r: a.r,
          h: a.h,
          cx: a.cx,
          cy: a.cy,
          cz: a.cz
        },
        items.length
      )
    );
  }
  if (!items.length && !clashes.length) throw new Error('BIM clash XML has no clash or item entries');
  const warnings = ['Clash report XML subset maps tests and clashes — full Navisworks / Solibri reports are not expanded.'];
  return finishDataset(name, 'xml', name, 'UTF-8', version, 'm', items, clashes, tests, warnings);
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

function parseCsvAsBc(text: string, fileName: string): BcDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('BIM clash CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const items: BcItem[] = [];
  const clashes: BcClash[] = [];
  const tests: BcTest[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'test') {
      tests.push(makeTest({ name: row.name || row.test, description: row.kind || row.value }, tests.length));
      return;
    }
    if (type === 'clash') {
      clashes.push(
        makeClash(
          {
            name: row.name || row.clash,
            clashType: row.kind,
            test: row.test,
            itemA: row.value,
            itemB: row.itemB,
            distance: row.distance
          },
          clashes.length
        )
      );
      return;
    }
    items.push(
      makeItem(
        {
          name: row.name,
          test: row.test,
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
  const modelName = prettyModelName(fileName, 'ClashReport');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '1.0', 'm', items, clashes, tests, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: BcSourceKind): BcDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'ClashReport')).trim();
  const keys: string[] = [];
  const items: BcItem[] = [];
  const clashes: BcClash[] = [];
  const tests: BcTest[] = [];
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
      if (type === 'test') {
        tests.push(makeTest({ name: row.name, description: row.kind }, tests.length));
        continue;
      }
      if (type === 'clash') {
        clashes.push(makeClash({ name: row.name, clashType: row.kind, itemA: row.value }, clashes.length));
        continue;
      }
      items.push(makeItem({ name: row.name, kind: row.kind || row.type, test: row.test }, items.length));
    }
  }
  if (!items.length && !clashes.length && !tests.length) throw new Error('BIM clash markdown contains no clashes or items');
  return finishDataset(name, sourceKind, name, 'UTF-8', '1.0', 'm', items, clashes, tests, []);
}

function parseBc01(bytes: Uint8Array, fileName: string): BcDataset {
  if (bytes.length < 8) throw new Error('BIM clash dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('BIM clash dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid BC01 JSON');
  }
  return ingestJson(parsed, fileName, 'clash');
}

export function buildSampleBcBytes(): Uint8Array {
  return te.encode(BC_XML_SAMPLE);
}

export function buildSampleBcJson(): string {
  return BC_JSON_SAMPLE;
}

export function parseBcText(text: string, fileName = ''): BcDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('BIM clash dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeBimClash(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid BIM clash JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'xml' || /<clashreport\b/i.test(raw)) return parseXmlClashReport(raw, fileName);
  if (ext === 'ifc' || looksLikeBimClash(raw)) return parseAsciiBimClash(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsBc(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a BIM clash dump');
}

export function parseBcBytes(bytes: Uint8Array, fileName = ''): BcDataset {
  if (!bytes.length) throw new Error('BIM clash dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed clash reports are not supported — decompress first');
  if (isBcMagic(bytes)) return parseBc01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('Zipped clash / IFC packages are not expanded here — export an ASCII dump or JSON');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'xml' || ext === 'ifc') && !isMostlyText(bytes)) {
    throw new Error('Binary clash / IFC is not expanded here — export an ASCII dump or JSON');
  }
  return parseBcText(td.decode(bytes), fileName);
}

export function filterBcItems(items: BcItem[], query: string): BcItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('item:') || token.startsWith('name:') || token.startsWith('focus:')) {
        return e.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) {
        return `${e.kind}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('test:')) {
        return e.test.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('clash:') || token.startsWith('status:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.kind} ${e.test}`.toLowerCase().includes(token);
    })
  );
}

export function filterBcClashes(items: BcClash[], query: string): BcClash[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('clash:') || token.startsWith('name:') || token.startsWith('status:')) {
        return `${c.name} ${c.clashType} ${c.status}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('item:') || token.startsWith('type:') || token.startsWith('kind:') || token.startsWith('focus:')) {
        return `${c.itemA} ${c.itemB} ${c.clashType}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('test:')) return c.test.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('hard:') || token === 'hard') return c.clashType === 'hard';
      if (token.startsWith('clearance:') || token === 'clearance') return c.clashType === 'clearance';
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.name} ${c.clashType} ${c.status} ${c.test} ${c.itemA} ${c.itemB}`.toLowerCase().includes(token);
    })
  );
}

export function filterBcTests(items: BcTest[], query: string): BcTest[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((d) =>
    tokens.every((token) => {
      if (token.startsWith('test:') || token.startsWith('name:')) {
        return `${d.name} ${d.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('item:') || token.startsWith('clash:') || token.startsWith('row:') || token.startsWith('focus:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${d.name} ${d.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterBcRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('test:') ||
        token.startsWith('clash:') ||
        token.startsWith('kind:') ||
        token.startsWith('status:') ||
        token.startsWith('focus:')
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
