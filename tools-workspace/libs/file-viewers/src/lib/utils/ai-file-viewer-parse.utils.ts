import type { AiArtboard, AiColumn, AiDataset, AiLayer, AiPath, AiPathKind, AiSourceKind } from '../types/ai-file-viewer.types';
import { AI_JSON_SAMPLE } from '../constants/ai-file-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const AI_MAGIC = new Uint8Array([0x41, 0x49, 0x30, 0x31]); // AI01
const PALETTE = ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#fb923c'];

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

function asKind(value: unknown, fallback: AiPathKind = 'other'): AiPathKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'rect' || k === 'circle' || k === 'ellipse' || k === 'line' || k === 'text' || k === 'other') return k;
  if (k === 'box') return 'rect';
  return fallback;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function looksLikeAiDump(text: string): boolean {
  if (/\b(?:EPUB|MOBI|AZW|LATEX|SVG|PSD|HEIC) dump\b/i.test(text)) return false;
  return /\bAI dump\b/i.test(text) || (/^\s*ARTBOARD\s+\S+/m.test(text) && /^\s*(?:PATH|LAYER|TEXT)\s+/m.test(text));
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isAiMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === AI_MAGIC[0] && bytes[1] === AI_MAGIC[1] && bytes[2] === AI_MAGIC[2] && bytes[3] === AI_MAGIC[3];
}

function isPdfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function isEpsMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 11) return false;
  const head = td.decode(bytes.subarray(0, Math.min(16, bytes.length)));
  return head.startsWith('%!PS');
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.(?:ai|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
  if (/shop/i.test(fromFile) || /shop/i.test(fallback)) return 'ShopFloor';
  return fromFile;
}

function colorFor(index: number, hex = ''): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) return hex;
  return PALETTE[index % PALETTE.length];
}

function makeArtboard(raw: Record<string, unknown>, index: number): AiArtboard {
  const name = asString(raw.name || raw.id, `board${index + 1}`);
  return {
    id: name,
    index,
    name,
    x: asNumber(raw.x, 0),
    y: asNumber(raw.y, 0),
    w: asNumber(raw.w ?? raw.width, 12),
    h: asNumber(raw.h ?? raw.height, 8),
    colorHex: colorFor(index, asString(raw.colorHex || raw.color))
  };
}

function makeLayer(raw: Record<string, unknown>, index: number): AiLayer {
  const name = asString(raw.name || raw.id, `layer${index + 1}`);
  return { id: name, index, name, colorHex: colorFor(index, asString(raw.colorHex || raw.color)), pathCount: asNumber(raw.pathCount, 0) };
}

