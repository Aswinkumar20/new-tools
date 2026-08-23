import type {
  SrColumn,
  SrDataset,
  SrMember,
  SrMemberType,
  SrProperty,
  SrSection,
  SrSolidKind,
  SrSourceKind
} from '../types/structural-model-viewer.types';
import { SR_JSON_SAMPLE } from '../constants/structural-model-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const SR_MAGIC = new Uint8Array([0x53, 0x4d, 0x30, 0x31]); // SM01
const SR_COLORS = ['#fbbf24', '#60a5fa', '#f87171', '#34d399', '#c4b5fd', '#38bdf8'];

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

function looksLikeStructural(text: string): boolean {
  const t = text.trim();
  if (/\b(?:NAVIS|FLOOR|PLAN|MEP|BIM clash|IFC) dump\b/i.test(t)) return false;
  if (/\bSTRUCT(?:URAL)? dump\b/i.test(t)) return true;
  if (/^\s*MEMBER\s+\S+/m.test(t) && /^\s*(?:PROPERTY|SECTION)\s+/m.test(t)) return true;
  if (/ISO-10303-21/i.test(t) && /\bIFC(?:BEAM|MEMBER|FOOTING)\b/i.test(t)) return true;
  return false;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isSrMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === SR_MAGIC[0] && bytes[1] === SR_MAGIC[1] && bytes[2] === SR_MAGIC[2] && bytes[3] === SR_MAGIC[3];
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

function solidKind(raw: unknown): SrSolidKind {
  const v = asString(raw).toLowerCase();
  if (v === 'box' || v === 'block' || v === 'cube' || v === 'slab' || v === 'beam' || v === 'footing') return 'box';
  if (v === 'cylinder' || v === 'cyl' || v === 'column') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'plane' || v === 'face') return 'plane';
  return 'other';
}

function memberTypeOf(raw: unknown, name = ''): SrMemberType {
  const v = `${asString(raw)} ${name}`.toLowerCase();
  if (v.includes('beam')) return 'Beam';
  if (v.includes('column') || v.includes('col')) return 'Column';
  if (v.includes('slab')) return 'Slab';
  if (v.includes('footing') || v.includes('foundation')) return 'Footing';
  if (v.includes('member')) return 'Member';
  return 'other';
}

function memberVolume(kind: SrSolidKind, sx: number, sy: number, sz: number, r: number, h: number): number {
  if (kind === 'cylinder') return Number((Math.PI * r * r * (h || sz || 1)).toFixed(4));
  if (kind === 'sphere') return Number(((4 / 3) * Math.PI * r * r * r).toFixed(4));
  return Number((Math.max(0, sx) * Math.max(0, sy) * Math.max(0, sz || h)).toFixed(4));
}

function shopGeom(name: string): CadDumpRec {
  const n = name.toLowerCase();
  if (n.includes('slab')) {
    return { kind: 'box', memberType: 'Slab', section: 'Slabs', sx: 12, sy: 8, sz: 0.15, cx: 6, cy: 4, cz: 0.075 };
  }
  if (n.includes('column') || n === 'col') {
    return { kind: 'cylinder', memberType: 'Column', section: 'Columns', r: 0.35, h: 2.4, cx: 10, cy: 6, cz: 1.2 };
  }
  if (n.includes('beam')) {
    return { kind: 'box', memberType: 'Beam', section: 'Beams', sx: 8, sy: 0.3, sz: 0.4, cx: 6, cy: 6, cz: 2.4 };
  }
  if (n.includes('footing') || n.includes('foundation')) {
    return { kind: 'box', memberType: 'Footing', section: 'Columns', sx: 0.8, sy: 0.8, sz: 0.4, cx: 10, cy: 6, cz: 0.2 };
  }
  return {};
}

