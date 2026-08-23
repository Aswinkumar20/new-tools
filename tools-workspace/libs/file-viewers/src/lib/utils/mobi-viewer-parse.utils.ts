import type { MbChapter, MbColumn, MbDataset, MbMeta, MbSourceKind, MbTocEntry } from '../types/mobi-viewer.types';
import { MB_JSON_SAMPLE } from '../constants/mobi-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const MB_MAGIC = new Uint8Array([0x4d, 0x42, 0x30, 0x31]); // MB01

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

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function looksLikeMobiDump(text: string): boolean {
  const t = text.trim();
  if (/\bEPUB dump\b/i.test(t)) return false;
  if (/\b(?:MOBI|AZW) dump\b/i.test(t)) return true;
  if (/^\s*CHAPTER\s+\S+/m.test(t) && /^\s*(?:TOC|META)\s+/m.test(t)) return true;
  return false;
}

function isBookMobi(bytes: Uint8Array): boolean {
  if (bytes.length >= 68) {
    const type = td.decode(bytes.subarray(60, 68));
    if (type === 'BOOKMOBI' || type === 'TEXtREAd') return true;
  }
  return /BOOKMOBI/.test(td.decode(bytes.subarray(0, Math.min(bytes.length, 256))));
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isMbMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === MB_MAGIC[0] && bytes[1] === MB_MAGIC[1] && bytes[2] === MB_MAGIC[2] && bytes[3] === MB_MAGIC[3];
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyBookName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.(?:mobi|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
  if (/shop/i.test(fromFile) || /shop/i.test(fallback)) return 'ShopRanker';
  return fromFile;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function stripMarkup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeChapter(raw: Record<string, unknown>, index: number): MbChapter {
  const name = asString(raw.name || raw.id, `ch${index + 1}`);
  const text = asString(raw.text || raw.body || raw.content);
  return {
    id: name,
    index,
    name,
    title: asString(raw.title, name) || name,
    href: asString(raw.href, `${name}.xhtml`) || `${name}.xhtml`,
    text,
    wordCount: asNumber(raw.wordCount, wordCount(text))
  };
}

function makeToc(raw: Record<string, unknown>, index: number): MbTocEntry {
  const label = asString(raw.label || raw.title || raw.name, `Item ${index + 1}`);
  const href = asString(raw.href);
  const chapter = asString(raw.chapter || raw.id, href.replace(/\.[^.]+$/, '') || `ch${index + 1}`);
  return { id: chapter || `toc${index + 1}`, index, label, href, chapter };
}

function makeMeta(raw: Record<string, unknown>, index: number): MbMeta {
  const name = asString(raw.name || raw.id, `meta${index + 1}`);
  return { id: name, index, name, value: asString(raw.value) };
}

function finishDataset(
  name: string,
  sourceKind: MbSourceKind,
  title: string,
  creator: string,
  language: string,
  encoding: string,
  mobiVer: string,
  chapters: MbChapter[],
  toc: MbTocEntry[],
  meta: MbMeta[],
  warnings: string[]
): MbDataset {
  if (!chapters.length && !toc.length && !meta.length) throw new Error('MOBI dump contains no chapters or TOC');
  chapters.forEach((c, i) => (c.index = i));
  toc.forEach((t, i) => (t.index = i));
  meta.forEach((m, i) => (m.index = i));
  if (!toc.length) {
    chapters.forEach((c, i) => toc.push(makeToc({ label: c.title, href: c.href, chapter: c.name }, i)));
  }
  if (!meta.some((m) => m.name === 'title') && title) meta.push(makeMeta({ name: 'title', value: title }, meta.length));
  if (!meta.some((m) => m.name === 'creator') && creator) meta.push(makeMeta({ name: 'creator', value: creator }, meta.length));
  if (!meta.some((m) => m.name === 'language') && language) meta.push(makeMeta({ name: 'language', value: language }, meta.length));
  const columns: MbColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'chapter', index: 2, name: 'chapter', type: 'STRING' },
    { id: 'toc', index: 3, name: 'toc', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...chapters.map((c) => ({ name: c.name, type: 'chapter', chapter: c.name, toc: c.title, value: c.text.slice(0, 80) })),
    ...toc.map((t) => ({ name: t.label, type: 'toc', chapter: t.chapter, toc: t.label, value: t.href })),
    ...meta.map((m) => ({ name: m.name, type: 'meta', chapter: m.name, toc: '', value: m.value }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    creator: creator || '—',
    language: language || 'en',
    encoding,
    mobiVer: mobiVer || '—',
    chapterCount: chapters.length,
    tocCount: toc.length,
    chapters,
    toc,
    meta,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: MbSourceKind = 'json', warnings: string[] = []): MbDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyBookName(fileName, 'MobiBook'));
  const chapters = ((Array.isArray(root.chapters) ? root.chapters : []) as unknown[]).map((item, i) => makeChapter(rec(item), i));
  const toc = ((Array.isArray(root.toc) ? root.toc : []) as unknown[]).map((item, i) => makeToc(rec(item), i));
  const meta = ((Array.isArray(root.meta) ? root.meta : []) as unknown[]).map((item, i) => makeMeta(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    asString(root.creator, 'EasyToolHub'),
    asString(root.language, 'en'),
    sourceKind === 'mobi' ? 'UTF-8' : 'UTF-8',
    asString(root.mobiVer || root.version, '6'),
    chapters,
    toc,
    meta,
    warnings
  );
}

function parseAsciiMobi(text: string, fileName: string): MbDataset {
  const version = /(?:MOBI|AZW) dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '6';
  const dumpName = /(?:MOBI|AZW) dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyBookName(fileName, 'MobiBook');
  const name = prettyBookName(fileName, dumpName);
  const chapters: MbChapter[] = [];
  const toc: MbTocEntry[] = [];
  const meta: MbMeta[] = [];
  let title = name;
  let creator = '';
  let language = 'en';
  let m: RegExpExecArray | null;
  const metaRe = /\bMETA\s+(\S+)\s+(.+)$/gim;
  while ((m = metaRe.exec(text))) {
    const key = m[1];
    const value = m[2].trim();
    if (key.toLowerCase() === 'title') title = value;
    if (key.toLowerCase() === 'creator') creator = value;
    if (key.toLowerCase() === 'language') language = value;
    meta.push(makeMeta({ name: key, value }, meta.length));
  }
  const tocRe = /\bTOC\s+(\S+)\s+(.+)$/gim;
  while ((m = tocRe.exec(text))) {
    toc.push(makeToc({ chapter: m[1], label: m[2].trim(), href: `${m[1]}.xhtml` }, toc.length));
  }
  const parts = text.split(/\bCHAPTER\s+/i).slice(1);
  for (const part of parts) {
    const header = /^([A-Za-z0-9_-]+)\s+([^\n]+)\n?([\s\S]*)$/.exec(part.trim());
    if (!header) continue;
    chapters.push(makeChapter({ name: header[1], title: header[2].trim(), text: header[3].trim() }, chapters.length));
  }
  if (!chapters.length && !toc.length) throw new Error('MOBI dump has no CHAPTER or TOC entries');
  const warnings = ['ASCII MOBI dump is a metadata subset — not Kindle, Calibre, or a full PalmDOC/MOBI kernel.'];
  return finishDataset(name, 'mobi', title, creator || 'EasyToolHub', language, 'UTF-8', version, chapters, toc, meta, warnings);
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

function parseCsvAsMb(text: string, fileName: string): MbDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('MOBI CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const chapters: MbChapter[] = [];
  const toc: MbTocEntry[] = [];
  const meta: MbMeta[] = [];
  let title = prettyBookName(fileName, 'MobiBook');
  let creator = '';
  let language = 'en';
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'meta') {
      if (row.name === 'title') title = row.value || title;
      if (row.name === 'creator') creator = row.value;
      if (row.name === 'language') language = row.value || language;
      meta.push(makeMeta({ name: row.name, value: row.value }, meta.length));
      return;
    }
    if (type === 'toc') {
      toc.push(makeToc({ label: row.toc || row.name, chapter: row.chapter, href: row.value || `${row.chapter}.xhtml` }, toc.length));
      return;
    }
    chapters.push(makeChapter({ name: row.name || row.chapter, title: row.toc || row.value, text: row.value }, chapters.length));
  });
  return finishDataset(title, 'csv', title, creator || 'EasyToolHub', language, 'UTF-8', '3.0', chapters, toc, meta, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: MbSourceKind): MbDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyBookName(fileName, 'MobiBook')).trim();
  const keys: string[] = [];
  const chapters: MbChapter[] = [];
  const toc: MbTocEntry[] = [];
  const meta: MbMeta[] = [];
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
      if (type === 'meta') {
        meta.push(makeMeta({ name: row.name, value: row.kind || row.value }, meta.length));
        continue;
      }
      if (type === 'toc') {
        toc.push(makeToc({ label: row.name, chapter: row.kind, href: `${row.kind || row.name}.xhtml` }, toc.length));
        continue;
      }
      chapters.push(makeChapter({ name: row.name, title: row.kind || row.name, text: row.kind || row.name }, chapters.length));
    }
  }
  if (!chapters.length && !toc.length && !meta.length) throw new Error('MOBI markdown contains no chapters or TOC');
  return finishDataset(name, sourceKind, name, 'EasyToolHub', 'en', 'UTF-8', '3.0', chapters, toc, meta, []);
}

