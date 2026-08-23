import type {
  HcColumn,
  HcDataset,
  HcFrame,
  HcFrameKind,
  HcMeta,
  HcPreview,
  HcPreviewKind,
  HcSourceKind
} from '../types/heic-viewer.types';
import { HC_JSON_SAMPLE } from '../constants/heic-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const HC_MAGIC = new Uint8Array([0x48, 0x45, 0x30, 0x31]); // HE01
const PALETTE = ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#e2e8f0'];

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asFrameKind(value: unknown, fallback: HcFrameKind = 'other'): HcFrameKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'primary' || k === 'grid' || k === 'thumbnail' || k === 'other') return k;
  return fallback;
}

function asPreviewKind(value: unknown, fallback: HcPreviewKind = 'other'): HcPreviewKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'rect' || k === 'circle' || k === 'line' || k === 'text' || k === 'other') return k;
  if (k === 'box') return 'rect';
  return fallback;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function looksLikeHcDump(text: string): boolean {
  if (/\b(?:EPUB|MOBI|AZW|LATEX|SVG|PSD|AI) dump\b/i.test(text)) return false;
  return /\bHEIC dump\b/i.test(text) || (/^\s*FRAME\s+\S+/m.test(text) && /^\s*(?:META|EXIF|SIZE)\s+/m.test(text));
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isHcMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === HC_MAGIC[0] && bytes[1] === HC_MAGIC[1] && bytes[2] === HC_MAGIC[2] && bytes[3] === HC_MAGIC[3];
}

function isHeicFtyp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) return false;
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
  return brand === 'heic' || brand === 'heif' || brand === 'mif1' || brand === 'msf1' || brand === 'heim' || brand === 'heix';
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.(?:heic|heif|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
  if (/shop/i.test(fromFile) || /shop/i.test(fallback)) return 'ShopFloor';
  return fromFile;
}

function colorFor(index: number, hex = ''): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) return hex;
  return PALETTE[index % PALETTE.length];
}

function makeFrame(raw: Record<string, unknown>, index: number): HcFrame {
  const name = asString(raw.name || raw.id, `frame${index + 1}`);
  return {
    id: name,
    index,
    name,
    kind: asFrameKind(raw.kind || raw.type, index === 0 ? 'primary' : 'other'),
    width: asNumber(raw.width ?? raw.w, 12),
    height: asNumber(raw.height ?? raw.h, 8)
  };
}

function makeMeta(raw: Record<string, unknown>, index: number, group: 'meta' | 'exif' = 'meta'): HcMeta {
  const name = asString(raw.name || raw.id, `meta${index + 1}`);
  const g = asString(raw.group || raw.kind, group).toLowerCase() === 'exif' ? 'exif' : 'meta';
  return { id: `${g}-${name}-${index}`, index, name, value: asString(raw.value || raw.kind), group: g };
}

function makePreview(raw: Record<string, unknown>, index: number): HcPreview {
  const name = asString(raw.name || raw.id, `preview${index + 1}`);
  const kind = asPreviewKind(raw.kind || raw.type);
  const x = asNumber(raw.x ?? raw.x1, 0);
  const y = asNumber(raw.y ?? raw.y1, 0);
  const w = asNumber(raw.w ?? raw.width, 0);
  const h = asNumber(raw.h ?? raw.height, 0);
  return {
    id: name,
    index,
    name,
    kind,
    colorHex: colorFor(index, asString(raw.colorHex || raw.color || raw.fill)),
    x,
    y,
    x2: asNumber(raw.x2, x + w),
    y2: asNumber(raw.y2, y + h),
    w,
    h,
    r: asNumber(raw.r ?? raw.radius, kind === 'circle' ? 0.35 : 0),
    text: asString(raw.text || raw.value)
  };
}