function makeMember(raw: CadDumpRec, index: number): SrMember {
  const name = asString(raw.name || raw.id, `mem${index + 1}`);
  const shop = shopGeom(name);
  const merged = { ...shop, ...raw };
  const kind = solidKind(merged.kind || merged.shape || name);
  const memberType = memberTypeOf(merged.memberType || merged.type, name);
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
    memberType,
    section: asString(merged.section || merged.sec, 'Columns') || 'Columns',
    colorHex: asString(raw.colorHex) || SR_COLORS[index % SR_COLORS.length],
    cx: asNumber(merged.cx ?? merged.x),
    cy: asNumber(merged.cy ?? merged.y),
    cz: asNumber(merged.cz ?? merged.z),
    sx,
    sy,
    sz,
    r,
    h,
    volume: asNumber(raw.volume, memberVolume(kind, sx, sy, sz, r, h))
  };
}

function makeProperty(raw: CadDumpRec, index: number): SrProperty {
  const name = asString(raw.name || raw.id, `prop${index + 1}`);
  return {
    id: name,
    index,
    name,
    pset: asString(raw.pset || raw.set, 'Pset') || 'Pset',
    member: asString(raw.member || raw.mem),
    value: asString(raw.value || raw.val || raw.description),
    unit: asString(raw.unit)
  };
}

function makeSection(raw: CadDumpRec, index: number, memberCount = 0): SrSection {
  const name = asString(raw.name || raw.id, `sec${index + 1}`);
  return {
    id: name,
    index,
    name,
    description: asString(raw.description || raw.desc || raw.kind),
    memberCount: asNumber(raw.memberCount, memberCount)
  };
}

function finishDataset(
  name: string,
  sourceKind: SrSourceKind,
  title: string,
  encoding: string,
  structVer: string,
  units: string,
  members: SrMember[],
  properties: SrProperty[],
  sections: SrSection[],
  warnings: string[]
): SrDataset {
  if (!members.length && !properties.length && !sections.length) throw new Error('Structural dump contains no members or properties');
  members.forEach((m, i) => (m.index = i));
  properties.forEach((p, i) => (p.index = i));
  const secCounts = new Map<string, number>();
  for (const m of members) secCounts.set(m.section, (secCounts.get(m.section) || 0) + 1);
  if (!sections.length) {
    [...secCounts.keys()].forEach((n, i) => sections.push(makeSection({ name: n }, i)));
  }
  sections.forEach((s, i) => {
    s.index = i;
    s.memberCount = secCounts.get(s.name) || s.memberCount || 0;
  });
  const columns: SrColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'section', index: 2, name: 'section', type: 'STRING' },
    { id: 'member', index: 3, name: 'member', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...members.map((m) => ({ name: m.name, type: 'member', section: m.section, member: m.name, value: m.memberType })),
    ...sections.map((s) => ({
      name: s.name,
      type: 'section',
      section: s.name,
      member: '',
      value: s.description || String(s.memberCount)
    })),
    ...properties.map((p) => ({ name: p.name, type: 'property', section: p.pset, member: p.member, value: p.value }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    structVer: structVer || '—',
    units: units || 'm',
    memberCount: members.length,
    propCount: properties.length,
    sectionCount: sections.length,
    members,
    properties,
    sections,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: SrSourceKind = 'json', warnings: string[] = []): SrDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'StructuralModel'));
  const members = ((Array.isArray(root.members) ? root.members : []) as unknown[]).map((item, i) => makeMember(rec(item), i));
  const properties = ((Array.isArray(root.properties) ? root.properties : []) as unknown[]).map((item, i) => makeProperty(rec(item), i));
  const sections = ((Array.isArray(root.sections) ? root.sections : []) as unknown[]).map((item, i) => makeSection(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'structural' ? 'ASCII' : 'UTF-8',
    asString(root.structVer || root.version, '1.0'),
    asString(root.units, 'm'),
    members,
    properties,
    sections,
    warnings
  );
}

