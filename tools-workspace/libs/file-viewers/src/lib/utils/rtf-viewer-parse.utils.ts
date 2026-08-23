import type {
  RtBlock,
  RtBlockKind,
  RtColumn,
  RtDataset,
  RtSourceKind,
  RtSpan,
  RtSpanKind,
  RtStyle,
  RtStyleKind
} from '../types/rtf-viewer.types';
import { RT_JSON_SAMPLE, RT_RTF_SAMPLE } from '../constants/rtf-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const RT_MAGIC = new Uint8Array([0x52, 0x54, 0x30, 0x31]); // RT01

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStyleKind(value: unknown, fallback: RtStyleKind = 'other'): RtStyleKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'heading' || k === 'emphasis' || k === 'body' || k === 'other') return k;
  if (k === 'bold' || k === 'title') return 'heading';
  if (k === 'italic') return 'emphasis';
  if (k === 'normal') return 'body';
  return fallback;
}

function asSpanKind(value: unknown, fallback: RtSpanKind = 'other'): RtSpanKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'bold' || k === 'italic' || k === 'underline' || k === 'normal' || k === 'other') return k;
  if (k === 'b') return 'bold';
  if (k === 'i') return 'italic';
  if (k === 'u') return 'underline';
  return fallback;
}

function asBlockKind(value: unknown, fallback: RtBlockKind = 'other'): RtBlockKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'heading' || k === 'para' || k === 'other') return k;
  if (k === 'h1' || k === 'title' || k === 'bold') return 'heading';
  if (k === 'p' || k === 'paragraph' || k === 'normal') return 'para';
  return fallback;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{') && !/^\{\\rtf/i.test(t)) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function looksLikeRtDump(text: string): boolean {
  if (/\b(?:EPUB|MOBI|AZW|LATEX|SVG|PSD|AI|HEIC|RAW|TIFF|ODF) dump\b/i.test(text)) return false;
  return /\bRTF dump\b/i.test(text) || (/^\s*STYLE\s+\S+/m.test(text) && /^\s*(?:BLOCK|SPAN)\s+/m.test(text));
}

