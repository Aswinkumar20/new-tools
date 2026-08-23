import type {
  OdBlock,
  OdBlockKind,
  OdCell,
  OdColumn,
  OdDataset,
  OdPage,
  OdPageKind,
  OdSheet,
  OdSheetKind,
  OdSourceKind
} from '../types/opendocument-viewer.types';
import { OD_JSON_SAMPLE } from '../constants/opendocument-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const OD_MAGIC = new Uint8Array([0x4f, 0x44, 0x30, 0x31]); // OD01

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asPageKind(value: unknown, fallback: OdPageKind = 'other'): OdPageKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'cover' || k === 'notes' || k === 'slide' || k === 'other') return k;
  if (k === 'page') return 'cover';
  return fallback;
}

function asSheetKind(value: unknown, fallback: OdSheetKind = 'other'): OdSheetKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'data' || k === 'inventory' || k === 'other') return k;
  if (k === 'sheet') return 'data';
  return fallback;
}

function asBlockKind(value: unknown, fallback: OdBlockKind = 'other'): OdBlockKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'heading' || k === 'para' || k === 'list' || k === 'other') return k;
  if (k === 'h1' || k === 'title') return 'heading';
  if (k === 'p' || k === 'paragraph') return 'para';
  return fallback;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function looksLikeOdDump(text: string): boolean {
  if (/\b(?:EPUB|MOBI|AZW|LATEX|SVG|PSD|AI|HEIC|RAW|TIFF|RTF) dump\b/i.test(text)) return false;
  return /\bODF dump\b/i.test(text) || (/^\s*PAGE\s+\S+/m.test(text) && /^\s*(?:SHEET|BLOCK|CELL)\s+/m.test(text));
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isOdMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === OD_MAGIC[0] && bytes[1] === OD_MAGIC[1] && bytes[2] === OD_MAGIC[2] && bytes[3] === OD_MAGIC[3];
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.(?:odt|ods|odp|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
  if (/shop/i.test(fromFile) || /shop/i.test(fallback)) return 'ShopRanker';
  return fromFile;
}

function makePage(raw: Record<string, unknown>, index: number): OdPage {
  const name = asString(raw.name || raw.id, `page${index + 1}`);
  return { id: name, index, name, kind: asPageKind(raw.kind || raw.type || name, index === 0 ? 'cover' : 'other') };
}

function makeSheet(raw: Record<string, unknown>, index: number): OdSheet {
  const name = asString(raw.name || raw.id, `sheet${index + 1}`);
  return { id: name, index, name, kind: asSheetKind(raw.kind || raw.type || name, /invent/i.test(name) ? 'inventory' : 'data') };
}

function makeBlock(raw: Record<string, unknown>, index: number): OdBlock {
  const name = asString(raw.name || raw.id, `block${index + 1}`);
  return {
    id: `${name}-${index}`,
    index,
    name,
    kind: asBlockKind(raw.kind || raw.type),
    page: asString(raw.page, 'cover'),
    text: asString(raw.text || raw.value)
  };
}

function makeCell(raw: Record<string, unknown>, index: number): OdCell {
  const ref = asString(raw.ref || raw.name, `A${index + 1}`);
  const sheet = asString(raw.sheet, 'inventory');
  return { id: `${sheet}-${ref}-${index}`, index, sheet, ref, value: asString(raw.value || raw.text) };
}

function finishDataset(
  name: string,
  sourceKind: OdSourceKind,
  title: string,
  author: string,
  encoding: string,
  odfVer: string,
  kind: string,
  pages: OdPage[],
  sheets: OdSheet[],
  blocks: OdBlock[],
  cells: OdCell[],
  warnings: string[]
): OdDataset {
  if (!pages.length && !sheets.length && !blocks.length && !cells.length) {
    throw new Error('ODF dump contains no pages, sheets, or cells');
  }
  if (!pages.length && blocks.length) pages.push(makePage({ name: 'cover', kind: 'cover' }, 0));
  if (!sheets.length && cells.length) sheets.push(makeSheet({ name: cells[0].sheet || 'inventory', kind: 'inventory' }, 0));
  pages.forEach((p, i) => (p.index = i));
  sheets.forEach((s, i) => (s.index = i));
  blocks.forEach((b, i) => (b.index = i));
  cells.forEach((c, i) => (c.index = i));
  const columns: OdColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'page', index: 2, name: 'page', type: 'STRING' },
    { id: 'sheet', index: 3, name: 'sheet', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...pages.map((p) => ({ name: p.name, type: 'page', page: p.name, sheet: '', value: p.kind })),
    ...sheets.map((s) => ({ name: s.name, type: 'sheet', page: '', sheet: s.name, value: s.kind })),
    ...blocks.map((b) => ({ name: b.name, type: 'block', page: b.page, sheet: '', value: b.text })),
    ...cells.map((c) => ({ name: c.ref, type: 'cell', page: '', sheet: c.sheet, value: c.value }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    author: author || '—',
    encoding,
    odfVer: odfVer || '1.0',
    kind: kind || (sourceKind === 'ods' || sourceKind === 'odp' ? sourceKind : 'odt'),
    pageCount: pages.length,
    sheetCount: sheets.length,
    pages,
    sheets,
    blocks,
    cells,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: OdSourceKind = 'json', warnings: string[] = []): OdDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'OdfDoc'));
  const pages = ((Array.isArray(root.pages) ? root.pages : []) as unknown[]).map((item, i) => makePage(rec(item), i));
  const sheets = ((Array.isArray(root.sheets) ? root.sheets : []) as unknown[]).map((item, i) => makeSheet(rec(item), i));
  const blocks = ((Array.isArray(root.blocks) ? root.blocks : []) as unknown[]).map((item, i) => makeBlock(rec(item), i));
  const cells = ((Array.isArray(root.cells) ? root.cells : []) as unknown[]).map((item, i) => makeCell(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    asString(root.author),
    'UTF-8',
    asString(root.odfVer || root.version, '1.0'),
    asString(root.kind, sourceKind === 'json' ? 'odt' : sourceKind),
    pages,
    sheets,
    blocks,
    cells,
    warnings
  );
}

function parseAsciiOd(text: string, fileName: string): OdDataset {
  const version = /ODF dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /ODF dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'OdfDoc');
  const name = prettyModelName(fileName, dumpName);
  const pages: OdPage[] = [];
  const sheets: OdSheet[] = [];
  const blocks: OdBlock[] = [];
  const cells: OdCell[] = [];
  let title = name;
  let author = '';
  let kind = 'odt';
  const kindM = /\bKIND\s+(\S+)/i.exec(text);
  if (kindM) kind = kindM[1].toLowerCase();
  const titleM = /\bTITLE\s+(.+)$/im.exec(text);
  if (titleM) title = titleM[1].trim();
  const authorM = /\bAUTHOR\s+(.+)$/im.exec(text);
  if (authorM) author = authorM[1].trim();
  let m: RegExpExecArray | null;
  const pageRe = /^\s*PAGE\s+(\S+)/gim;
  while ((m = pageRe.exec(text))) {
    pages.push(makePage({ name: m[1], kind: m[1] }, pages.length));
  }
  const sheetRe = /^\s*SHEET\s+(\S+)/gim;
  while ((m = sheetRe.exec(text))) {
    sheets.push(makeSheet({ name: m[1], kind: m[1] }, sheets.length));
  }
  const blockRe = /^\s*BLOCK\s+(\S+)\s+(\S+)\s+(.+)$/gim;
  while ((m = blockRe.exec(text))) {
    blocks.push(makeBlock({ kind: m[1], page: m[2], name: /shop/i.test(m[3]) ? 'title' : `${m[1]}${blocks.length + 1}`, text: m[3].trim() }, blocks.length));
  }
  const cellRe = /^\s*CELL\s+(\S+)\s+(\S+)\s+(.+)$/gim;
  while ((m = cellRe.exec(text))) {
    cells.push(makeCell({ sheet: m[1], ref: m[2], value: m[3].trim() }, cells.length));
  }
  if (!pages.length && !sheets.length && !blocks.length && !cells.length) throw new Error('ODF dump has no PAGE, SHEET, BLOCK, or CELL entries');
  const warnings = ['ASCII ODF dump is a metadata subset — not LibreOffice, OnlyOffice, or a full ODF kernel. Binary ODT/ODS/ODP (ZIP) is not expanded.'];
  return finishDataset(name, kind === 'ods' || kind === 'odp' ? kind : 'odt', title, author, 'UTF-8', version, kind, pages, sheets, blocks, cells, warnings);
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

function parseCsvAsOd(text: string, fileName: string): OdDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('ODF CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const pages: OdPage[] = [];
  const sheets: OdSheet[] = [];
  const blocks: OdBlock[] = [];
  const cells: OdCell[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'page') {
      pages.push(makePage({ name: row.name || row.page, kind: row.kind }, pages.length));
      return;
    }
    if (type === 'sheet') {
      sheets.push(makeSheet({ name: row.name || row.sheet, kind: row.kind }, sheets.length));
      return;
    }
    if (type === 'cell') {
      cells.push(makeCell({ ref: row.name, sheet: row.sheet, value: row.value || row.kind }, cells.length));
      return;
    }
    blocks.push(makeBlock({ name: row.name, kind: row.kind || 'para', page: row.page, text: row.value || row.kind }, blocks.length));
  });
  const name = prettyModelName(fileName, 'OdfDoc');
  return finishDataset(name, 'csv', name, '', 'UTF-8', '1.0', 'odt', pages, sheets, blocks, cells, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: OdSourceKind): OdDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'OdfDoc')).trim();
  const keys: string[] = [];
  const pages: OdPage[] = [];
  const sheets: OdSheet[] = [];
  const blocks: OdBlock[] = [];
  const cells: OdCell[] = [];
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
        pages.push(makePage({ name: row.name, kind: row.kind }, pages.length));
        continue;
      }
      if (type === 'sheet') {
        sheets.push(makeSheet({ name: row.name, kind: row.kind }, sheets.length));
        continue;
      }
      if (type === 'cell') {
        cells.push(makeCell({ ref: row.name, sheet: 'inventory', value: row.kind }, cells.length));
        continue;
      }
      blocks.push(makeBlock({ name: row.name, kind: row.kind || 'para', text: row.kind }, blocks.length));
    }
  }
  if (!pages.length && !sheets.length && !blocks.length && !cells.length) throw new Error('ODF markdown contains no pages or sheets');
  return finishDataset(prettyModelName(fileName, name), sourceKind, name, '', 'UTF-8', '1.0', 'odt', pages, sheets, blocks, cells, []);
}

