import type {
  MeColumn,
  MeDataset,
  MeDiscipline,
  MeDisciplineKind,
  MeElement,
  MeSolidKind,
  MeSourceKind,
  MeSystem
} from '../types/mep-model-viewer.types';
import { ME_JSON_SAMPLE } from '../constants/mep-model-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const ME_MAGIC = new Uint8Array([0x4d, 0x45, 0x30, 0x31]); // ME01
const ME_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#c4b5fd', '#38bdf8'];

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

function looksLikeMep(text: string): boolean {
  const t = text.trim();
  if (/\b(?:NAVIS|FLOOR|PLAN|BIM clash|IFC) dump\b/i.test(t)) return false;
  if (/\bMEP dump\b/i.test(t)) return true;
  if (/^\s*DISCIPLINE\s+\S+/m.test(t) && /^\s*(?:ELEMENT|SYSTEM)\s+/m.test(t) && /\b(?:Mechanical|Electrical|Plumbing)\b/i.test(t)) {
    return true;
  }
  if (/ISO-10303-21/i.test(t) && /\bIFC(?:FLOWSEGMENT|FLOWTERMINAL|DISTRIBUTIONSYSTEM)\b/i.test(t)) return true;
  return false;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isMeMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === ME_MAGIC[0] && bytes[1] === ME_MAGIC[1] && bytes[2] === ME_MAGIC[2] && bytes[3] === ME_MAGIC[3];
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

function solidKind(raw: unknown): MeSolidKind {
  const v = asString(raw).toLowerCase();
  if (v === 'box' || v === 'block' || v === 'cube' || v === 'duct' || v === 'tray' || v === 'ahu') return 'box';
  if (v === 'cylinder' || v === 'cyl' || v === 'pipe') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'plane' || v === 'face') return 'plane';
  return 'other';
}

function disciplineOf(raw: unknown, name = ''): MeDisciplineKind {
  const v = `${asString(raw)} ${name}`.toLowerCase();
  if (v.includes('mech') || v.includes('hvac') || v.includes('duct') || v.includes('ahu')) return 'Mechanical';
  if (v.includes('elec') || v.includes('light') || v.includes('tray') || v.includes('power')) return 'Electrical';
  if (v.includes('plumb') || v.includes('pipe') || v.includes('water')) return 'Plumbing';
  return 'other';
}

function elementVolume(kind: MeSolidKind, sx: number, sy: number, sz: number, r: number, h: number): number {
  if (kind === 'cylinder') return Number((Math.PI * r * r * (h || sz || 1)).toFixed(4));
  if (kind === 'sphere') return Number(((4 / 3) * Math.PI * r * r * r).toFixed(4));
  return Number((Math.max(0, sx) * Math.max(0, sy) * Math.max(0, sz || h)).toFixed(4));
}

function shopGeom(name: string): CadDumpRec {
  const n = name.toLowerCase();
  if (n.includes('duct')) {
    return { kind: 'box', discipline: 'Mechanical', system: 'SupplyAir', sx: 0.4, sy: 2, sz: 0.4, cx: 10, cy: 6, cz: 1.2 };
  }
  if (n.includes('pipe')) {
    return { kind: 'box', discipline: 'Plumbing', system: 'DomesticWater', sx: 0.1, sy: 4, sz: 0.1, cx: 2.5, cy: 3, cz: 0.35 };
  }
  if (n.includes('tray')) {
    return { kind: 'box', discipline: 'Electrical', system: 'Lighting', sx: 0.3, sy: 6, sz: 0.08, cx: 6, cy: 4, cz: 2.4 };
  }
  if (n.includes('ahu') || n.includes('air')) {
    return { kind: 'box', discipline: 'Mechanical', system: 'SupplyAir', sx: 1.2, sy: 0.8, sz: 0.9, cx: 9, cy: 1.5, cz: 0.45 };
  }
  return {};
}

