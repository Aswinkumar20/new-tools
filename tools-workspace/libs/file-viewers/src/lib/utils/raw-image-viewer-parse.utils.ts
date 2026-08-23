import type {
  RwChannel,
  RwChannelKind,
  RwColumn,
  RwDataset,
  RwExif,
  RwPreview,
  RwPreviewKind,
  RwSourceKind
} from '../types/raw-image-viewer.types';
import { RW_JSON_SAMPLE } from '../constants/raw-image-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const RW_MAGIC = new Uint8Array([0x52, 0x57, 0x30, 0x31]); // RW01
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

function asChannelKind(value: unknown, fallback: RwChannelKind = 'other'): RwChannelKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'red' || k === 'green' || k === 'blue' || k === 'luma' || k === 'other') return k;
  if (k === 'r') return 'red';
  if (k === 'g') return 'green';
  if (k === 'b') return 'blue';
  if (k === 'y' || k === 'luminance') return 'luma';
  return fallback;
}

function asPreviewKind(value: unknown, fallback: RwPreviewKind = 'other'): RwPreviewKind {
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

function looksLikeRwDump(text: string): boolean {
  if (/\b(?:EPUB|MOBI|AZW|LATEX|SVG|PSD|AI|HEIC|TIFF) dump\b/i.test(text)) return false;
  return /\bRAW dump\b/i.test(text) || (/^\s*CHANNEL\s+\S+/m.test(text) && /^\s*(?:EXIF|SIZE|MAKE|ISO)\s+/m.test(text));
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isRwMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === RW_MAGIC[0] && bytes[1] === RW_MAGIC[1] && bytes[2] === RW_MAGIC[2] && bytes[3] === RW_MAGIC[3];
}

function isTiffMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const le = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00;
  const be = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a;
  return le || be;
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.(?:cr2|nef|arw|dng|raw|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
  if (/shop/i.test(fromFile) || /shop/i.test(fallback)) return 'ShopFloor';
  return fromFile;
}

function colorFor(index: number, hex = ''): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) return hex;
  return PALETTE[index % PALETTE.length];
}

function makeChannel(raw: Record<string, unknown>, index: number): RwChannel {
  const name = asString(raw.name || raw.id, `channel${index + 1}`);
  return {
    id: name,
    index,
    name,
    kind: asChannelKind(raw.kind || raw.type || name, 'other'),
    pattern: asString(raw.pattern || raw.value, 'RGGB')
  };
}

function makeExif(raw: Record<string, unknown>, index: number): RwExif {
  const name = asString(raw.name || raw.id, `exif${index + 1}`);
  return { id: `exif-${name}-${index}`, index, name, value: asString(raw.value || raw.kind) };
}

function makePreview(raw: Record<string, unknown>, index: number): RwPreview {
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
  sourceKind: RwSourceKind,
  title: string,
  encoding: string,
  rawVer: string,
  width: number,
  height: number,
  make: string,
  model: string,
  format: string,
  iso: string,
  demosaic: string,
  channels: RwChannel[],
  exifs: RwExif[],
  previews: RwPreview[],
  warnings: string[]
): RwDataset {
  if (!channels.length && !exifs.length && !previews.length) throw new Error('RAW dump contains no channels or EXIF');
  if (!channels.length) channels.push(makeChannel({ name: 'luma', kind: 'luma', pattern: 'RGGB' }, 0));
  channels.forEach((c, i) => (c.index = i));
  exifs.forEach((e, i) => (e.index = i));
  previews.forEach((p, i) => (p.index = i));
  const isoVal = iso || exifs.find((e) => e.name.toLowerCase() === 'iso')?.value || '—';
  const columns: RwColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'channel', index: 2, name: 'channel', type: 'STRING' },
    { id: 'exif', index: 3, name: 'exif', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...channels.map((c) => ({ name: c.name, type: 'channel', channel: c.name, exif: '', value: c.pattern })),
    ...exifs.map((e) => ({ name: e.name, type: 'exif', channel: '', exif: e.name, value: e.value })),
    ...previews.map((p) => ({
      name: p.name,
      type: 'preview',
      channel: channels[0]?.name || 'red',
      exif: '',
      value: p.text || (p.kind === 'circle' ? String(p.r) : p.kind === 'line' ? 'aisle' : `${p.w}x${p.h}`)
    }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    rawVer: rawVer || '1.0',
    width: width || 12,
    height: height || 8,
    make: make || '—',
    model: model || '—',
    format: format || 'CR2',
    iso: isoVal,
    demosaic: demosaic || 'bayer-rggb',
    channelCount: channels.length,
    exifCount: exifs.length,
    channels,
    exifs,
    previews,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: RwSourceKind = 'json', warnings: string[] = []): RwDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'RawDoc'));
  const channels = ((Array.isArray(root.channels) ? root.channels : []) as unknown[]).map((item, i) => makeChannel(rec(item), i));
  const exifs = ((Array.isArray(root.exifs) ? root.exifs : []) as unknown[]).map((item, i) => makeExif(rec(item), i));
  const previews = ((Array.isArray(root.previews) ? root.previews : []) as unknown[]).map((item, i) => makePreview(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    'UTF-8',
    asString(root.rawVer || root.version, '1.0'),
    asNumber(root.width, 12),
    asNumber(root.height, 8),
    asString(root.make),
    asString(root.model),
    asString(root.format, 'CR2'),
    asString(root.iso),
    asString(root.demosaic, 'bayer-rggb'),
    channels,
    exifs,
    previews,
    warnings
  );
}