function parseOd01(bytes: Uint8Array, fileName: string): OdDataset {
  if (bytes.length < 8) throw new Error('ODF dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('ODF dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid OD01 JSON');
  }
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  const kind: OdSourceKind = ext === 'ods' || ext === 'odp' || ext === 'odt' ? ext : 'odt';
  return ingestJson(parsed, fileName, kind);
}

export function buildSampleOdBytes(): Uint8Array {
  const json = te.encode(OD_JSON_SAMPLE);
  const out: number[] = [...OD_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleOdJson(): string {
  return OD_JSON_SAMPLE;
}

export function parseOdText(text: string, fileName = ''): OdDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('ODF dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeOdDump(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid ODF JSON');
    }
    return ingestJson(parsed, fileName, ext === 'json' ? 'json' : 'odt');
  }
  if (ext === 'odt' || ext === 'ods' || ext === 'odp' || looksLikeOdDump(raw)) return parseAsciiOd(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsOd(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an ODF dump');
}

export function parseOdBytes(bytes: Uint8Array, fileName = ''): OdDataset {
  if (!bytes.length) throw new Error('ODF dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed OpenDocument files are not supported — decompress first');
  if (isZipMagic(bytes)) throw new Error('Binary ODT/ODS/ODP (ZIP) is not expanded here — export an ODF dump or JSON');
  if (isOdMagic(bytes)) return parseOd01(bytes, fileName);
  return parseOdText(td.decode(bytes), fileName);
}

export function filterOdPages(items: OdPage[], query: string): OdPage[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('page:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${p.name} ${p.kind}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('sheet:') || token.startsWith('block:') || token.startsWith('cell:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterOdSheets(items: OdSheet[], query: string): OdSheet[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('sheet:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${s.name} ${s.kind}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('page:') || token.startsWith('block:') || token.startsWith('cell:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterOdBlocks(items: OdBlock[], query: string, pageName = ''): OdBlock[] {
  const scoped = pageName ? items.filter((b) => !b.page || b.page.toLowerCase() === pageName.toLowerCase()) : items;
  const q = query.trim().toLowerCase();
  if (!q) return scoped;
  const tokens = q.split(/\s+/).filter(Boolean);
  return scoped.filter((b) =>
    tokens.every((token) => {
      if (token.startsWith('block:') || token.startsWith('page:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${b.name} ${b.kind} ${b.page} ${b.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('sheet:') || token.startsWith('cell:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${b.name} ${b.kind} ${b.page} ${b.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterOdCells(items: OdCell[], query: string, sheetName = ''): OdCell[] {
  const scoped = sheetName ? items.filter((c) => !c.sheet || c.sheet.toLowerCase() === sheetName.toLowerCase()) : items;
  const q = query.trim().toLowerCase();
  if (!q) return scoped;
  const tokens = q.split(/\s+/).filter(Boolean);
  return scoped.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('cell:') || token.startsWith('sheet:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${c.ref} ${c.sheet} ${c.value}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('page:') || token.startsWith('block:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.ref} ${c.sheet} ${c.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterOdRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('sheet:') ||
        token.startsWith('block:') ||
        token.startsWith('cell:')
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
