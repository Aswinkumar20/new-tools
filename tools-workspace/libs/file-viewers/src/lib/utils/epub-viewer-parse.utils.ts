import type { EpChapter, EpColumn, EpDataset, EpMeta, EpSourceKind, EpTocEntry } from '../types/epub-viewer.types';
import { EP_JSON_SAMPLE } from '../constants/epub-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const EP_MAGIC = new Uint8Array([0x45, 0x50, 0x30, 0x31]); // EP01

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

function looksLikeEpubDump(text: string): boolean {
  const t = text.trim();
  if (/\bEPUB dump\b/i.test(t)) return true;
  if (/^\s*CHAPTER\s+\S+/m.test(t) && /^\s*(?:TOC|META)\s+/m.test(t)) return true;
  return false;
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isEpMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === EP_MAGIC[0] && bytes[1] === EP_MAGIC[1] && bytes[2] === EP_MAGIC[2] && bytes[3] === EP_MAGIC[3];
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyBookName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.(?:epub|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
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

function makeChapter(raw: Record<string, unknown>, index: number): EpChapter {
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

function makeToc(raw: Record<string, unknown>, index: number): EpTocEntry {
  const label = asString(raw.label || raw.title || raw.name, `Item ${index + 1}`);
  const href = asString(raw.href);
  const chapter = asString(raw.chapter || raw.id, href.replace(/\.[^.]+$/, '') || `ch${index + 1}`);
  return { id: chapter || `toc${index + 1}`, index, label, href, chapter };
}

function makeMeta(raw: Record<string, unknown>, index: number): EpMeta {
  const name = asString(raw.name || raw.id, `meta${index + 1}`);
  return { id: name, index, name, value: asString(raw.value) };
}

function finishDataset(
  name: string,
  sourceKind: EpSourceKind,
  title: string,
  creator: string,
  language: string,
  encoding: string,
  epubVer: string,
  chapters: EpChapter[],
  toc: EpTocEntry[],
  meta: EpMeta[],
  warnings: string[]
): EpDataset {
  if (!chapters.length && !toc.length && !meta.length) throw new Error('EPUB dump contains no chapters or TOC');
  chapters.forEach((c, i) => (c.index = i));
  toc.forEach((t, i) => (t.index = i));
  meta.forEach((m, i) => (m.index = i));
  if (!toc.length) {
    chapters.forEach((c, i) => toc.push(makeToc({ label: c.title, href: c.href, chapter: c.name }, i)));
  }
  if (!meta.some((m) => m.name === 'title') && title) meta.push(makeMeta({ name: 'title', value: title }, meta.length));
  if (!meta.some((m) => m.name === 'creator') && creator) meta.push(makeMeta({ name: 'creator', value: creator }, meta.length));
  if (!meta.some((m) => m.name === 'language') && language) meta.push(makeMeta({ name: 'language', value: language }, meta.length));
  const columns: EpColumn[] = [
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
    epubVer: epubVer || '—',
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

function ingestJson(raw: unknown, fileName: string, sourceKind: EpSourceKind = 'json', warnings: string[] = []): EpDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyBookName(fileName, 'EpubBook'));
  const chapters = ((Array.isArray(root.chapters) ? root.chapters : []) as unknown[]).map((item, i) => makeChapter(rec(item), i));
  const toc = ((Array.isArray(root.toc) ? root.toc : []) as unknown[]).map((item, i) => makeToc(rec(item), i));
  const meta = ((Array.isArray(root.meta) ? root.meta : []) as unknown[]).map((item, i) => makeMeta(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    asString(root.creator, 'EasyToolHub'),
    asString(root.language, 'en'),
    sourceKind === 'epub' ? 'UTF-8' : 'UTF-8',
    asString(root.epubVer || root.version, '3.0'),
    chapters,
    toc,
    meta,
    warnings
  );
}

function parseAsciiEpub(text: string, fileName: string): EpDataset {
  const version = /EPUB dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '3.0';
  const dumpName = /EPUB dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyBookName(fileName, 'EpubBook');
  const name = prettyBookName(fileName, dumpName);
  const chapters: EpChapter[] = [];
  const toc: EpTocEntry[] = [];
  const meta: EpMeta[] = [];
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
  if (!chapters.length && !toc.length) throw new Error('EPUB dump has no CHAPTER or TOC entries');
  const warnings = ['ASCII EPUB dump is a metadata subset — not Apple Books, Calibre, or a full EPUB3 kernel.'];
  return finishDataset(name, 'epub', title, creator || 'EasyToolHub', language, 'UTF-8', version, chapters, toc, meta, warnings);
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

function parseCsvAsEp(text: string, fileName: string): EpDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('EPUB CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const chapters: EpChapter[] = [];
  const toc: EpTocEntry[] = [];
  const meta: EpMeta[] = [];
  let title = prettyBookName(fileName, 'EpubBook');
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

function parseMarkdown(text: string, fileName: string, sourceKind: EpSourceKind): EpDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyBookName(fileName, 'EpubBook')).trim();
  const keys: string[] = [];
  const chapters: EpChapter[] = [];
  const toc: EpTocEntry[] = [];
  const meta: EpMeta[] = [];
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
  if (!chapters.length && !toc.length && !meta.length) throw new Error('EPUB markdown contains no chapters or TOC');
  return finishDataset(name, sourceKind, name, 'EasyToolHub', 'en', 'UTF-8', '3.0', chapters, toc, meta, []);
}

function parseEp01(bytes: Uint8Array, fileName: string): EpDataset {
  if (bytes.length < 8) throw new Error('EPUB dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('EPUB dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid EP01 JSON');
  }
  return ingestJson(parsed, fileName, 'epub');
}

function readZipEntries(bytes: Uint8Array): Array<{ name: string; data: Uint8Array; method: number }> {
  const out: Array<{ name: string; data: Uint8Array; method: number }> = [];
  let i = 0;
  while (i + 30 <= bytes.length) {
    if (bytes[i] !== 0x50 || bytes[i + 1] !== 0x4b) break;
    if (bytes[i + 2] === 0x01 && bytes[i + 3] === 0x02) break;
    if (bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) break;
    if (bytes[i + 2] !== 0x03 || bytes[i + 3] !== 0x04) break;
    const method = bytes[i + 8] | (bytes[i + 9] << 8);
    const comp = u32le(bytes, i + 18) >>> 0;
    const nameLen = bytes[i + 26] | (bytes[i + 27] << 8);
    const extraLen = bytes[i + 28] | (bytes[i + 29] << 8);
    const name = td.decode(bytes.subarray(i + 30, i + 30 + nameLen));
    const dataStart = i + 30 + nameLen + extraLen;
    if (dataStart + comp > bytes.length) throw new Error('EPUB ZIP entry is truncated');
    out.push({ name, data: bytes.subarray(dataStart, dataStart + comp), method });
    i = dataStart + comp;
  }
  return out;
}

function xmlAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"`, 'i');
  return re.exec(xml)?.[1] || '';
}

function xmlTexts(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

function parseZipEpub(bytes: Uint8Array, fileName: string): EpDataset {
  const entries = readZipEntries(bytes);
  if (!entries.length) throw new Error('EPUB ZIP contains no local file entries');
  if (entries.some((e) => e.method !== 0)) {
    throw new Error('Deflate EPUB is not expanded here — export a dump or store-only ZIP');
  }
  const files = new Map(entries.map((e) => [e.name.replace(/\\/g, '/'), td.decode(e.data)]));
  const container = files.get('META-INF/container.xml') || files.get('meta-inf/container.xml') || '';
  if (!container && ![...files.keys()].some((n) => /content\.opf$/i.test(n))) {
    throw new Error('EPUB ZIP is missing META-INF/container.xml');
  }
  const opfPath =
    xmlAttr(container, 'rootfile', 'full-path') || [...files.keys()].find((n) => /\.opf$/i.test(n)) || 'OEBPS/content.opf';
  const opf = files.get(opfPath) || '';
  if (!opf) throw new Error('EPUB ZIP is missing the OPF package');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const title = xmlTexts(opf, 'dc:title')[0] || prettyBookName(fileName, 'EpubBook');
  const creator = xmlTexts(opf, 'dc:creator')[0] || 'EasyToolHub';
  const language = xmlTexts(opf, 'dc:language')[0] || 'en';
  const manifest = new Map<string, string>();
  const itemRe = /<item\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(opf))) {
    const attrs = m[1];
    const id = /\bid="([^"]+)"/i.exec(attrs)?.[1] || '';
    const href = /\bhref="([^"]+)"/i.exec(attrs)?.[1] || '';
    if (id && href) manifest.set(id, href);
  }
  const chapters: EpChapter[] = [];
  const itemrefRe = /<itemref\b[^>]*\bidref="([^"]+)"/gi;
  while ((m = itemrefRe.exec(opf))) {
    const href = manifest.get(m[1]) || '';
    const path = href.startsWith('/') ? href.slice(1) : `${base}${href}`;
    const html = files.get(path) || files.get(href) || '';
    const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html)?.[1];
    chapters.push(
      makeChapter(
        {
          name: m[1],
          title: stripMarkup(heading || m[1]),
          href,
          text: stripMarkup(html)
        },
        chapters.length
      )
    );
  }
  const toc: EpTocEntry[] = [];
  const ncxPath = [...files.keys()].find((n) => /\.ncx$/i.test(n));
  const ncx = ncxPath ? files.get(ncxPath) || '' : '';
  if (ncx) {
    const navRe = /<navPoint\b[^>]*>([\s\S]*?)<\/navPoint>/gi;
    while ((m = navRe.exec(ncx))) {
      const label = /<text>([^<]*)<\/text>/i.exec(m[1])?.[1]?.trim() || '';
      const href = /<content[^>]*\bsrc="([^"]+)"/i.exec(m[1])?.[1] || '';
      const chapter = [...manifest.entries()].find(([, h]) => h === href || href.endsWith(h))?.[0] || href.replace(/\.[^.]+$/, '');
      toc.push(makeToc({ label, href, chapter }, toc.length));
    }
  }
  if (!chapters.length) throw new Error('EPUB OPF spine has no readable chapters');
  const warnings = ['Store-only EPUB ZIP maps OPF/NCX/XHTML — deflate packages and full CSS typography are not expanded.'];
  return finishDataset(prettyBookName(fileName, title), 'epub', title, creator, language, 'UTF-8', '3.0', chapters, toc, [], warnings);
}