function looksLikeRtfSource(text: string): boolean {
  return /^\s*\{\\rtf/i.test(text);
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isRtMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === RT_MAGIC[0] && bytes[1] === RT_MAGIC[1] && bytes[2] === RT_MAGIC[2] && bytes[3] === RT_MAGIC[3];
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.(?:rtf|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
  if (/shop/i.test(fromFile) || /shop/i.test(fallback)) return 'ShopRanker';
  return fromFile;
}

function makeStyle(raw: Record<string, unknown>, index: number): RtStyle {
  const name = asString(raw.name || raw.id, `style${index + 1}`);
  return {
    id: name,
    index,
    name,
    kind: asStyleKind(raw.kind || raw.type || name),
    weight: asString(raw.weight || raw.kind, 'normal'),
    size: asString(raw.size, '12')
  };
}

function makeBlock(raw: Record<string, unknown>, index: number): RtBlock {
  const name = asString(raw.name || raw.id, `block${index + 1}`);
  return {
    id: `${name}-${index}`,
    index,
    name,
    kind: asBlockKind(raw.kind || raw.type),
    text: asString(raw.text || raw.value)
  };
}

function makeSpan(raw: Record<string, unknown>, index: number): RtSpan {
  const name = asString(raw.name || raw.id, `span${index + 1}`);
  return {
    id: `${name}-${index}`,
    index,
    name,
    kind: asSpanKind(raw.kind || raw.type),
    style: asString(raw.style, 'body'),
    text: asString(raw.text || raw.value)
  };
}

function finishDataset(
  name: string,
  sourceKind: RtSourceKind,
  title: string,
  author: string,
  encoding: string,
  rtfVer: string,
  sourceText: string,
  styles: RtStyle[],
  blocks: RtBlock[],
  spans: RtSpan[],
  warnings: string[]
): RtDataset {
  if (!styles.length && !blocks.length && !spans.length) throw new Error('RTF dump contains no styles, blocks, or spans');
  if (!styles.length) styles.push(makeStyle({ name: 'body', kind: 'body', weight: 'normal', size: '12' }, 0));
  styles.forEach((s, i) => (s.index = i));
  blocks.forEach((b, i) => (b.index = i));
  spans.forEach((s, i) => (s.index = i));
  const columns: RtColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'style', index: 2, name: 'style', type: 'STRING' },
    { id: 'block', index: 3, name: 'block', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...styles.map((s) => ({ name: s.name, type: 'style', style: s.name, block: '', value: `${s.weight} ${s.size}` })),
    ...blocks.map((b) => ({ name: b.name, type: 'block', style: '', block: b.name, value: b.text })),
    ...spans.map((s) => ({ name: s.name, type: 'span', style: s.style, block: '', value: s.text }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    author: author || '—',
    encoding,
    rtfVer: rtfVer || '1.0',
    styleCount: styles.length,
    blockCount: blocks.length,
    sourceText: sourceText || '',
    styles,
    blocks,
    spans,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: RtSourceKind = 'json', warnings: string[] = []): RtDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'RtfDoc'));
  const styles = ((Array.isArray(root.styles) ? root.styles : []) as unknown[]).map((item, i) => makeStyle(rec(item), i));
  const blocks = ((Array.isArray(root.blocks) ? root.blocks : []) as unknown[]).map((item, i) => makeBlock(rec(item), i));
  const spans = ((Array.isArray(root.spans) ? root.spans : []) as unknown[]).map((item, i) => makeSpan(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    asString(root.author),
    'UTF-8',
    asString(root.rtfVer || root.version, '1.0'),
    asString(root.sourceText),
    styles,
    blocks,
    spans,
    warnings
  );
}

function parseAsciiRt(text: string, fileName: string): RtDataset {
  const version = /RTF dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /RTF dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'RtfDoc');
  const name = prettyModelName(fileName, dumpName);
  const styles: RtStyle[] = [];
  const blocks: RtBlock[] = [];
  const spans: RtSpan[] = [];
  let title = name;
  let author = '';
  const titleM = /\bTITLE\s+(.+)$/im.exec(text);
  if (titleM) title = titleM[1].trim();
  const authorM = /\bAUTHOR\s+(.+)$/im.exec(text);
  if (authorM) author = authorM[1].trim();
  let m: RegExpExecArray | null;
  const styleRe = /^\s*STYLE\s+(\S+)\s+(\S+)\s+(\S+)/gim;
  while ((m = styleRe.exec(text))) {
    styles.push(makeStyle({ name: m[1], kind: m[1], weight: m[2], size: m[3] }, styles.length));
  }
  const blockRe = /^\s*BLOCK\s+(\S+)\s+(.+)$/gim;
  while ((m = blockRe.exec(text))) {
    blocks.push(makeBlock({ kind: m[1], name: /shop/i.test(m[2]) ? 'title' : `${m[1]}${blocks.length + 1}`, text: m[2].trim() }, blocks.length));
  }
  const spanRe = /^\s*SPAN\s+(\S+)\s+(\S+)\s+(.+)$/gim;
  while ((m = spanRe.exec(text))) {
    spans.push(makeSpan({ kind: m[1], style: m[2], name: /shop/i.test(m[3]) ? 'title' : `${m[1]}${spans.length + 1}`, text: m[3].trim() }, spans.length));
  }
  if (!styles.length && !blocks.length && !spans.length) throw new Error('RTF dump has no STYLE, BLOCK, or SPAN entries');
  const warnings = ['ASCII RTF dump is a formatting subset — not Word, WordPad, or a full RTF kernel. Complex RTF control words are not expanded.'];
  return finishDataset(name, 'rtf', title, author, 'UTF-8', version, text, styles, blocks, spans, warnings);
}

function parseRtfSubset(text: string, fileName: string): RtDataset {
  const name = prettyModelName(fileName, 'RtfDoc');
  const styles: RtStyle[] = [
    makeStyle({ name: 'heading', kind: 'heading', weight: 'bold', size: '18' }, 0),
    makeStyle({ name: 'emphasis', kind: 'emphasis', weight: 'italic', size: '12' }, 1),
    makeStyle({ name: 'body', kind: 'body', weight: 'normal', size: '12' }, 2)
  ];
  const blocks: RtBlock[] = [];
  const spans: RtSpan[] = [];
  const stripped = text
    .replace(/\{\\fonttbl[\s\S]*?\}/gi, ' ')
    .replace(/\{\\colortbl[\s\S]*?\}/gi, ' ')
    .replace(/\{\\stylesheet[\s\S]*?\}/gi, ' ')
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\u-?\d+\??/g, ' ');
  const parts = stripped.split(/\\par\b/i);
  for (const part of parts) {
    let chunk = part
      .replace(/\{\\rtf\d*\\ansi[^}]*/i, ' ')
      .replace(/\\[a-z]+\d* ?/gi, (token) => {
        if (/^\\b\d?$/i.test(token.trim()) || /^\\b0$/i.test(token.trim())) return token;
        if (/^\\i\d?$/i.test(token.trim()) || /^\\i0$/i.test(token.trim())) return token;
        if (/^\\ul\d?$/i.test(token.trim()) || /^\\ulnone$/i.test(token.trim())) return token;
        return ' ';
      })
      .replace(/[{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!chunk) continue;
    const isBold = /\\b(?!0)/i.test(part);
    const isItalic = /\\i(?!0)/i.test(part);
    chunk = chunk.replace(/\\b0?|\\i0?|\\ulnone|\\ul/gi, '').replace(/\s+/g, ' ').trim();
    if (!chunk) continue;
    const kind: RtSpanKind = isBold ? 'bold' : isItalic ? 'italic' : 'normal';
    const style = isBold ? 'heading' : isItalic ? 'emphasis' : 'body';
    spans.push(makeSpan({ name: /shop/i.test(chunk) ? 'title' : `span${spans.length + 1}`, kind, style, text: chunk }, spans.length));
    blocks.push(
      makeBlock({ name: /shop/i.test(chunk) ? 'title' : `para${blocks.length + 1}`, kind: isBold ? 'heading' : 'para', text: chunk }, blocks.length)
    );
  }
  if (!spans.length && !blocks.length) throw new Error('RTF source has no readable text');
  const warnings = ['RTF subset preview only — not Word or a full RTF kernel. Font tables, colors, and nested groups are skipped.'];
  const title = spans.find((s) => /shop/i.test(s.text))?.text || name;
  return finishDataset(name, 'rtf', title, '', 'UTF-8', '1.0', text, styles, blocks, spans, warnings);
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

function parseCsvAsRt(text: string, fileName: string): RtDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('RTF CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const styles: RtStyle[] = [];
  const blocks: RtBlock[] = [];
  const spans: RtSpan[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'style') {
      const parts = (row.value || '').split(/\s+/);
      styles.push(makeStyle({ name: row.name || row.style, kind: row.kind, weight: parts[0], size: parts[1] }, styles.length));
      return;
    }
    if (type === 'span') {
      spans.push(makeSpan({ name: row.name, kind: row.kind, style: row.style, text: row.value || row.kind }, spans.length));
      return;
    }
    blocks.push(makeBlock({ name: row.name || row.block, kind: row.kind || 'para', text: row.value || row.kind }, blocks.length));
  });
  const name = prettyModelName(fileName, 'RtfDoc');
  return finishDataset(name, 'csv', name, '', 'UTF-8', '1.0', '', styles, blocks, spans, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: RtSourceKind): RtDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'RtfDoc')).trim();
  const keys: string[] = [];
  const styles: RtStyle[] = [];
  const blocks: RtBlock[] = [];
  const spans: RtSpan[] = [];
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
      if (type === 'style') {
        styles.push(makeStyle({ name: row.name, kind: row.name, weight: row.kind }, styles.length));
        continue;
      }
      if (type === 'span') {
        spans.push(makeSpan({ name: row.name, kind: row.kind, text: row.kind }, spans.length));
        continue;
      }
      blocks.push(makeBlock({ name: row.name, kind: row.kind || 'para', text: row.kind }, blocks.length));
    }
  }
  if (!styles.length && !blocks.length && !spans.length) throw new Error('RTF markdown contains no styles or blocks');
  return finishDataset(prettyModelName(fileName, name), sourceKind, name, '', 'UTF-8', '1.0', '', styles, blocks, spans, []);
}

