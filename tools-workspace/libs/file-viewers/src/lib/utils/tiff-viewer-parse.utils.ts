import type {
  TfColumn,
  TfDataset,
  TfMeta,
  TfPage,
  TfPageKind,
  TfPreview,
  TfPreviewKind,
  TfSourceKind
} from '../types/tiff-viewer.types';
import { TF_JSON_SAMPLE } from '../constants/tiff-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const TF_MAGIC = new Uint8Array([0x54, 0x46, 0x30, 0x31]); // TF01
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

function asPageKind(value: unknown, fallback: TfPageKind = 'other'): TfPageKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'primary' || k === 'overlay' || k === 'thumbnail' || k === 'other') return k;
  if (k === 'cover' || k === 'page') return 'primary';
  if (k === 'floor' || k === 'layer') return 'overlay';
  return fallback;
}

function asPreviewKind(value: unknown, fallback: TfPreviewKind = 'other'): TfPreviewKind {
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

function looksLikeTfDump(text: string): boolean {
  if (/\b(?:EPUB|MOBI|AZW|LATEX|SVG|PSD|AI|HEIC|RAW) dump\b/i.test(text)) return false;
  return /\bTIFF dump\b/i.test(text) || (/^\s*PAGE\s+\S+/m.test(text) && /^\s*(?:META|SIZE)\s+/m.test(text));
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isTfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === TF_MAGIC[0] && bytes[1] === TF_MAGIC[1] && bytes[2] === TF_MAGIC[2] && bytes[3] === TF_MAGIC[3];
}

function isTiffBinary(bytes: Uint8Array): boolean {
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
  const fromFile = fileName.replace(/\.(?:tiff|tif|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
  if (/shop/i.test(fromFile) || /shop/i.test(fallback)) return 'ShopFloor';
  return fromFile;
}

function colorFor(index: number, hex = ''): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) return hex;
  return PALETTE[index % PALETTE.length];
}

function makePage(raw: Record<string, unknown>, index: number): TfPage {
  const name = asString(raw.name || raw.id, `page${index + 1}`);
  return {
    id: name,
    index,
    name,
    kind: asPageKind(raw.kind || raw.type || name, index === 0 ? 'primary' : 'other'),
    width: asNumber(raw.width ?? raw.w, 12),
    height: asNumber(raw.height ?? raw.h, 8)
  };
}

function makeMeta(raw: Record<string, unknown>, index: number): TfMeta {
  const name = asString(raw.name || raw.id, `meta${index + 1}`);
  return { id: `meta-${name}-${index}`, index, name, value: asString(raw.value || raw.kind) };
}

function makePreview(raw: Record<string, unknown>, index: number): TfPreview {
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
    page: asString(raw.page, 'cover'),
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
  sourceKind: TfSourceKind,
  title: string,
  encoding: string,
  tiffVer: string,
  width: number,
  height: number,
  compression: string,
  photometric: string,
  pages: TfPage[],
  metas: TfMeta[],
  previews: TfPreview[],
  warnings: string[]
): TfDataset {
  if (!pages.length && !metas.length && !previews.length) throw new Error('TIFF dump contains no pages or metadata');
  if (!pages.length) pages.push(makePage({ name: 'cover', kind: 'primary', width, height }, 0));
  pages.forEach((p, i) => (p.index = i));
  metas.forEach((m, i) => (m.index = i));
  previews.forEach((p, i) => (p.index = i));
  const compressionVal = compression || metas.find((m) => m.name.toLowerCase() === 'compression')?.value || '—';
  const photometricVal = photometric || metas.find((m) => m.name.toLowerCase() === 'photometric')?.value || '—';
  const columns: TfColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'page', index: 2, name: 'page', type: 'STRING' },
    { id: 'meta', index: 3, name: 'meta', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...pages.map((p) => ({ name: p.name, type: 'page', page: p.name, meta: '', value: `${p.width}x${p.height}` })),
    ...metas.map((m) => ({ name: m.name, type: 'meta', page: '', meta: m.name, value: m.value })),
    ...previews.map((p) => ({
      name: p.name,
      type: 'preview',
      page: p.page || pages[0]?.name || 'cover',
      meta: '',
      value: p.text || (p.kind === 'circle' ? String(p.r) : p.kind === 'line' ? 'aisle' : `${p.w}x${p.h}`)
    }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    tiffVer: tiffVer || '1.0',
    width: width || pages[0]?.width || 12,
    height: height || pages[0]?.height || 8,
    compression: compressionVal,
    photometric: photometricVal,
    pageCount: pages.length,
    metaCount: metas.length,
    pages,
    metas,
    previews,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: TfSourceKind = 'json', warnings: string[] = []): TfDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'TiffDoc'));
  const pages = ((Array.isArray(root.pages) ? root.pages : []) as unknown[]).map((item, i) => makePage(rec(item), i));
  const metas = ((Array.isArray(root.metas) ? root.metas : []) as unknown[]).map((item, i) => makeMeta(rec(item), i));
  const previews = ((Array.isArray(root.previews) ? root.previews : []) as unknown[]).map((item, i) => makePreview(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    'UTF-8',
    asString(root.tiffVer || root.version, '1.0'),
    asNumber(root.width, 12),
    asNumber(root.height, 8),
    asString(root.compression),
    asString(root.photometric),
    pages,
    metas,
    previews,
    warnings
  );
}

function parseAsciiTf(text: string, fileName: string): TfDataset {
  const version = /TIFF dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /TIFF dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'TiffDoc');
  const name = prettyModelName(fileName, dumpName);
  const pages: TfPage[] = [];
  const metas: TfMeta[] = [];
  const previews: TfPreview[] = [];
  let width = 12;
  let height = 8;
  let compression = '';
  let photometric = '';
  const size = /\bSIZE\s+([\d.]+)\s+([\d.]+)/i.exec(text);
  if (size) {
    width = Number(size[1]) || width;
    height = Number(size[2]) || height;
  }
  let m: RegExpExecArray | null;
  const pageRe = /\bPAGE\s+(\S+)\s+([\d.]+)\s+([\d.]+)/gi;
  while ((m = pageRe.exec(text))) {
    const kind = /thumb/i.test(m[1]) ? 'thumbnail' : pages.length ? 'overlay' : 'primary';
    pages.push(makePage({ name: m[1], kind, width: m[2], height: m[3] }, pages.length));
  }
  const metaRe = /\bMETA\s+(\S+)\s+(.+)$/gim;
  while ((m = metaRe.exec(text))) {
    if (m[1].toLowerCase() === 'compression') compression = m[2].trim();
    if (m[1].toLowerCase() === 'photometric') photometric = m[2].trim();
    metas.push(makeMeta({ name: m[1], value: m[2].trim() }, metas.length));
  }
  const shapeRe =
    /\bSHAPE\s+(\S+)\s+(\S+)\s+(\S+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?(?:\s+(#[0-9a-fA-F]{3,8}))?/gi;
  while ((m = shapeRe.exec(text))) {
    const kind = asPreviewKind(m[1]);
    const raw: Record<string, unknown> = { kind, name: m[2], page: m[3], x: m[4], y: m[5], colorHex: m[8] };
    if (kind === 'circle') raw.r = m[6];
    else if (kind === 'line') {
      raw.x2 = m[6];
      raw.y2 = m[7] ?? m[6];
    } else {
      raw.w = m[6];
      raw.h = m[7] ?? m[6];
    }
    previews.push(makePreview(raw, previews.length));
  }
  const textRe = /\bTEXT\s+(\S+)\s+(\S+)\s+([-\d.]+)\s+([-\d.]+)/gi;
  while ((m = textRe.exec(text))) {
    previews.push(
      makePreview(
        { kind: 'text', name: /shop/i.test(m[1]) ? 'title' : m[1], page: m[2], x: m[3], y: m[4], text: m[1], colorHex: '#e2e8f0' },
        previews.length
      )
    );
  }
  if (!pages.length && !metas.length) throw new Error('TIFF dump has no PAGE or META entries');
  const warnings = ['ASCII TIFF dump is a metadata subset — not Photoshop, ImageMagick, or a full TIFF kernel. Binary TIFF is not expanded.'];
  return finishDataset(name, 'tiff', name, 'UTF-8', version, width, height, compression, photometric, pages, metas, previews, warnings);
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

function parseCsvAsTf(text: string, fileName: string): TfDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('TIFF CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const pages: TfPage[] = [];
  const metas: TfMeta[] = [];
  const previews: TfPreview[] = [];
  let compression = '';
  let photometric = '';
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'page') {
      const dim = /^([\d.]+)x([\d.]+)$/.exec(row.value || '');
      pages.push(makePage({ name: row.name || row.page, kind: row.kind, width: dim?.[1], height: dim?.[2] }, pages.length));
      return;
    }
    if (type === 'meta') {
      if (row.name.toLowerCase() === 'compression') compression = row.value;
      if (row.name.toLowerCase() === 'photometric') photometric = row.value;
      metas.push(makeMeta({ name: row.name || row.meta, value: row.value || row.kind }, metas.length));
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
          page: row.page || pages[0]?.name || 'cover',
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
  const name = prettyModelName(fileName, 'TiffDoc');
  return finishDataset(name, 'csv', name, 'UTF-8', '1.0', 12, 8, compression, photometric, pages, metas, previews, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: TfSourceKind): TfDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'TiffDoc')).trim();
  const keys: string[] = [];
  const pages: TfPage[] = [];
  const metas: TfMeta[] = [];
  const previews: TfPreview[] = [];
  let compression = '';
  let photometric = '';
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
      if (type === 'page') {
        pages.push(makePage({ name: row.name, kind: row.kind, width: 12, height: 8 }, pages.length));
        continue;
      }
      if (type === 'meta') {
        if (row.name.toLowerCase() === 'compression') compression = row.kind;
        if (row.name.toLowerCase() === 'photometric') photometric = row.kind;
        metas.push(makeMeta({ name: row.name, value: row.kind }, metas.length));
        continue;
      }
      previews.push(makePreview({ kind: row.kind || 'rect', name: row.name, text: row.kind }, previews.length));
    }
  }
  if (!pages.length && !metas.length) throw new Error('TIFF markdown contains no pages or metadata');
  return finishDataset(prettyModelName(fileName, name), sourceKind, name, 'UTF-8', '1.0', 12, 8, compression, photometric, pages, metas, previews, []);
}

