import type {
  IcColumn,
  IcDataset,
  IcDiscipline,
  IcDisciplineKind,
  IcElement,
  IcElementKind,
  IcIfcType,
  IcProperty,
  IcSourceKind
} from '../types/ifc-viewer.types';
import { IC_JSON_SAMPLE } from '../constants/ifc-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const IC_MAGIC = new Uint8Array([0x49, 0x46, 0x30, 0x31]); // IF01
const IC_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#c4b5fd', '#38bdf8'];

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

function looksLikeIfc(text: string): boolean {
  const t = text.trim();
  if (/\bIFC dump\b/i.test(t)) return true;
  if (/ISO-10303-21/i.test(t) && /\bIFC\d|\bIFC2X|\bFILE_SCHEMA\s*\(\s*\(\s*'IFC/i.test(t)) return true;
  if (/^\s*#\d+\s*=\s*IFC(?:SLAB|WALL|COLUMN|FURNISHINGELEMENT|PROPERTYSINGLEVALUE)\b/im.test(t)) return true;
  if (/^\s*ELEMENT\s+\S+/m.test(t) && /\b(?:IfcSlab|IfcColumn|IfcWall|DISCIPLINE|PROPERTY)\b/i.test(t)) return true;
  return false;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isIcMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === IC_MAGIC[0] && bytes[1] === IC_MAGIC[1] && bytes[2] === IC_MAGIC[2] && bytes[3] === IC_MAGIC[3];
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

function elementKind(raw: unknown): IcElementKind {
  const v = asString(raw).toLowerCase();
  if (v === 'box' || v === 'block' || v === 'cube' || v === 'slab' || v === 'wall') return 'box';
  if (v === 'cylinder' || v === 'cyl' || v === 'column') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'plane' || v === 'face') return 'plane';
  return 'other';
}

function ifcTypeOf(raw: unknown, name: string): IcIfcType {
  const v = asString(raw || name).toLowerCase();
  if (v === 'ifcslab' || v.includes('slab') || v.includes('floor')) return 'IfcSlab';
  if (v === 'ifcwall' || v.includes('wall')) return 'IfcWall';
  if (v === 'ifccolumn' || v.includes('column')) return 'IfcColumn';
  if (v === 'ifcfurnishingelement' || v.includes('furnish') || v.includes('counter')) return 'IfcFurnishingElement';
  if (v === 'ifcbuildingelementproxy' || v.includes('proxy')) return 'IfcBuildingElementProxy';
  if (v === 'ifcflowsegment' || v.includes('duct') || v.includes('pipe') || v.includes('mep')) return 'IfcFlowSegment';
  return 'other';
}

function disciplineOf(raw: unknown, type: IcIfcType): IcDisciplineKind {
  const v = asString(raw).toLowerCase();
  if (v === 'architecture' || v === 'arch' || v === 'architectural') return 'Architecture';
  if (v === 'structure' || v === 'structural') return 'Structure';
  if (v === 'mep' || v === 'mechanical' || v === 'electrical' || v === 'plumbing') return 'MEP';
  if (type === 'IfcColumn') return 'Structure';
  if (type === 'IfcFlowSegment') return 'MEP';
  if (type === 'IfcSlab' || type === 'IfcWall' || type === 'IfcFurnishingElement') return 'Architecture';
  return 'other';
}

function elementVolume(kind: IcElementKind, sx: number, sy: number, sz: number, r: number, h: number): number {
  if (kind === 'cylinder') return Number((Math.PI * r * r * (h || sz || 1)).toFixed(4));
  if (kind === 'sphere') return Number(((4 / 3) * Math.PI * r * r * r).toFixed(4));
  return Number((Math.max(0, sx) * Math.max(0, sy) * Math.max(0, sz || h)).toFixed(4));
}

function shopGeom(name: string): CadDumpRec {
  const n = name.toLowerCase();
  if (n.includes('slab') || n.includes('floor')) {
    return { kind: 'box', ifcType: 'IfcSlab', discipline: 'Architecture', sx: 12, sy: 8, sz: 0.15, cx: 6, cy: 4, cz: 0.075 };
  }
  if (n.includes('counter') || n.includes('furnish') || n.includes('mount')) {
    return {
      kind: 'box',
      ifcType: 'IfcFurnishingElement',
      discipline: 'Architecture',
      sx: 3,
      sy: 1.2,
      sz: 0.9,
      cx: 2.5,
      cy: 1.6,
      cz: 0.45
    };
  }
  if (n.includes('column')) {
    return { kind: 'cylinder', ifcType: 'IfcColumn', discipline: 'Structure', r: 0.35, h: 2.4, cx: 10, cy: 6, cz: 1.2 };
  }
  return {};
}

function makeElement(raw: CadDumpRec, index: number): IcElement {
  const name = asString(raw.name || raw.id, `elem${index + 1}`);
  const shop = shopGeom(name);
  const merged = { ...shop, ...raw };
  const ifcType = ifcTypeOf(merged.ifcType || merged.type, name);
  const kind = elementKind(merged.kind || merged.shape || ifcType);
  const discipline = disciplineOf(merged.discipline || merged.disc, ifcType);
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
    ifcType,
    discipline,
    colorHex: asString(raw.colorHex) || IC_COLORS[index % IC_COLORS.length],
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

function makeProperty(raw: CadDumpRec, index: number): IcProperty {
  const name = asString(raw.name || raw.id, `prop${index + 1}`);
  const pset = asString(raw.pset || raw.propertySet || raw.kind);
  const element = asString(raw.element || raw.elem);
  return {
    id: `${name}-${pset || element || index}`,
    index,
    name,
    pset,
    element,
    value: asString(raw.value ?? raw.val),
    unit: asString(raw.unit)
  };
}

function makeDiscipline(raw: CadDumpRec, index: number, elementCount = 0): IcDiscipline {
  const name = asString(raw.name || raw.id, `disc${index + 1}`);
  return {
    id: name,
    index,
    name,
    description: asString(raw.description || raw.desc),
    elementCount: asNumber(raw.elementCount, elementCount)
  };
}

function finishDataset(
  name: string,
  sourceKind: IcSourceKind,
  title: string,
  encoding: string,
  ifcVer: string,
  units: string,
  elements: IcElement[],
  properties: IcProperty[],
  disciplines: IcDiscipline[],
  warnings: string[]
): IcDataset {
  if (!elements.length && !properties.length && !disciplines.length) throw new Error('IFC dump contains no elements or properties');
  elements.forEach((e, i) => (e.index = i));
  properties.forEach((p, i) => (p.index = i));
  const counts = new Map<string, number>();
  for (const e of elements) counts.set(e.discipline, (counts.get(e.discipline) || 0) + 1);
  if (!disciplines.length) {
    [...counts.keys()].forEach((n, i) => disciplines.push(makeDiscipline({ name: n }, i)));
  }
  disciplines.forEach((d, i) => {
    d.index = i;
    d.elementCount = counts.get(d.name) || d.elementCount || 0;
  });
  const columns: IcColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'element', index: 2, name: 'element', type: 'STRING' },
    { id: 'discipline', index: 3, name: 'discipline', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...elements.map((e) => ({ name: e.name, type: 'element', element: e.name, discipline: e.discipline, value: e.ifcType })),
    ...disciplines.map((d) => ({
      name: d.name,
      type: 'discipline',
      element: '',
      discipline: d.name,
      value: d.description || String(d.elementCount)
    })),
    ...properties.map((p) => ({ name: p.name, type: 'property', element: p.element, discipline: '', value: p.value }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    ifcVer: ifcVer || '—',
    units: units || 'm',
    elementCount: elements.length,
    propCount: properties.length,
    discCount: disciplines.length,
    elements,
    properties,
    disciplines,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: IcSourceKind = 'json', warnings: string[] = []): IcDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Building'));
  const elements = ((Array.isArray(root.elements) ? root.elements : Array.isArray(root.parts) ? root.parts : []) as unknown[]).map((item, i) =>
    makeElement(rec(item), i)
  );
  const properties = ((Array.isArray(root.properties) ? root.properties : []) as unknown[]).map((item, i) => makeProperty(rec(item), i));
  const disciplines = ((Array.isArray(root.disciplines) ? root.disciplines : []) as unknown[]).map((item, i) => makeDiscipline(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'ifc' ? 'ASCII' : 'UTF-8',
    asString(root.ifcVer || root.version, 'IFC4'),
    asString(root.units, 'm'),
    elements,
    properties,
    disciplines,
    warnings
  );
}

function parseAsciiIfc(text: string, fileName: string): IcDataset {
  const version = /IFC dump\s+\S+\s+(IFC[\w.]+)/i.exec(text)?.[1] || /IFC\d(?:X\d)?/i.exec(text)?.[0] || 'IFC4';
  const dumpName = /IFC dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'Building');
  const name = prettyModelName(fileName, dumpName);
  const elements: IcElement[] = [];
  const properties: IcProperty[] = [];
  const disciplines: IcDiscipline[] = [];
  const elemRe =
    /\bELEMENT\s+([A-Za-z0-9_-]+)\s+(\S+)\s+(\S+)\s+(BOX|CYLINDER|SPHERE|PLANE)\s+([-\d.eE]+)(?:\s+([-\d.eE]+))?(?:\s+([-\d.eE]+))?(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = elemRe.exec(text))) {
    const kind = elementKind(m[4]);
    if (kind === 'cylinder') {
      elements.push(
        makeElement({ name: m[1], ifcType: m[2], discipline: m[3], kind, r: m[5], h: m[6], cx: m[8], cy: m[9], cz: m[10] }, elements.length)
      );
    } else {
      elements.push(
        makeElement(
          { name: m[1], ifcType: m[2], discipline: m[3], kind, sx: m[5], sy: m[6], sz: m[7], cx: m[8], cy: m[9], cz: m[10] },
          elements.length
        )
      );
    }
  }
  const discRe = /\bDISCIPLINE\s+([A-Za-z0-9_-]+)(?:\s+(.+))?$/gim;
  while ((m = discRe.exec(text))) {
    const matchName = m?.[1] ?? '';
    if (matchName && !disciplines.some((d) => d.name === matchName)) {
      disciplines.push(makeDiscipline({ name: matchName, description: (m[2] || '').trim() }, disciplines.length));
    }
  }
  const propRe = /\bPROPERTY\s+([A-Za-z0-9_-]+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/gi;
  while ((m = propRe.exec(text))) {
    properties.push(makeProperty({ name: m[1], pset: m[2], element: m[3], value: m[4], unit: m[5] || '' }, properties.length));
  }
  if (!elements.length && !properties.length) throw new Error('IFC dump has no ELEMENT or PROPERTY entries');
  const warnings = ['ASCII IFC dump is a metadata subset — tessellation uses dump elements, not a full IFC4 kernel.'];
  return finishDataset(name, 'ifc', name, 'ASCII', version, 'm', elements, properties, disciplines, warnings);
}

function quotedStrings(args: string): string[] {
  const out: string[] = [];
  const re = /'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(args))) out.push(m[1]);
  return out;
}

function parseStepIfc(text: string, fileName: string): IcDataset {
  const version = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i.exec(text)?.[1] || /IFC\d(?:X\d)?/i.exec(text)?.[0] || 'IFC4';
  const name = prettyModelName(fileName, 'Building');
  const elements: IcElement[] = [];
  const properties: IcProperty[] = [];
  const entRe = /#\d+\s*=\s*(IFC[A-Z0-9]+)\s*\(([\s\S]*?)\)\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = entRe.exec(text))) {
    const entity = m[1].toUpperCase();
    const strs = quotedStrings(m[2]);
    if (entity === 'IFCPROPERTYSINGLEVALUE') {
      const pname = strs[0] || `prop${properties.length + 1}`;
      const measure = /IFC[A-Z]*MEASURE\s*\(\s*([^)]+)\)/i.exec(m[2]);
      const label = /IFCLABEL\s*\(\s*'([^']*)'\s*\)/i.exec(m[2]);
      properties.push(
        makeProperty(
          { name: pname, pset: 'Pset', element: name, value: label?.[1] || measure?.[1]?.replace(/['.]/g, '') || strs[1] || '' },
          properties.length
        )
      );
      continue;
    }
    if (!/^IFC(?:SLAB|WALL|COLUMN|FURNISHINGELEMENT|BUILDINGELEMENTPROXY|FLOWSEGMENT)$/.test(entity)) continue;
    const elemName = strs[1] || strs[0] || entity.toLowerCase();
    elements.push(makeElement({ name: elemName, ifcType: entity }, elements.length));
  }
  if (!elements.length && !properties.length) throw new Error('IFC STEP dump has no IFC entities');
  const warnings = ['IFC STEP subset maps named entities to shop tessellation — full IFC geometry is not expanded.'];
  return finishDataset(name, 'ifc', name, 'ASCII', version, 'm', elements, properties, [], warnings);
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

function parseCsvAsIc(text: string, fileName: string): IcDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('IFC CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const elements: IcElement[] = [];
  const properties: IcProperty[] = [];
  const disciplines: IcDiscipline[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'discipline') {
      disciplines.push(makeDiscipline({ name: row.name || row.discipline, description: row.kind || row.value }, disciplines.length));
      return;
    }
    if (type === 'property') {
      properties.push(
        makeProperty(
          { name: row.name, pset: row.kind || row.pset, element: row.element, value: row.value, unit: row.unit },
          properties.length
        )
      );
      return;
    }
    elements.push(
      makeElement(
        {
          name: row.name,
          ifcType: row.kind || row.ifcType,
          discipline: row.discipline,
          kind: row.value || row.kind,
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
  const modelName = prettyModelName(fileName, 'Building');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'IFC4', 'm', elements, properties, disciplines, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: IcSourceKind): IcDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Building')).trim();
  const keys: string[] = [];
  const elements: IcElement[] = [];
  const properties: IcProperty[] = [];
  const disciplines: IcDiscipline[] = [];
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
      if (type === 'property') {
        properties.push(makeProperty({ name: row.name, pset: row.kind, element: row.element || name, value: row.kind }, properties.length));
        continue;
      }
      elements.push(makeElement({ name: row.name, ifcType: row.kind || row.type, kind: row.kind }, elements.length));
    }
  }
  if (!elements.length && !properties.length && !disciplines.length) throw new Error('IFC markdown contains no elements or properties');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'IFC4', 'm', elements, properties, disciplines, []);
}

function parseIc01(bytes: Uint8Array, fileName: string): IcDataset {
  if (bytes.length < 8) throw new Error('IFC dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('IFC dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid IF01 JSON');
  }
  return ingestJson(parsed, fileName, 'ifc');
}

export function buildSampleIcBytes(): Uint8Array {
  const json = te.encode(IC_JSON_SAMPLE);
  const out: number[] = [...IC_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleIcJson(): string {
  return IC_JSON_SAMPLE;
}

export function parseIcText(text: string, fileName = ''): IcDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('IFC dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeIfc(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid IFC JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (/ISO-10303-21/i.test(raw) && /IFC/i.test(raw)) return parseStepIfc(raw, fileName);
  if (ext === 'ifc' || ext === 'ifcxml' || looksLikeIfc(raw)) return parseAsciiIfc(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsIc(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an IFC dump');
}

export function parseIcBytes(bytes: Uint8Array, fileName = ''): IcDataset {
  if (!bytes.length) throw new Error('IFC dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed IFC files are not supported — decompress first');
  if (isIcMagic(bytes)) return parseIc01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('IFCZIP / ZIP IFC is not expanded here — export an ASCII dump or JSON');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'ifc' || ext === 'ifcxml') && !isMostlyText(bytes)) {
    throw new Error('Binary IFC is not expanded here — export an ASCII dump or JSON');
  }
  return parseIcText(td.decode(bytes), fileName);
}

export function filterIcElements(items: IcElement[], query: string): IcElement[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('elem:') || token.startsWith('element:') || token.startsWith('name:')) {
        return e.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:') || token.startsWith('ifc:')) {
        return `${e.kind} ${e.ifcType}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('disc:') || token.startsWith('discipline:')) {
        return e.discipline.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('prop:') || token.startsWith('property:') || token.startsWith('pset:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.kind} ${e.ifcType} ${e.discipline}`.toLowerCase().includes(token);
    })
  );
}

export function filterIcProperties(items: IcProperty[], query: string): IcProperty[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('prop:') || token.startsWith('property:') || token.startsWith('name:') || token.startsWith('pset:')) {
        return `${p.name} ${p.pset} ${p.value}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('elem:') || token.startsWith('element:')) return p.element.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('disc:') || token.startsWith('discipline:') || token.startsWith('type:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.pset} ${p.element} ${p.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterIcDisciplines(items: IcDiscipline[], query: string): IcDiscipline[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((d) =>
    tokens.every((token) => {
      if (token.startsWith('disc:') || token.startsWith('discipline:') || token.startsWith('name:')) {
        return `${d.name} ${d.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('elem:') || token.startsWith('element:') || token.startsWith('prop:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${d.name} ${d.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterIcRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('prop:') ||
        token.startsWith('property:') ||
        token.startsWith('pset:') ||
        token.startsWith('ifc:')
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