function parseAsciiStructural(text: string, fileName: string): SrDataset {
  const version = /STRUCT(?:URAL)? dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /STRUCT(?:URAL)? dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'StructuralModel');
  const name = prettyModelName(fileName, dumpName);
  const members: SrMember[] = [];
  const properties: SrProperty[] = [];
  const sections: SrSection[] = [];
  let m: RegExpExecArray | null;
  const secRe = /\bSECTION\s+([A-Za-z0-9_-]+)(?:\s+(.+))?$/gim;
  while ((m = secRe.exec(text))) {
    const matchName = m?.[1] ?? '';
    if (matchName && !sections.some((s) => s.name === matchName)) {
      sections.push(makeSection({ name: matchName, description: (m[2] || '').trim() }, sections.length));
    }
  }
  const propRe = /\bPROPERTY\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?$/gim;
  while ((m = propRe.exec(text))) {
    const matchName = m?.[1] ?? '';
    if (matchName && !properties.some((p) => p.name === matchName)) {
      properties.push(makeProperty({ name: matchName, pset: m[2], member: m[3], value: m[4], unit: m[5] || '' }, properties.length));
    }
  }
  const memRe =
    /\bMEMBER\s+([A-Za-z0-9_-]+)\s+(\S+)\s+(BOX|CYLINDER|SPHERE|PLANE)\s+([-\d.eE]+)(?:\s+([-\d.eE]+))?(?:\s+([-\d.eE]+))?(?:\s+AT\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+))?/gi;
  while ((m = memRe.exec(text))) {
    const kind = solidKind(m[3]);
    if (kind === 'cylinder') {
      members.push(makeMember({ name: m[1], section: m[2], kind, r: m[4], h: m[5], cx: m[7], cy: m[8], cz: m[9] }, members.length));
    } else {
      members.push(
        makeMember(
          { name: m[1], section: m[2], kind, sx: m[4], sy: m[5], sz: m[6], cx: m[7], cy: m[8], cz: m[9] },
          members.length
        )
      );
    }
  }
  if (!members.length && !properties.length) throw new Error('Structural dump has no MEMBER or PROPERTY entries');
  const warnings = ['ASCII structural dump is a metadata subset — not Tekla, Robot, or a full IFC structural kernel.'];
  return finishDataset(name, 'structural', name, 'ASCII', version, 'm', members, properties, sections, warnings);
}

function quotedStrings(args: string): string[] {
  const out: string[] = [];
  const re = /'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(args))) out.push(match[1]);
  return out;
}

function parseStepStructural(text: string, fileName: string): SrDataset {
  const name = prettyModelName(fileName, 'StructuralModel');
  const members: SrMember[] = [];
  const properties: SrProperty[] = [];
  const entRe = /#\d+\s*=\s*(IFC[A-Z0-9]+)\s*\(([\s\S]*?)\)\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = entRe.exec(text))) {
    const entity = m[1].toUpperCase();
    const strs = quotedStrings(m[2]);
    const label = strs[0] || entity.toLowerCase();
    if (entity === 'IFCPROPERTYSINGLEVALUE') {
      const num = /\((\d+(?:\.\d+)?)\)/.exec(m[2]);
      properties.push(makeProperty({ name: label, value: num?.[1] || strs[1] || label }, properties.length));
      continue;
    }
    if (entity === 'IFCBEAM' || entity === 'IFCCOLUMN' || entity === 'IFCMEMBER' || entity === 'IFCFOOTING' || entity === 'IFCSLAB') {
      members.push(makeMember({ name: label }, members.length));
    }
  }
  if (!members.length && !properties.length) throw new Error('IFC structural subset has no beams, members, or properties');
  const warnings = ['IFC structural subset maps named members to shop tessellation — full IFC geometry is not expanded.'];
  return finishDataset(name, 'structural', name, 'ASCII', 'IFC4', 'm', members, properties, [], warnings);
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