function parseMb01(bytes: Uint8Array, fileName: string): MbDataset {
  if (bytes.length < 8) throw new Error('MOBI dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('MOBI dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid MB01 JSON');
  }
  return ingestJson(parsed, fileName, 'mobi');
}

export function buildSampleMbBytes(): Uint8Array {
  const json = te.encode(MB_JSON_SAMPLE);
  const out: number[] = [...MB_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleMbJson(): string {
  return MB_JSON_SAMPLE;
}

export function parseMbText(text: string, fileName = ''): MbDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('MOBI dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeMobiDump(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid MOBI JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'mobi' || ext === 'azw' || looksLikeMobiDump(raw)) return parseAsciiMobi(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsMb(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a MOBI dump');
}

export function parseMbBytes(bytes: Uint8Array, fileName = ''): MbDataset {
  if (!bytes.length) throw new Error('MOBI dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed MOBI files are not supported — decompress first');
  if (isMbMagic(bytes)) return parseMb01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('ZIP/EPUB is not a MOBI dump — export an ASCII MOBI/AZW dump or JSON');
  if (isBookMobi(bytes)) throw new Error('Binary PalmDOC/MOBI is not expanded here — export an ASCII dump or JSON');
  return parseMbText(td.decode(bytes), fileName);
}

export function filterMbChapters(items: MbChapter[], query: string): MbChapter[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('ch:') || token.startsWith('chapter:') || token.startsWith('name:') || token.startsWith('title:')) {
        return `${c.name} ${c.title}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) {
        return 'chapter'.includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('toc:') || token.startsWith('meta:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.name} ${c.title} ${c.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterMbToc(items: MbTocEntry[], query: string): MbTocEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('toc:') || token.startsWith('title:') || token.startsWith('name:')) {
        return `${t.label} ${t.chapter}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('ch:') || token.startsWith('chapter:')) {
        return t.chapter.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('meta:') || token.startsWith('row:') || token.startsWith('type:') || token.startsWith('kind:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${t.label} ${t.chapter} ${t.href}`.toLowerCase().includes(token);
    })
  );
}

export function filterMbRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('ch:') ||
        token.startsWith('chapter:') ||
        token.startsWith('toc:') ||
        token.startsWith('meta:') ||
        token.startsWith('title:') ||
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