function writeZipStore(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const locals: number[] = [];
  const centrals: number[] = [];
  for (const entry of entries) {
    const nameBytes = te.encode(entry.name);
    const localOffset = locals.length;
    locals.push(0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    writeU32le(0, locals);
    writeU32le(entry.data.length, locals);
    writeU32le(entry.data.length, locals);
    locals.push(nameBytes.length & 0xff, (nameBytes.length >> 8) & 0xff, 0, 0);
    locals.push(...nameBytes, ...entry.data);
    centrals.push(0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    writeU32le(0, centrals);
    writeU32le(entry.data.length, centrals);
    writeU32le(entry.data.length, centrals);
    centrals.push(nameBytes.length & 0xff, (nameBytes.length >> 8) & 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    writeU32le(localOffset, centrals);
    centrals.push(...nameBytes);
  }
  const cdOffset = locals.length;
  const out = [...locals, ...centrals, 0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0];
  const count = entries.length;
  out.push(count & 0xff, (count >> 8) & 0xff, count & 0xff, (count >> 8) & 0xff);
  writeU32le(centrals.length, out);
  writeU32le(cdOffset, out);
  out.push(0, 0);
  return new Uint8Array(out);
}

export function buildSampleEpBytes(): Uint8Array {
  const json = te.encode(EP_JSON_SAMPLE);
  const out: number[] = [...EP_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleEpJson(): string {
  return EP_JSON_SAMPLE;
}

export function buildSampleEpZip(): Uint8Array {
  const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
  const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>ShopRanker Handbook</dc:title>
    <dc:creator>EasyToolHub</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;
  const ncx = `<?xml version="1.0"?>
<ncx>
  <navMap>
    <navPoint id="ch1"><navLabel><text>Introduction</text></navLabel><content src="ch1.xhtml"/></navPoint>
    <navPoint id="ch2"><navLabel><text>Shop floor</text></navLabel><content src="ch2.xhtml"/></navPoint>
  </navMap>
</ncx>`;
  const ch1 = `<html><body><h1>Introduction</h1><p>ShopRanker is a local handbook for the shop floor. The slab is twelve by eight metres.</p></body></html>`;
  const ch2 = `<html><body><h1>Shop floor</h1><p>A column stands at ten, six. Keep the aisle clear along the centre line.</p></body></html>`;
  return writeZipStore([
    { name: 'mimetype', data: te.encode('application/epub+zip') },
    { name: 'META-INF/container.xml', data: te.encode(container) },
    { name: 'OEBPS/content.opf', data: te.encode(opf) },
    { name: 'OEBPS/toc.ncx', data: te.encode(ncx) },
    { name: 'OEBPS/ch1.xhtml', data: te.encode(ch1) },
    { name: 'OEBPS/ch2.xhtml', data: te.encode(ch2) }
  ]);
}

export function parseEpText(text: string, fileName = ''): EpDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('EPUB dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeEpubDump(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid EPUB JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'epub' || looksLikeEpubDump(raw)) return parseAsciiEpub(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsEp(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an EPUB dump');
}

export function parseEpBytes(bytes: Uint8Array, fileName = ''): EpDataset {
  if (!bytes.length) throw new Error('EPUB dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed EPUB files are not supported — decompress first');
  if (isEpMagic(bytes)) return parseEp01(bytes, fileName);
  if (isZipMagic(bytes)) return parseZipEpub(bytes, fileName);
  return parseEpText(td.decode(bytes), fileName);
}

export function filterEpChapters(items: EpChapter[], query: string): EpChapter[] {
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

export function filterEpToc(items: EpTocEntry[], query: string): EpTocEntry[] {
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

export function filterEpRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