function parseAsciiRw(text: string, fileName: string): RwDataset {
  const version = /RAW dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /RAW dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'RawDoc');
  const name = prettyModelName(fileName, dumpName);
  const channels: RwChannel[] = [];
  const exifs: RwExif[] = [];
  const previews: RwPreview[] = [];
  let width = 12;
  let height = 8;
  let make = '';
  let model = '';
  let format = 'CR2';
  let iso = '';
  let demosaic = 'bayer-rggb';
  const size = /\bSIZE\s+([\d.]+)\s+([\d.]+)/i.exec(text);
  if (size) {
    width = Number(size[1]) || width;
    height = Number(size[2]) || height;
  }
  const makeM = /\bMAKE\s+(\S+)/i.exec(text);
  if (makeM) make = makeM[1];
  const modelM = /\bMODEL\s+(\S+)/i.exec(text);
  if (modelM) model = modelM[1];
  const formatM = /\bFORMAT\s+(\S+)/i.exec(text);
  if (formatM) format = formatM[1];
  const isoM = /\bISO\s+(\S+)/i.exec(text);
  if (isoM) iso = isoM[1];
  const demoM = /\bDEMOSAIC\s+(\S+)/i.exec(text);
  if (demoM) demosaic = demoM[1];
  let m: RegExpExecArray | null;
  const channelRe = /\bCHANNEL\s+(\S+)(?:\s+(\S+))?/gi;
  while ((m = channelRe.exec(text))) {
    channels.push(makeChannel({ name: m[1], kind: m[1], pattern: m[2] || 'RGGB' }, channels.length));
  }
  const exifRe = /\bEXIF\s+(\S+)\s+(.+)$/gim;
  while ((m = exifRe.exec(text))) {
    if (m[1].toLowerCase() === 'iso' && !iso) iso = m[2].trim();
    exifs.push(makeExif({ name: m[1], value: m[2].trim() }, exifs.length));
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
  if (!channels.length && !exifs.length) throw new Error('RAW dump has no CHANNEL or EXIF entries');
  const warnings = ['ASCII RAW dump is a metadata subset — not Lightroom, Camera Raw, or dcraw. Binary CR2/NEF/ARW is not demosaiced.'];
  return finishDataset(name, 'raw', name, 'UTF-8', version, width, height, make, model, format, iso, demosaic, channels, exifs, previews, warnings);
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

function parseCsvAsRw(text: string, fileName: string): RwDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('RAW CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const channels: RwChannel[] = [];
  const exifs: RwExif[] = [];
  const previews: RwPreview[] = [];
  let iso = '';
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'channel') {
      channels.push(makeChannel({ name: row.name || row.channel, kind: row.kind || row.name, pattern: row.value }, channels.length));
      return;
    }
    if (type === 'exif') {
      if (row.name.toLowerCase() === 'iso') iso = row.value;
      exifs.push(makeExif({ name: row.name || row.exif, value: row.value || row.kind }, exifs.length));
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
  const name = prettyModelName(fileName, 'RawDoc');
  return finishDataset(name, 'csv', name, 'UTF-8', '1.0', 12, 8, '', '', 'CR2', iso, 'bayer-rggb', channels, exifs, previews, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: RwSourceKind): RwDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'RawDoc')).trim();
  const keys: string[] = [];
  const channels: RwChannel[] = [];
  const exifs: RwExif[] = [];
  const previews: RwPreview[] = [];
  let iso = '';
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
      if (type === 'channel') {
        channels.push(makeChannel({ name: row.name, kind: row.kind || row.name }, channels.length));
        continue;
      }
      if (type === 'exif') {
        if (row.name.toLowerCase() === 'iso') iso = row.kind;
        exifs.push(makeExif({ name: row.name, value: row.kind }, exifs.length));
        continue;
      }
      previews.push(makePreview({ kind: row.kind || 'rect', name: row.name, text: row.kind }, previews.length));
    }
  }
  if (!channels.length && !exifs.length) throw new Error('RAW markdown contains no channels or EXIF');
  return finishDataset(prettyModelName(fileName, name), sourceKind, name, 'UTF-8', '1.0', 12, 8, '', '', 'CR2', iso, 'bayer-rggb', channels, exifs, previews, []);
}