function makeElement(raw: CadDumpRec, index: number): MeElement {
  const name = asString(raw.name || raw.id, `elem${index + 1}`);
  const shop = shopGeom(name);
  const merged = { ...shop, ...raw };
  const kind = solidKind(merged.kind || merged.shape || name);
  const discipline = disciplineOf(merged.discipline || merged.disc, name);
  const sx = asNumber(merged.sx ?? merged.width ?? merged.dx, kind === 'box' ? 1 : 0);
  const sy = asNumber(merged.sy ?? merged.depth ?? merged.dy, kind === 'box' ? 1 : 0);
  const sz = asNumber(merged.sz ?? merged.height ?? merged.dz, kind === 'box' ? 1 : 0);
  const r = asNumber(merged.r ?? merged.radius, kind === 'cylinder' || kind === 'sphere' ? 0.08 : 0);
  const h = asNumber(merged.h ?? merged.height, kind === 'cylinder' ? 1 : sz);
  return {
    id: name,
    index,
    name,
    kind,
    discipline,
    system: asString(merged.system || merged.sys, 'SupplyAir') || 'SupplyAir',
    colorHex: asString(raw.colorHex) || ME_COLORS[index % ME_COLORS.length],
    cx: asNumber(merged.cx ?? merged.x),
    cy: asNumber(merged.cy ?? merged.y),
    cz: asNumber(merged.cz ?? merged.z),
    sx,
    sy,
    sz,
    r,
    h,
    volume: asNumber(raw.volume, elementVolume(kind, sx, sy, sz, r, h))
  };
}

function makeSystem(raw: CadDumpRec, index: number, elementCount = 0): MeSystem {
  const name = asString(raw.name || raw.id, `sys${index + 1}`);
  return {
    id: name,
    index,
    name,
    discipline: asString(raw.discipline || raw.disc),
    description: asString(raw.description || raw.desc || raw.kind),
    elementCount: asNumber(raw.elementCount, elementCount)
  };
}

function makeDiscipline(raw: CadDumpRec, index: number, elementCount = 0): MeDiscipline {
  const name = asString(raw.name || raw.id, `disc${index + 1}`);
  return {
    id: name,
    index,
    name,
    description: asString(raw.description || raw.desc || raw.kind),
    elementCount: asNumber(raw.elementCount, elementCount)
  };
}

function finishDataset(
  name: string,
  sourceKind: MeSourceKind,
  title: string,
  encoding: string,
  mepVer: string,
  units: string,
  elements: MeElement[],
  systems: MeSystem[],
  disciplines: MeDiscipline[],
  warnings: string[]
): MeDataset {
  if (!elements.length && !systems.length && !disciplines.length) throw new Error('MEP dump contains no elements or systems');
  elements.forEach((e, i) => (e.index = i));
  systems.forEach((s, i) => (s.index = i));
  const discCounts = new Map<string, number>();
  const sysCounts = new Map<string, number>();
  for (const e of elements) {
    discCounts.set(e.discipline, (discCounts.get(e.discipline) || 0) + 1);
    sysCounts.set(e.system, (sysCounts.get(e.system) || 0) + 1);
  }
  if (!disciplines.length) {
    [...discCounts.keys()].forEach((n, i) => disciplines.push(makeDiscipline({ name: n }, i)));
  }
  if (!systems.length) {
    [...sysCounts.keys()].forEach((n, i) => systems.push(makeSystem({ name: n }, i)));
  }
  disciplines.forEach((d, i) => {
    d.index = i;
    d.elementCount = discCounts.get(d.name) || d.elementCount || 0;
  });
  systems.forEach((s, i) => {
    s.index = i;
    s.elementCount = sysCounts.get(s.name) || s.elementCount || 0;
  });
  const columns: MeColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'discipline', index: 2, name: 'discipline', type: 'STRING' },
    { id: 'system', index: 3, name: 'system', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...elements.map((e) => ({ name: e.name, type: 'element', discipline: String(e.discipline), system: e.system, value: e.kind })),
    ...disciplines.map((d) => ({
      name: d.name,
      type: 'discipline',
      discipline: d.name,
      system: '',
      value: d.description || String(d.elementCount)
    })),
    ...systems.map((s) => ({ name: s.name, type: 'system', discipline: s.discipline, system: s.name, value: s.description }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    mepVer: mepVer || '—',
    units: units || 'm',
    elementCount: elements.length,
    systemCount: systems.length,
    discCount: disciplines.length,
    elements,
    systems,
    disciplines,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: MeSourceKind = 'json', warnings: string[] = []): MeDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'MepModel'));
  const elements = ((Array.isArray(root.elements) ? root.elements : []) as unknown[]).map((item, i) => makeElement(rec(item), i));
  const systems = ((Array.isArray(root.systems) ? root.systems : []) as unknown[]).map((item, i) => makeSystem(rec(item), i));
  const disciplines = ((Array.isArray(root.disciplines) ? root.disciplines : []) as unknown[]).map((item, i) => makeDiscipline(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'mep' ? 'ASCII' : 'UTF-8',
    asString(root.mepVer || root.version, '1.0'),
    asString(root.units, 'm'),
    elements,
    systems,
    disciplines,
    warnings
  );
}