function finishDataset(
  name: string,
  sourceKind: HcSourceKind,
  title: string,
  encoding: string,
  heicVer: string,
  width: number,
  height: number,
  make: string,
  model: string,
  frames: HcFrame[],
  metas: HcMeta[],
  previews: HcPreview[],
  warnings: string[]
): HcDataset {
  if (!frames.length && !metas.length && !previews.length) throw new Error('HEIC dump contains no frames or metadata');
  if (!frames.length) frames.push(makeFrame({ name: 'primary', kind: 'primary', width, height }, 0));
  frames.forEach((f, i) => (f.index = i));
  metas.forEach((m, i) => (m.index = i));
  previews.forEach((p, i) => (p.index = i));
  const makeVal = make || metas.find((m) => m.name.toLowerCase() === 'make')?.value || '—';
  const modelVal = model || metas.find((m) => m.name.toLowerCase() === 'model')?.value || '—';
  const columns: HcColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'frame', index: 2, name: 'frame', type: 'STRING' },
    { id: 'meta', index: 3, name: 'meta', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...frames.map((f) => ({ name: f.name, type: 'frame', frame: f.name, meta: '', value: `${f.width}x${f.height}` })),
    ...metas.map((m) => ({ name: m.name, type: m.group, frame: '', meta: m.name, value: m.value })),
    ...previews.map((p) => ({
      name: p.name,
      type: 'preview',
      frame: frames[0]?.name || 'primary',
      meta: '',
      value: p.text || (p.kind === 'circle' ? String(p.r) : p.kind === 'line' ? 'aisle' : `${p.w}x${p.h}`)
    }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    heicVer: heicVer || '1.0',
    width: width || frames[0]?.width || 12,
    height: height || frames[0]?.height || 8,
    make: makeVal,
    model: modelVal,
    frameCount: frames.length,
    metaCount: metas.length,
    frames,
    metas,
    previews,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: HcSourceKind = 'json', warnings: string[] = []): HcDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'HeicDoc'));
  const frames = ((Array.isArray(root.frames) ? root.frames : []) as unknown[]).map((item, i) => makeFrame(rec(item), i));
  const metas = ((Array.isArray(root.metas) ? root.metas : []) as unknown[]).map((item, i) => makeMeta(rec(item), i));
  const previews = ((Array.isArray(root.previews) ? root.previews : []) as unknown[]).map((item, i) => makePreview(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    'UTF-8',
    asString(root.heicVer || root.version, '1.0'),
    asNumber(root.width, 12),
    asNumber(root.height, 8),
    asString(root.make),
    asString(root.model),
    frames,
    metas,
    previews,
    warnings
  );
}

function parseAsciiHc(text: string, fileName: string): HcDataset {
  const version = /HEIC dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /HEIC dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'HeicDoc');
  const name = prettyModelName(fileName, dumpName);
  const frames: HcFrame[] = [];
  const metas: HcMeta[] = [];
  const previews: HcPreview[] = [];
  let width = 12;
  let height = 8;
  let make = '';
  let model = '';
  const size = /\bSIZE\s+([\d.]+)\s+([\d.]+)/i.exec(text);
  if (size) {
    width = Number(size[1]) || width;
    height = Number(size[2]) || height;
  }
  let m: RegExpExecArray | null;
  const frameRe = /\bFRAME\s+(\S+)\s+([\d.]+)\s+([\d.]+)/gi;
  while ((m = frameRe.exec(text))) {
    const kind = /thumb/i.test(m[1]) ? 'thumbnail' : frames.length ? 'grid' : 'primary';
    frames.push(makeFrame({ name: m[1], kind, width: m[2], height: m[3] }, frames.length));
  }
  const metaRe = /\bMETA\s+(\S+)\s+(.+)$/gim;
  while ((m = metaRe.exec(text))) {
    if (m[1].toLowerCase() === 'make') make = m[2].trim();
    if (m[1].toLowerCase() === 'model') model = m[2].trim();
    metas.push(makeMeta({ name: m[1], value: m[2].trim(), group: 'meta' }, metas.length, 'meta'));
  }
  const exifRe = /\bEXIF\s+(\S+)\s+(.+)$/gim;
  while ((m = exifRe.exec(text))) {
    metas.push(makeMeta({ name: m[1], value: m[2].trim(), group: 'exif' }, metas.length, 'exif'));
  }
  const shapeRe = /\bSHAPE\s+(\S+)\s+(\S+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?(?:\s+(#[0-9a-fA-F]{3,8}))?/gi;
  while ((m = shapeRe.exec(text))) {
    const kind = asPreviewKind(m[1]);
    const raw: Record<string, unknown> = { kind, name: m[2], x: m[3], y: m[4], colorHex: m[7] };
    if (kind === 'circle') raw.r = m[5];
    else if (kind === 'line') {
      raw.x2 = m[5];
      raw.y2 = m[6] ?? m[5];
    } else {
      raw.w = m[5];
      raw.h = m[6] ?? m[5];
    }
    previews.push(makePreview(raw, previews.length));
  }
  const textRe = /\bTEXT\s+(\S+)\s+([-\d.]+)\s+([-\d.]+)/gi;
  while ((m = textRe.exec(text))) {
    previews.push(
      makePreview({ kind: 'text', name: /shop/i.test(m[1]) ? 'title' : m[1], x: m[2], y: m[3], text: m[1], colorHex: '#e2e8f0' }, previews.length)
    );
  }
  if (!frames.length && !metas.length) throw new Error('HEIC dump has no FRAME or META entries');
  const warnings = ['ASCII HEIC dump is a metadata subset — not Apple Photos, Preview, or libheif. Binary HEIC is not decoded.'];
  return finishDataset(name, 'heic', name, 'UTF-8', version, width, height, make, model, frames, metas, previews, warnings);
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

function parseCsvAsHc(text: string, fileName: string): HcDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('HEIC CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const frames: HcFrame[] = [];
  const metas: HcMeta[] = [];
  const previews: HcPreview[] = [];
  let make = '';
  let model = '';
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'frame') {
      const dim = /^([\d.]+)x([\d.]+)$/.exec(row.value || '');
      frames.push(makeFrame({ name: row.name || row.frame, kind: row.kind, width: dim?.[1], height: dim?.[2] }, frames.length));
      return;
    }
    if (type === 'meta' || type === 'exif') {
      if (row.name.toLowerCase() === 'make') make = row.value;
      if (row.name.toLowerCase() === 'model') model = row.value;
      metas.push(makeMeta({ name: row.name || row.meta, value: row.value || row.kind, group: type }, metas.length, type as 'meta' | 'exif'));
      return;
    }
    const kind = asPreviewKind(row.kind || (type === 'text' ? 'text' : 'rect'));
    const value = row.value || '';
    const dim = /^([\d.]+)x([\d.]+)$/.exec(value);
    previews.push(
      makePreview(
        {
          kind,
          name: row.name,
          w: dim?.[1],
          h: dim?.[2],
          r: kind === 'circle' ? value : undefined,
          text: kind === 'text' ? value : '',
          x: kind === 'circle' ? 10 : kind === 'line' ? 6 : kind === 'text' ? 4.2 : 0,
          y: kind === 'circle' ? 6 : kind === 'line' ? 1 : kind === 'text' ? 4.2 : 0,
          x2: kind === 'line' ? 6 : undefined,
          y2: kind === 'line' ? 7 : undefined
        },
        previews.length
      )
    );
  });
  const name = prettyModelName(fileName, 'HeicDoc');
  return finishDataset(name, 'csv', name, 'UTF-8', '1.0', 12, 8, make, model, frames, metas, previews, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: HcSourceKind): HcDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'HeicDoc')).trim();
  const keys: string[] = [];
  const frames: HcFrame[] = [];
  const metas: HcMeta[] = [];
  const previews: HcPreview[] = [];
  let make = '';
  let model = '';
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
      if (type === 'frame') {
        frames.push(makeFrame({ name: row.name, kind: row.kind, width: 12, height: 8 }, frames.length));
        continue;
      }
      if (type === 'meta' || type === 'exif') {
        if (row.name.toLowerCase() === 'make') make = row.kind;
        if (row.name.toLowerCase() === 'model') model = row.kind;
        metas.push(makeMeta({ name: row.name, value: row.kind, group: type }, metas.length, type as 'meta' | 'exif'));
        continue;
      }
      previews.push(makePreview({ kind: row.kind || 'rect', name: row.name, text: row.kind }, previews.length));
    }
  }
  if (!frames.length && !metas.length) throw new Error('HEIC markdown contains no frames or metadata');
  return finishDataset(prettyModelName(fileName, name), sourceKind, name, 'UTF-8', '1.0', 12, 8, make, model, frames, metas, previews, []);
}