function makePath(raw: Record<string, unknown>, index: number): AiPath {
  const name = asString(raw.name || raw.id, `path${index + 1}`);
  const kind = asKind(raw.kind || raw.type);
  const x = asNumber(raw.x ?? raw.x1 ?? raw.cx, 0);
  const y = asNumber(raw.y ?? raw.y1 ?? raw.cy, 0);
  const w = asNumber(raw.w ?? raw.width, 0);
  const h = asNumber(raw.h ?? raw.height, 0);
  return {
    id: name,
    index,
    name,
    kind,
    artboard: asString(raw.artboard, 'ShopFloor') || 'ShopFloor',
    layer: asString(raw.layer, 'default') || 'default',
    colorHex: colorFor(index, asString(raw.colorHex || raw.fill || raw.color)),
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
  sourceKind: AiSourceKind,
  title: string,
  encoding: string,
  aiVer: string,
  width: number,
  height: number,
  artboards: AiArtboard[],
  layersIn: AiLayer[],
  paths: AiPath[],
  warnings: string[]
): AiDataset {
  if (!paths.length && !artboards.length) throw new Error('AI dump contains no artboards or paths');
  if (!artboards.length) artboards.push(makeArtboard({ name: name || 'Artboard1', w: width || 12, h: height || 8 }, 0));
  if (!paths.length) throw new Error('AI dump contains no paths');
  artboards.forEach((a, i) => (a.index = i));
  paths.forEach((p, i) => (p.index = i));
  const layerMap = new Map<string, AiLayer>();
  layersIn.forEach((l, i) => layerMap.set(l.name, { ...l, index: i, pathCount: 0 }));
  for (const p of paths) {
    const existing = layerMap.get(p.layer);
    if (existing) {
      existing.pathCount += 1;
      if (!existing.colorHex) existing.colorHex = p.colorHex;
    } else {
      layerMap.set(p.layer, { id: p.layer, index: layerMap.size, name: p.layer, colorHex: p.colorHex, pathCount: 1 });
    }
  }
  const layers = Array.from(layerMap.values());
  layers.forEach((l, i) => (l.index = i));
  const columns: AiColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'artboard', index: 2, name: 'artboard', type: 'STRING' },
    { id: 'layer', index: 3, name: 'layer', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...artboards.map((a) => ({ name: a.name, type: 'artboard', artboard: a.name, layer: '', value: `${a.w}x${a.h}` })),
    ...layers.map((l) => ({ name: l.name, type: 'layer', artboard: '', layer: l.name, value: l.colorHex })),
    ...paths.map((p) => ({
      name: p.name,
      type: 'path',
      artboard: p.artboard,
      layer: p.layer,
      value: p.text || (p.kind === 'circle' ? String(p.r) : p.kind === 'line' ? 'aisle' : `${p.w}x${p.h}`)
    }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    aiVer: aiVer || '1.0',
    width: width || artboards[0]?.w || 12,
    height: height || artboards[0]?.h || 8,
    artboardCount: artboards.length,
    layerCount: layers.length,
    pathCount: paths.length,
    artboards,
    layers,
    paths,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: AiSourceKind = 'json', warnings: string[] = []): AiDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'AiDoc'));
  const artboards = ((Array.isArray(root.artboards) ? root.artboards : []) as unknown[]).map((item, i) => makeArtboard(rec(item), i));
  const layers = ((Array.isArray(root.layers) ? root.layers : []) as unknown[]).map((item, i) => makeLayer(rec(item), i));
  const paths = ((Array.isArray(root.paths) ? root.paths : []) as unknown[]).map((item, i) => makePath(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    'UTF-8',
    asString(root.aiVer || root.version, '1.0'),
    asNumber(root.width, 12),
    asNumber(root.height, 8),
    artboards,
    layers,
    paths,
    warnings
  );
}

function parseAsciiAi(text: string, fileName: string): AiDataset {
  const version = /AI dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /AI dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'AiDoc');
  const name = prettyModelName(fileName, dumpName);
  const artboards: AiArtboard[] = [];
  const layers: AiLayer[] = [];
  const paths: AiPath[] = [];
  let m: RegExpExecArray | null;
  const boardRe = /\bARTBOARD\s+(\S+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/gi;
  while ((m = boardRe.exec(text))) {
    artboards.push(makeArtboard({ name: m[1], x: m[2], y: m[3], w: m[4], h: m[5] }, artboards.length));
  }
  const layerRe = /\bLAYER\s+(\S+)\s+(#[0-9a-fA-F]{3,8}|\S+)/gi;
  while ((m = layerRe.exec(text))) {
    layers.push(makeLayer({ name: m[1], colorHex: m[2] }, layers.length));
  }
  const pathRe = /\bPATH\s+(\S+)\s+(\S+)\s+(\S+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?/gi;
  while ((m = pathRe.exec(text))) {
    const hit = m;
    const kind = asKind(hit[1]);
    const raw: Record<string, unknown> = {
      kind,
      name: hit[2],
      layer: hit[3],
      artboard: artboards[0]?.name || name,
      x: hit[4],
      y: hit[5],
      colorHex: layers.find((l) => l.name === hit[3])?.colorHex
    };
    if (kind === 'circle') raw.r = hit[6];
    else if (kind === 'line') {
      raw.x2 = hit[6];
      raw.y2 = hit[7] ?? hit[6];
    } else {
      raw.w = hit[6];
      raw.h = hit[7] ?? hit[6];
    }
    paths.push(makePath(raw, paths.length));
  }
  const textRe = /\bTEXT\s+(\S+)\s+(\S+)\s+([-\d.]+)\s+([-\d.]+)/gi;
  while ((m = textRe.exec(text))) {
    const hit = m;
    paths.push(
      makePath(
        {
          kind: 'text',
          name: /shop/i.test(hit[1]) ? 'title' : hit[1],
          layer: hit[2],
          artboard: artboards[0]?.name || name,
          x: hit[3],
          y: hit[4],
          text: hit[1],
          colorHex: layers.find((l) => l.name === hit[2])?.colorHex
        },
        paths.length
      )
    );
  }
  if (!paths.length) throw new Error('AI dump has no PATH or TEXT entries');
  const warnings = ['ASCII Illustrator dump is a metadata subset — not Adobe Illustrator, Inkscape, or a full AI/PDF kernel.'];
  const width = artboards[0]?.w || 12;
  const height = artboards[0]?.h || 8;
  return finishDataset(name, 'ai', name, 'UTF-8', version, width, height, artboards, layers, paths, warnings);
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

function parseCsvAsAi(text: string, fileName: string): AiDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('AI CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const artboards: AiArtboard[] = [];
  const layers: AiLayer[] = [];
  const paths: AiPath[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'artboard' || type === 'board') {
      const dim = /^([\d.]+)x([\d.]+)$/.exec(row.value || '');
      artboards.push(makeArtboard({ name: row.name || row.artboard, w: dim?.[1], h: dim?.[2] }, artboards.length));
      return;
    }
    if (type === 'layer') {
      layers.push(makeLayer({ name: row.name || row.layer, colorHex: row.value || row.kind }, layers.length));
      return;
    }
    const kind = asKind(row.kind || (type === 'text' ? 'text' : 'rect'));
    const value = row.value || '';
    const dim = /^([\d.]+)x([\d.]+)$/.exec(value);
    paths.push(
      makePath(
        {
          kind,
          name: row.name,
          artboard: row.artboard || artboards[0]?.name || 'ShopFloor',
          layer: row.layer || 'default',
          w: dim?.[1],
          h: dim?.[2],
          r: kind === 'circle' ? value : undefined,
          text: kind === 'text' ? value : '',
          x: kind === 'circle' ? 10 : kind === 'line' ? 6 : kind === 'text' ? 4.2 : 0,
          y: kind === 'circle' ? 6 : kind === 'line' ? 1 : kind === 'text' ? 4.2 : 0,
          x2: kind === 'line' ? 6 : undefined,
          y2: kind === 'line' ? 7 : undefined,
          colorHex: layers.find((l) => l.name === (row.layer || ''))?.colorHex
        },
        paths.length
      )
    );
  });
  const name = prettyModelName(fileName, 'AiDoc');
  return finishDataset(name, 'csv', name, 'UTF-8', '1.0', 12, 8, artboards, layers, paths, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: AiSourceKind): AiDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'AiDoc')).trim();
  const keys: string[] = [];
  const artboards: AiArtboard[] = [];
  const layers: AiLayer[] = [];
  const paths: AiPath[] = [];
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
      if (type === 'artboard' || type === 'board') {
        artboards.push(makeArtboard({ name: row.name, w: 12, h: 8 }, artboards.length));
        continue;
      }
      if (type === 'layer') {
        layers.push(makeLayer({ name: row.name, colorHex: row.kind }, layers.length));
        continue;
      }
      paths.push(
        makePath(
          { kind: row.kind || 'rect', name: row.name, layer: row.layer || row.name, artboard: artboards[0]?.name || name, text: row.kind },
          paths.length
        )
      );
    }
  }
  if (!paths.length) throw new Error('AI markdown contains no paths');
  return finishDataset(prettyModelName(fileName, name), sourceKind, name, 'UTF-8', '1.0', 12, 8, artboards, layers, paths, []);
}