function parseCsvAsSr(text: string, fileName: string): SrDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Structural CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const members: SrMember[] = [];
  const properties: SrProperty[] = [];
  const sections: SrSection[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'section') {
      sections.push(makeSection({ name: row.name || row.section, description: row.kind || row.value }, sections.length));
      return;
    }
    if (type === 'property') {
      properties.push(
        makeProperty(
          { name: row.name, pset: row.kind || row.section, member: row.member, value: row.value },
          properties.length
        )
      );
      return;
    }
    members.push(
      makeMember(
        {
          name: row.name,
          section: row.section,
          memberType: row.value || row.kind,
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
        members.length
      )
    );
  });
  const modelName = prettyModelName(fileName, 'StructuralModel');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '1.0', 'm', members, properties, sections, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: SrSourceKind): SrDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'StructuralModel')).trim();
  const keys: string[] = [];
  const members: SrMember[] = [];
  const properties: SrProperty[] = [];
  const sections: SrSection[] = [];
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
      if (type === 'section') {
        sections.push(makeSection({ name: row.name, description: row.kind }, sections.length));
        continue;
      }
      if (type === 'property') {
        properties.push(makeProperty({ name: row.name, pset: row.kind, value: row.kind }, properties.length));
        continue;
      }
      members.push(makeMember({ name: row.name, kind: row.kind || row.type, section: row.section, memberType: row.kind }, members.length));
    }
  }
  if (!members.length && !properties.length && !sections.length) throw new Error('Structural markdown contains no members or properties');
  return finishDataset(name, sourceKind, name, 'UTF-8', '1.0', 'm', members, properties, sections, []);
}

function parseSm01(bytes: Uint8Array, fileName: string): SrDataset {
  if (bytes.length < 8) throw new Error('Structural dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('Structural dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid SM01 JSON');
  }
  return ingestJson(parsed, fileName, 'structural');
}

export function buildSampleSrBytes(): Uint8Array {
  const json = te.encode(SR_JSON_SAMPLE);
  const out: number[] = [...SR_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleSrJson(): string {
  return SR_JSON_SAMPLE;
}

export function parseSrText(text: string, fileName = ''): SrDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Structural dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeStructural(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Structural JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (/ISO-10303-21/i.test(raw) && /\bIFC(?:BEAM|MEMBER|FOOTING|COLUMN|SLAB|PROPERTYSINGLEVALUE)\b/i.test(raw) && /\bIFC(?:BEAM|MEMBER|FOOTING)\b/i.test(raw)) {
    return parseStepStructural(raw, fileName);
  }
  if (ext === 'ifc' || ext === 'ifcxml' || looksLikeStructural(raw)) return parseAsciiStructural(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsSr(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a Structural dump');
}

export function parseSrBytes(bytes: Uint8Array, fileName = ''): SrDataset {
  if (!bytes.length) throw new Error('Structural dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed structural files are not supported — decompress first');
  if (isSrMagic(bytes)) return parseSm01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('IFCZIP / ZIP structural is not expanded here — export an ASCII dump or JSON');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'ifc' || ext === 'ifcxml') && !isMostlyText(bytes)) {
    throw new Error('Binary structural IFC is not expanded here — export an ASCII dump or JSON');
  }
  return parseSrText(td.decode(bytes), fileName);
}

export function filterSrMembers(items: SrMember[], query: string): SrMember[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((m) =>
    tokens.every((token) => {
      if (token.startsWith('mem:') || token.startsWith('member:') || token.startsWith('name:')) {
        return m.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) {
        return `${m.kind} ${m.memberType}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('sec:') || token.startsWith('section:')) {
        return m.section.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('prop:') || token.startsWith('property:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${m.name} ${m.kind} ${m.memberType} ${m.section}`.toLowerCase().includes(token);
    })
  );
}

export function filterSrProperties(items: SrProperty[], query: string): SrProperty[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('prop:') || token.startsWith('property:') || token.startsWith('name:')) {
        return `${p.name} ${p.value}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('mem:') || token.startsWith('member:')) {
        return p.member.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('sec:') || token.startsWith('section:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.pset} ${p.member} ${p.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterSrSections(items: SrSection[], query: string): SrSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('sec:') || token.startsWith('section:') || token.startsWith('name:')) {
        return `${s.name} ${s.description}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('mem:') || token.startsWith('prop:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterSrRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('mem:') ||
        token.startsWith('member:') ||
        token.startsWith('sec:') ||
        token.startsWith('section:') ||
        token.startsWith('prop:') ||
        token.startsWith('property:') ||
        token.startsWith('kind:')
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