function parseRt01(bytes: Uint8Array, fileName: string): RtDataset {
  if (bytes.length < 8) throw new Error('RTF dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('RTF dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid RT01 JSON');
  }
  return ingestJson(parsed, fileName, 'rtf');
}

export function buildSampleRtBytes(): Uint8Array {
  const json = te.encode(RT_JSON_SAMPLE);
  const out: number[] = [...RT_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleRtJson(): string {
  return RT_JSON_SAMPLE;
}

export function parseRtText(text: string, fileName = ''): RtDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('RTF dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeRtfSource(raw)) return parseRtfSubset(raw, fileName);
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeRtDump(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid RTF JSON');
    }
    return ingestJson(parsed, fileName, ext === 'json' ? 'json' : 'rtf');
  }
  if (ext === 'rtf' || looksLikeRtDump(raw)) return parseAsciiRt(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsRt(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an RTF dump');
}

export function parseRtBytes(bytes: Uint8Array, fileName = ''): RtDataset {
  if (!bytes.length) throw new Error('RTF dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed RTF files are not supported — decompress first');
  if (isZipMagic(bytes)) throw new Error('ZIP RTF archives are not expanded here — export an RTF dump or JSON');
  if (isRtMagic(bytes)) return parseRt01(bytes, fileName);
  return parseRtText(td.decode(bytes), fileName);
}

export function filterRtStyles(items: RtStyle[], query: string): RtStyle[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('style:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${s.name} ${s.kind} ${s.weight}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('block:') || token.startsWith('span:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.kind} ${s.weight}`.toLowerCase().includes(token);
    })
  );
}

export function filterRtBlocks(items: RtBlock[], query: string): RtBlock[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((b) =>
    tokens.every((token) => {
      if (token.startsWith('block:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${b.name} ${b.kind} ${b.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('style:') || token.startsWith('span:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${b.name} ${b.kind} ${b.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterRtSpans(items: RtSpan[], query: string): RtSpan[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('span:') || token.startsWith('style:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${s.name} ${s.kind} ${s.style} ${s.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('block:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.kind} ${s.style} ${s.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterRtRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('style:') ||
        token.startsWith('block:') ||
        token.startsWith('span:')
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

export function exportRtHtml(dataset: RtDataset): string {
  const spans = dataset.spans.length
    ? dataset.spans
        .map((s) => {
          const tag = s.kind === 'bold' ? 'strong' : s.kind === 'italic' ? 'em' : s.kind === 'underline' ? 'u' : 'span';
          const safe = s.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<p><${tag}>${safe}</${tag}></p>`;
        })
        .join('\n')
    : dataset.blocks
        .map((b) => {
          const tag = b.kind === 'heading' ? 'h1' : 'p';
          const safe = b.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<${tag}>${safe}</${tag}>`;
        })
        .join('\n');
  const title = dataset.title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${title}</title></head><body>\n${spans}\n</body></html>\n`;
}

export { RT_RTF_SAMPLE };