function parseAi01(bytes: Uint8Array, fileName: string): AiDataset {
  if (bytes.length < 8) throw new Error('AI dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('AI dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid AI01 JSON');
  }
  return ingestJson(parsed, fileName, 'ai');
}

export function buildSampleAiBytes(): Uint8Array {
  const json = te.encode(AI_JSON_SAMPLE);
  const out: number[] = [...AI_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleAiJson(): string {
  return AI_JSON_SAMPLE;
}

export function parseAiText(text: string, fileName = ''): AiDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('AI dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeAiDump(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid AI JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'ai' || looksLikeAiDump(raw)) return parseAsciiAi(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsAi(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an AI dump');
}

export function parseAiBytes(bytes: Uint8Array, fileName = ''): AiDataset {
  if (!bytes.length) throw new Error('AI dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed AI files are not supported — decompress first');
  if (isPdfMagic(bytes) || isEpsMagic(bytes)) {
    throw new Error('Binary Illustrator / PDF / EPS files are not expanded here — export an AI dump or JSON');
  }
  if (isAiMagic(bytes)) return parseAi01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('ZIP AI archives are not expanded here — export an AI dump or JSON');
  return parseAiText(td.decode(bytes), fileName);
}

export function filterAiArtboards(items: AiArtboard[], query: string): AiArtboard[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((a) =>
    tokens.every((token) => {
      if (token.startsWith('artboard:') || token.startsWith('board:') || token.startsWith('name:')) {
        return a.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) return 'artboard'.includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('layer:') || token.startsWith('path:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return a.name.toLowerCase().includes(token);
    })
  );
}

export function filterAiLayers(items: AiLayer[], query: string): AiLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:')) return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('kind:')) return 'layer'.includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('artboard:') || token.startsWith('path:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.colorHex}`.toLowerCase().includes(token);
    })
  );
}

export function filterAiPaths(items: AiPath[], query: string): AiPath[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('path:') || token.startsWith('name:')) {
        return `${p.name} ${p.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('layer:')) return p.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('artboard:') || token.startsWith('board:')) {
        return p.artboard.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) return `${p.kind} path`.includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('row:')) return true;
      if (token === 'rect' || token === 'circle' || token === 'line' || token === 'text') return p.kind === token;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.kind} ${p.layer} ${p.artboard} ${p.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterAiRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('artboard:') ||
        token.startsWith('board:') ||
        token.startsWith('layer:') ||
        token.startsWith('path:')
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