function parseRw01(bytes: Uint8Array, fileName: string): RwDataset {
  if (bytes.length < 8) throw new Error('RAW dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('RAW dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid RW01 JSON');
  }
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  const kind: RwSourceKind = ext === 'cr2' || ext === 'nef' || ext === 'arw' || ext === 'dng' || ext === 'raw' ? ext : 'raw';
  return ingestJson(parsed, fileName, kind);
}

export function buildSampleRwBytes(): Uint8Array {
  const json = te.encode(RW_JSON_SAMPLE);
  const out: number[] = [...RW_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleRwJson(): string {
  return RW_JSON_SAMPLE;
}

export function parseRwText(text: string, fileName = ''): RwDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('RAW dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeRwDump(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid RAW JSON');
    }
    return ingestJson(parsed, fileName, ext === 'json' ? 'json' : 'raw');
  }
  if (ext === 'cr2' || ext === 'nef' || ext === 'arw' || ext === 'dng' || ext === 'raw' || looksLikeRwDump(raw)) {
    return parseAsciiRw(raw, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsRw(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a RAW dump');
}

export function parseRwBytes(bytes: Uint8Array, fileName = ''): RwDataset {
  if (!bytes.length) throw new Error('RAW dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed RAW files are not supported — decompress first');
  if (isTiffMagic(bytes)) throw new Error('Binary camera RAW (TIFF/CR2/NEF/ARW) is not demosaiced here — export a RAW dump or JSON');
  if (isRwMagic(bytes)) return parseRw01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('ZIP RAW archives are not expanded here — export a RAW dump or JSON');
  return parseRwText(td.decode(bytes), fileName);
}

export function filterRwChannels(items: RwChannel[], query: string): RwChannel[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('channel:') || token.startsWith('ch:') || token.startsWith('name:')) {
        return `${c.name} ${c.kind} ${c.pattern}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) return `${c.kind} channel`.includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('exif:') || token.startsWith('iso:') || token.startsWith('make:') || token.startsWith('model:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.name} ${c.kind} ${c.pattern}`.toLowerCase().includes(token);
    })
  );
}

export function filterRwExifs(items: RwExif[], query: string): RwExif[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((e) =>
    tokens.every((token) => {
      if (
        token.startsWith('exif:') ||
        token.startsWith('iso:') ||
        token.startsWith('make:') ||
        token.startsWith('model:') ||
        token.startsWith('name:') ||
        token.startsWith('kind:') ||
        token.startsWith('type:')
      ) {
        return `${e.name} ${e.value}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('channel:') || token.startsWith('ch:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterRwPreviews(items: RwPreview[], query: string): RwPreview[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${p.name} ${p.kind} ${p.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('channel:') || token.startsWith('exif:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.kind} ${p.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterRwRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('channel:') ||
        token.startsWith('ch:') ||
        token.startsWith('exif:') ||
        token.startsWith('iso:') ||
        token.startsWith('make:') ||
        token.startsWith('model:')
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
