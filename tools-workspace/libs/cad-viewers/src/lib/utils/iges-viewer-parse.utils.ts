import type { IgColumn, IgDataset, IgEntity, IgEntityType, IgSourceKind, IgSurface, IgSurfaceKind } from '../types/iges-viewer.types';
import { IG_JSON_SAMPLE } from '../constants/iges-viewer-sample.data';
import { isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const IG_MAGIC = new Uint8Array([0x49, 0x47, 0x30, 0x31]); // IG01
const IG_COLORS = ['#fbbf24', '#f59e0b', '#34d399', '#38bdf8', '#c4b5fd', '#fb7185'];

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

function looksLikeIges(text: string): boolean {
  if (/(?:^|\n).{72}[SDGPT]\s*\d+/m.test(text)) return true;
  if (/^\s*S\s+\d+\s*$/m.test(text)) return true;
  return /\bIGES\b/i.test(text.slice(0, 240));
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isIgMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === IG_MAGIC[0] && bytes[1] === IG_MAGIC[1] && bytes[2] === IG_MAGIC[2] && bytes[3] === IG_MAGIC[3];
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function surfaceKind(raw: unknown): IgSurfaceKind {
  const v = asString(raw).toLowerCase();
  if (v === 'plane' || v === 'planar' || v === 'face') return 'plane';
  if (v === 'cylinder' || v === 'cyl' || v === '120') return 'cylinder';
  if (v === 'sphere') return 'sphere';
  if (v === 'nurbs' || v === '128' || v === 'spline') return 'nurbs';
  return 'other';
}

function entityType(raw: unknown, code = 0): IgEntityType {
  const v = asString(raw).toLowerCase();
  if (v === 'line' || code === 110) return 'line';
  if (v === 'arc' || code === 100) return 'arc';
  if (v === 'point' || code === 116) return 'point';
  if (v === 'surface' || code === 128 || code === 144 || code === 120) return 'surface';
  if (v === 'curve' || code === 126 || code === 112) return 'curve';
  return 'other';
}

function makeSurface(raw: CadDumpRec, index: number): IgSurface {
  const name = asString(raw.name || raw.id, `surf${index + 1}`);
  const kind = surfaceKind(raw.kind || raw.type);
  return {
    id: name,
    index,
    name,
    kind,
    colorHex: asString(raw.colorHex) || IG_COLORS[index % IG_COLORS.length],
    cx: asNumber(raw.cx ?? raw.x),
    cy: asNumber(raw.cy ?? raw.y),
    cz: asNumber(raw.cz ?? raw.z),
    sx: asNumber(raw.sx ?? raw.width, kind === 'plane' ? 1 : 0),
    sy: asNumber(raw.sy ?? raw.depth, kind === 'plane' ? 1 : 0),
    sz: asNumber(raw.sz ?? raw.height),
    r: asNumber(raw.r ?? raw.radius, kind === 'cylinder' || kind === 'sphere' ? 0.35 : 0),
    h: asNumber(raw.h ?? raw.height, kind === 'cylinder' ? 1 : 0)
  };
}

function makeEntity(raw: CadDumpRec, index: number): IgEntity {
  const name = asString(raw.name || raw.id, `ent${index + 1}`);
  const typeCode = asNumber(raw.typeCode ?? raw.code);
  return {
    id: name,
    index,
    name,
    type: entityType(raw.type || raw.kind, typeCode),
    typeCode,
    surface: asString(raw.surface || raw.surf),
    x: asNumber(raw.x ?? raw.cx),
    y: asNumber(raw.y ?? raw.cy),
    z: asNumber(raw.z ?? raw.cz),
    text: asString(raw.text || raw.label)
  };
}

function finishDataset(
  name: string,
  sourceKind: IgSourceKind,
  title: string,
  encoding: string,
  version: string,
  units: string,
  surfaces: IgSurface[],
  entities: IgEntity[],
  warnings: string[]
): IgDataset {
  if (!surfaces.length && !entities.length) throw new Error('IGES dump contains no surfaces or entities');
  surfaces.forEach((s, i) => (s.index = i));
  entities.forEach((e, i) => (e.index = i));
  const columns: IgColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'surface', index: 2, name: 'surface', type: 'STRING' },
    { id: 'x', index: 3, name: 'x', type: 'NUMBER' },
    { id: 'y', index: 4, name: 'y', type: 'NUMBER' }
  ];
  const rows = [
    ...surfaces.map((s) => ({ name: s.name, type: s.kind, surface: s.name, x: String(s.cx), y: String(s.cy) })),
    ...entities.map((e) => ({ name: e.name, type: e.type, surface: e.surface, x: String(e.x), y: String(e.y) }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    version: version || '—',
    units: units || 'm',
    surfaceCount: surfaces.length,
    entityCount: entities.length,
    surfaces,
    entities,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: IgSourceKind = 'json', warnings: string[] = []): IgDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Surface'));
  const surfaces = ((Array.isArray(root.surfaces) ? root.surfaces : Array.isArray(root.faces) ? root.faces : []) as unknown[]).map((item, i) =>
    makeSurface(rec(item), i)
  );
  const entities = ((Array.isArray(root.entities) ? root.entities : []) as unknown[]).map((item, i) => makeEntity(rec(item), i));
  if (!surfaces.length && entities.length) {
    const names = [...new Set(entities.map((e) => e.surface).filter(Boolean))];
    names.forEach((n, i) => surfaces.push(makeSurface({ name: n, kind: 'plane' }, i)));
  }
  return finishDataset(name, sourceKind, asString(root.title, name), sourceKind === 'iges' ? 'ASCII' : 'UTF-8', asString(root.version, '5.3'), asString(root.units, 'm'), surfaces, entities, warnings);
}

function igesTypeName(code: number): string {
  if (code === 100) return 'arc';
  if (code === 110) return 'line';
  if (code === 116) return 'point';
  if (code === 120) return 'cylinder';
  if (code === 128) return 'nurbs';
  if (code === 144) return 'surface';
  if (code === 186) return 'solid';
  return `type-${code}`;
}

function parseAsciiIges(text: string, fileName: string): IgDataset {
  const name = prettyModelName(fileName, 'Surface');
  const surfaces: IgSurface[] = [];
  const entities: IgEntity[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let startTitle = '';
  for (const line of lines) {
    const padded = line.length >= 73 ? line : line.padEnd(80, ' ');
    const section = (padded[72] || '').toUpperCase();
    if (section === 'S' && !startTitle) startTitle = padded.slice(0, 72).trim();
    if (section === 'D') {
      const typeCode = Number(padded.slice(0, 8).trim());
      if (!Number.isFinite(typeCode) || typeCode <= 0) continue;
      const seq = Number(padded.slice(73).trim()) || entities.length + 1;
      if (seq % 2 === 1) {
        const label = igesTypeName(typeCode);
        if (typeCode === 120 || typeCode === 128 || typeCode === 144 || typeCode === 118 || typeCode === 186) {
          surfaces.push(
            makeSurface(
              {
                name: `${label}${surfaces.length + 1}`,
                kind: typeCode === 120 ? 'cylinder' : typeCode === 128 ? 'nurbs' : 'plane',
                cx: 2 + surfaces.length * 2.5,
                cy: 2,
                cz: 0.5,
                sx: typeCode === 120 ? 0 : 2,
                sy: typeCode === 120 ? 0 : 1.5,
                r: typeCode === 120 ? 0.4 : 0,
                h: typeCode === 120 ? 2 : 0
              },
              surfaces.length
            )
          );
        } else {
          entities.push(makeEntity({ name: `${label}${entities.length + 1}`, type: igesTypeName(typeCode), typeCode, x: entities.length, y: 0, z: 0 }, entities.length));
        }
      }
    }
  }
  if (!surfaces.length && !entities.length) throw new Error('IGES file has no directory entities');
  const warnings = ['ASCII IGES is a directory subset — tessellation uses dump surfaces when present.'];
  return finishDataset(prettyModelName(fileName, startTitle || name), 'iges', name, 'ASCII', '5.3', 'm', surfaces, entities, warnings);
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

function parseCsvAsIg(text: string, fileName: string): IgDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('IGES CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const surfaces: IgSurface[] = [];
  const entities: IgEntity[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'surface' || type === 'plane' || type === 'cylinder' || type === 'nurbs' || type === 'sphere') {
      surfaces.push(
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
          surfaces.length
        )
      );
      return;
    }
    entities.push(
      makeEntity(
        {
          name: row.name,
          type: row.type,
          typeCode: row.typeCode,
          surface: row.surface,
          x: row.x || row.cx,
          y: row.y || row.cy,
          z: row.z || row.cz,
          text: row.text
        },
        index
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Surface');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '5.3', 'm', surfaces, entities, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: IgSourceKind): IgDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Surface')).trim();
  const keys: string[] = [];
  const surfaces: IgSurface[] = [];
  const entities: IgEntity[] = [];
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
      if (type === 'surface' || type === 'plane' || type === 'cylinder' || type === 'nurbs') {
        surfaces.push(makeSurface({ name: row.name, kind: row.kind || row.type }, surfaces.length));
        continue;
      }
      entities.push(makeEntity({ name: row.name, type: row.type, text: row.text }, entities.length));
    }
  }
  if (!surfaces.length && !entities.length) throw new Error('IGES markdown contains no surfaces or entities');
  return finishDataset(name, sourceKind, name, 'UTF-8', '5.3', 'm', surfaces, entities, []);
}

function parseIg01(bytes: Uint8Array, fileName: string): IgDataset {
  if (bytes.length < 8) throw new Error('IGES dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('IGES dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid IG01 JSON');
  }
  return ingestJson(parsed, fileName, 'iges');
}

export function buildSampleIgBytes(): Uint8Array {
  const json = te.encode(IG_JSON_SAMPLE);
  const out: number[] = [...IG_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleIgJson(): string {
  return IG_JSON_SAMPLE;
}

export function parseIgText(text: string, fileName = ''): IgDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('IGES dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeIges(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid IGES JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'iges' || ext === 'igs' || looksLikeIges(raw)) return parseAsciiIges(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsIg(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an IGES dump');
}

export function parseIgBytes(bytes: Uint8Array, fileName = ''): IgDataset {
  if (!bytes.length) throw new Error('IGES dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed IGES files are not supported — decompress first');
  if (isIgMagic(bytes)) return parseIg01(bytes, fileName);
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'iges' || ext === 'igs') && !isMostlyText(bytes)) {
    throw new Error('Binary IGES is not expanded here — export ASCII IGES or JSON dump');
  }
  return parseIgText(td.decode(bytes), fileName);
}

export function filterIgSurfaces(surfaces: IgSurface[], query: string): IgSurface[] {
  const q = query.trim().toLowerCase();
  if (!q) return surfaces;
  const tokens = q.split(/\s+/).filter(Boolean);
  return surfaces.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('surf:') || token.startsWith('surface:') || token.startsWith('name:')) {
        return s.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) return s.kind.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('ent:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterIgEntities(entities: IgEntity[], query: string): IgEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return entities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return entities.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('ent:') || token.startsWith('name:')) return `${e.name} ${e.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return e.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('surf:') || token.startsWith('surface:')) return e.surface.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.type} ${e.surface} ${e.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterIgRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('name:') || token.startsWith('type:') || token.startsWith('surf:') || token.startsWith('surface:') || token.startsWith('ent:')) {
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