function parseAsciiMep(text: string, fileName: string): MeDataset {
  const version = /MEP dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /MEP dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'MepModel');
  const name = prettyModelName(fileName, dumpName);
  const elements: MeElement[] = [];
  const systems: MeSystem[] = [];
  const disciplines: MeDiscipline[] = [];
  let m: RegExpExecArray | null;
  const discRe = /\bDISCIPLINE\s+([A-Za-z0-9_-]+)(?:\s+(.+))?$/gim;
  while ((m = discRe.exec(text))) {
    const matchName = m?.[1] ?? '';
    if (matchName && !disciplines.some((d) => d.name === matchName)) {
      disciplines.push(makeDiscipline({ name: matchName, description: (m[2] || '').trim() }, disciplines.length));
    }
  }
  const sysRe = /\bSYSTEM\s+([A-Za-z0-9_-]+)\s+(\S+)(?:\s+(.+))?$/gim;
  while ((m = sysRe.exec(text))) {
    const matchName = m?.[1] ?? '';
    if (matchName && !systems.some((s) => s.name === matchName)) {
      systems.push(makeSystem({ name: matchName, discipline: m[2], description: (m[3] || '').trim() }, systems.length));
    }
  }
  const elemRe =
    /\bELEMENT\s+([A-Za-z0-9_-]+)\s+(\S+)\s+(\S+)\s+(BOX|CYLINDER|SPHERE|PLANE)\s+([-\d.eE]+)(?:\s+([-\d.eE]+))?(?:\s+([-\d.eE]+))?(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  while ((m = elemRe.exec(text))) {
    const kind = solidKind(m[4]);
    if (kind === 'cylinder') {
      elements.push(
        makeElement({ name: m[1], discipline: m[2], system: m[3], kind, r: m[5], h: m[6], cx: m[8], cy: m[9], cz: m[10] }, elements.length)
      );
    } else {
      elements.push(
        makeElement(
          { name: m[1], discipline: m[2], system: m[3], kind, sx: m[5], sy: m[6], sz: m[7], cx: m[8], cy: m[9], cz: m[10] },
          elements.length
        )
      );
    }
  }
  if (!elements.length && !systems.length) throw new Error('MEP dump has no ELEMENT or SYSTEM entries');
  const warnings = ['ASCII MEP dump is a metadata subset — not MagiCAD, Revit MEP, or a full IFC MEP kernel.'];
  return finishDataset(name, 'mep', name, 'ASCII', version, 'm', elements, systems, disciplines, warnings);
}

function quotedStrings(args: string): string[] {
  const out: string[] = [];
  const re = /'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(args))) out.push(m[1]);
  return out;
}

function parseStepMep(text: string, fileName: string): MeDataset {
  const name = prettyModelName(fileName, 'MepModel');
  const elements: MeElement[] = [];
  const systems: MeSystem[] = [];
  const entRe = /#\d+\s*=\s*(IFC[A-Z0-9]+)\s*\(([\s\S]*?)\)\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = entRe.exec(text))) {
    const entity = m[1].toUpperCase();
    const strs = quotedStrings(m[2]);
    const label = strs[0] || entity.toLowerCase();
    if (entity === 'IFCDISTRIBUTIONSYSTEM') {
      systems.push(makeSystem({ name: label }, systems.length));
      continue;
    }
    if (entity === 'IFCFLOWSEGMENT' || entity === 'IFCFLOWTERMINAL') {
      elements.push(makeElement({ name: label }, elements.length));
    }
  }
  if (!elements.length && !systems.length) throw new Error('IFC MEP subset has no flow segments or systems');
  const warnings = ['IFC MEP subset maps named flow entities to shop tessellation — full IFC geometry is not expanded.'];
  return finishDataset(name, 'mep', name, 'ASCII', 'IFC4', 'm', elements, systems, [], warnings);
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