function parseHc01(bytes: Uint8Array, fileName: string): HcDataset {
  if (bytes.length < 8) throw new Error('HEIC dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('HEIC dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid HE01 JSON');
  }
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  return ingestJson(parsed, fileName, ext === 'heif' ? 'heif' : 'heic');
}

export function buildSampleHcBytes(): Uint8Array {
  const json = te.encode(HC_JSON_SAMPLE);
  const out: number[] = [...HC_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleHcJson(): string {
  return HC_JSON_SAMPLE;
}

export function parseHcText(text: string, fileName = ''): HcDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('HEIC dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeHcDump(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid HEIC JSON');
    }
    return ingestJson(parsed, fileName, ext === 'heif' ? 'heif' : ext === 'json' ? 'json' : 'heic');
  }
  if (ext === 'heic' || ext === 'heif' || looksLikeHcDump(raw)) return parseAsciiHc(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsHc(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a HEIC dump');
}

export function parseHcBytes(bytes: Uint8Array, fileName = ''): HcDataset {
  if (!bytes.length) throw new Error('HEIC dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed HEIC files are not supported — decompress first');
  if (isHeicFtyp(bytes)) throw new Error('Binary HEIC/HEIF (ftyp) is not decoded here — export a HEIC dump or JSON');
  if (isHcMagic(bytes)) return parseHc01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('ZIP HEIC archives are not expanded here — export a HEIC dump or JSON');
  return parseHcText(td.decode(bytes), fileName);
}

export function filterHcFrames(items: HcFrame[], query: string): HcFrame[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((f) =>
    tokens.every((token) => {
      if (token.startsWith('frame:') || token.startsWith('name:')) {
        return `${f.name} ${f.kind}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) return `${f.kind} frame`.includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('meta:') || token.startsWith('exif:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${f.name} ${f.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterHcMetas(items: HcMeta[], query: string): HcMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((m) =>
    tokens.every((token) => {
      if (token.startsWith('meta:') || token.startsWith('exif:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${m.name} ${m.value} ${m.group}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('frame:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${m.name} ${m.value} ${m.group}`.toLowerCase().includes(token);
    })
  );
}

export function filterHcPreviews(items: HcPreview[], query: string): HcPreview[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${p.name} ${p.kind} ${p.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('frame:') || token.startsWith('meta:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.kind} ${p.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterHcRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('frame:') ||
        token.startsWith('meta:') ||
        token.startsWith('exif:')
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