function parseTf01(bytes: Uint8Array, fileName: string): TfDataset {
  if (bytes.length < 8) throw new Error('TIFF dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('TIFF dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid TF01 JSON');
  }
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  return ingestJson(parsed, fileName, ext === 'tif' ? 'tif' : 'tiff');
}

export function buildSampleTfBytes(): Uint8Array {
  const json = te.encode(TF_JSON_SAMPLE);
  const out: number[] = [...TF_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleTfJson(): string {
  return TF_JSON_SAMPLE;
}

export function parseTfText(text: string, fileName = ''): TfDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('TIFF dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeTfDump(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid TIFF JSON');
    }
    return ingestJson(parsed, fileName, ext === 'tif' ? 'tif' : ext === 'json' ? 'json' : 'tiff');
  }
  if (ext === 'tif' || ext === 'tiff' || looksLikeTfDump(raw)) return parseAsciiTf(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsTf(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a TIFF dump');
}

export function parseTfBytes(bytes: Uint8Array, fileName = ''): TfDataset {
  if (!bytes.length) throw new Error('TIFF dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed TIFF files are not supported — decompress first');
  if (isTiffBinary(bytes)) throw new Error('Binary TIFF (II*/MM*) is not expanded here — export a TIFF dump or JSON');
  if (isTfMagic(bytes)) return parseTf01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('ZIP TIFF archives are not expanded here — export a TIFF dump or JSON');
  return parseTfText(td.decode(bytes), fileName);
}

export function filterTfPages(items: TfPage[], query: string): TfPage[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('page:') || token.startsWith('layer:') || token.startsWith('name:')) {
        return `${p.name} ${p.kind}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) return `${p.kind} page`.includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('meta:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterTfMetas(items: TfMeta[], query: string): TfMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((m) =>
    tokens.every((token) => {
      if (token.startsWith('meta:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${m.name} ${m.value}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('page:') || token.startsWith('layer:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${m.name} ${m.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterTfPreviews(items: TfPreview[], query: string, pageName = ''): TfPreview[] {
  const scoped = pageName ? items.filter((p) => !p.page || p.page.toLowerCase() === pageName.toLowerCase()) : items;
  const q = query.trim().toLowerCase();
  if (!q) return scoped;
  const tokens = q.split(/\s+/).filter(Boolean);
  return scoped.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:') || token.startsWith('page:') || token.startsWith('layer:')) {
        return `${p.name} ${p.kind} ${p.page} ${p.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('meta:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.kind} ${p.page} ${p.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterTfRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('page:') ||
        token.startsWith('layer:') ||
        token.startsWith('meta:')
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