function parseCsvAsMe(text: string, fileName: string): MeDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('MEP CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const elements: MeElement[] = [];
  const systems: MeSystem[] = [];
  const disciplines: MeDiscipline[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'discipline') {
      disciplines.push(makeDiscipline({ name: row.name || row.discipline, description: row.kind || row.value }, disciplines.length));
      return;
    }
    if (type === 'system') {
      systems.push(
        makeSystem({ name: row.name || row.system, discipline: row.discipline, description: row.value || row.kind }, systems.length)
      );
      return;
    }
    elements.push(
      makeElement(
        {
          name: row.name,
          discipline: row.discipline,
          system: row.system,
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
        elements.length
      )
    );
  });
  const modelName = prettyModelName(fileName, 'MepModel');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '1.0', 'm', elements, systems, disciplines, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: MeSourceKind): MeDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'MepModel')).trim();
  const keys: string[] = [];
  const elements: MeElement[] = [];
  const systems: MeSystem[] = [];
  const disciplines: MeDiscipline[] = [];
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
      if (type === 'discipline') {
        disciplines.push(makeDiscipline({ name: row.name, description: row.kind }, disciplines.length));
        continue;
      }
      if (type === 'system') {
        systems.push(makeSystem({ name: row.name, discipline: row.kind, description: row.kind }, systems.length));
        continue;
      }
      elements.push(makeElement({ name: row.name, kind: row.kind || row.type, discipline: row.discipline, system: row.system }, elements.length));
    }
  }
  if (!elements.length && !systems.length && !disciplines.length) throw new Error('MEP markdown contains no elements or systems');
  return finishDataset(name, sourceKind, name, 'UTF-8', '1.0', 'm', elements, systems, disciplines, []);
}

function parseMe01(bytes: Uint8Array, fileName: string): MeDataset {
  if (bytes.length < 8) throw new Error('MEP dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('MEP dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid ME01 JSON');
  }
  return ingestJson(parsed, fileName, 'mep');
}

export function buildSampleMeBytes(): Uint8Array {
  const json = te.encode(ME_JSON_SAMPLE);
  const out: number[] = [...ME_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleMeJson(): string {
  return ME_JSON_SAMPLE;
}

export function parseMeText(text: string, fileName = ''): MeDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('MEP dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeMep(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid MEP JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (/ISO-10303-21/i.test(raw) && /\bIFC(?:FLOWSEGMENT|FLOWTERMINAL|DISTRIBUTIONSYSTEM)\b/i.test(raw)) {
    return parseStepMep(raw, fileName);
  }
  if (ext === 'ifc' || ext === 'ifcxml' || looksLikeMep(raw)) return parseAsciiMep(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsMe(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an MEP dump');
}

export function parseMeBytes(bytes: Uint8Array, fileName = ''): MeDataset {
  if (!bytes.length) throw new Error('MEP dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed MEP files are not supported — decompress first');
  if (isMeMagic(bytes)) return parseMe01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('IFCZIP / ZIP MEP is not expanded here — export an ASCII dump or JSON');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'ifc' || ext === 'ifcxml') && !isMostlyText(bytes)) {
    throw new Error('Binary MEP IFC is not expanded here — export an ASCII dump or JSON');
  }
  return parseMeText(td.decode(bytes), fileName);
}

export function filterMeElements(items: MeElement[], query: string): MeElement[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('elem:') || token.startsWith('element:') || token.startsWith('name:') || token.startsWith('mep:')) {
        return e.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) {
        return `${e.kind}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('disc:') || token.startsWith('discipline:')) {
        return String(e.discipline).toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('sys:') || token.startsWith('system:')) {
        return e.system.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.kind} ${e.discipline} ${e.system}`.toLowerCase().includes(token);
    })
  );
}

export function filterMeSystems(items: MeSystem[], query: string): MeSystem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('sys:') || token.startsWith('system:') || token.startsWith('name:')) {
        return `${s.name} ${s.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('disc:') || token.startsWith('discipline:')) {
        return s.discipline.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('elem:') || token.startsWith('element:') || token.startsWith('row:') || token.startsWith('mep:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.discipline} ${s.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterMeDisciplines(items: MeDiscipline[], query: string): MeDiscipline[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((d) =>
    tokens.every((token) => {
      if (token.startsWith('disc:') || token.startsWith('discipline:') || token.startsWith('name:')) {
        return `${d.name} ${d.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('elem:') || token.startsWith('sys:') || token.startsWith('row:') || token.startsWith('mep:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${d.name} ${d.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterMeRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('elem:') ||
        token.startsWith('element:') ||
        token.startsWith('disc:') ||
        token.startsWith('discipline:') ||
        token.startsWith('sys:') ||
        token.startsWith('system:') ||
        token.startsWith('kind:') ||
        token.startsWith('mep:')
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
