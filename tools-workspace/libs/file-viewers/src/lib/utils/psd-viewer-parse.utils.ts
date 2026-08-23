import type { PdChannel, PdColumn, PdDataset, PdEffect, PdLayer, PdLayerKind, PdSourceKind } from '../types/psd-viewer.types';
import { PD_JSON_SAMPLE } from '../constants/psd-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const PD_MAGIC = new Uint8Array([0x50, 0x44, 0x30, 0x31]); // PD01
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

function asBool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  const s = asString(value).toLowerCase();
  if (s === 'false' || s === 'hidden' || s === '0') return false;
  if (s === 'true' || s === 'visible' || s === '1') return true;
  return fallback;
}

function asKind(value: unknown, fallback: PdLayerKind = 'other'): PdLayerKind {
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

function looksLikePsdDump(text: string): boolean {
  if (/\b(?:EPUB|MOBI|AZW|LATEX|SVG) dump\b/i.test(text)) return false;
  return /\bPSD dump\b/i.test(text) || (/^\s*LAYER\s+\S+/m.test(text) && /^\s*(?:EFFECT|CHANNEL|SIZE)\s+/m.test(text));
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isPdMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === PD_MAGIC[0] && bytes[1] === PD_MAGIC[1] && bytes[2] === PD_MAGIC[2] && bytes[3] === PD_MAGIC[3];
}

function isPsdBinary(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x38 && bytes[1] === 0x42 && bytes[2] === 0x50 && bytes[3] === 0x53;
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.(?:psd|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
  if (/shop/i.test(fromFile) || /shop/i.test(fallback)) return 'ShopFloor';
  return fromFile;
}

function colorFor(index: number, hex = ''): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) return hex;
  return PALETTE[index % PALETTE.length];
}

function makeLayer(raw: Record<string, unknown>, index: number): PdLayer {
  const name = asString(raw.name || raw.id, `layer${index + 1}`);
  const kind = asKind(raw.kind || raw.type);
  const x = asNumber(raw.x ?? raw.x1, 0);
  const y = asNumber(raw.y ?? raw.y1, 0);
  const w = asNumber(raw.w ?? raw.width, 0);
  const h = asNumber(raw.h ?? raw.height, 0);
  return {
    id: name,
    index,
    name,
    kind,
    visible: asBool(raw.visible, true),
    colorHex: colorFor(index, asString(raw.colorHex || raw.color || raw.fill)),
    x,
    y,
    w,
    h,
    r: asNumber(raw.r ?? raw.radius, kind === 'circle' ? 0.35 : 0),
    x2: asNumber(raw.x2, x + w),
    y2: asNumber(raw.y2, y + h),
    text: asString(raw.text || raw.value)
  };
}

function makeEffect(raw: Record<string, unknown>, index: number): PdEffect {
  const name = asString(raw.name || raw.id, `fx${index + 1}`);
  return { id: `${name}-${index}`, index, name, layer: asString(raw.layer, '—'), kind: asString(raw.kind || raw.type, 'effect') || 'effect' };
}

function makeChannel(raw: Record<string, unknown>, index: number): PdChannel {
  const name = asString(raw.name || raw.id, `ch${index + 1}`);
  return { id: name, index, name };
}

function finishDataset(
  name: string,
  sourceKind: PdSourceKind,
  title: string,
  encoding: string,
  psdVer: string,
  width: number,
  height: number,
  layers: PdLayer[],
  effects: PdEffect[],
  channels: PdChannel[],
  warnings: string[]
): PdDataset {
  if (!layers.length) throw new Error('PSD dump contains no layers');
  layers.forEach((l, i) => (l.index = i));
  effects.forEach((e, i) => (e.index = i));
  channels.forEach((c, i) => (c.index = i));
  const columns: PdColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'layer', index: 2, name: 'layer', type: 'STRING' },
    { id: 'effect', index: 3, name: 'effect', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...channels.map((c) => ({ name: c.name, type: 'channel', layer: c.name, effect: '', value: c.name })),
    ...layers.map((l) => ({
      name: l.name,
      type: 'layer',
      layer: l.name,
      effect: '',
      value: l.text || (l.kind === 'circle' ? String(l.r) : l.kind === 'line' ? 'aisle' : `${l.w}x${l.h}`)
    })),
    ...effects.map((e) => ({ name: e.name, type: 'effect', layer: e.layer, effect: e.name, value: e.kind }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    psdVer: psdVer || '1.0',
    width: width || 12,
    height: height || 8,
    layerCount: layers.length,
    effectCount: effects.length,
    channelCount: channels.length,
    layers,
    effects,
    channels,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: PdSourceKind = 'json', warnings: string[] = []): PdDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'PsdDoc'));
  const layers = ((Array.isArray(root.layers) ? root.layers : []) as unknown[]).map((item, i) => makeLayer(rec(item), i));
  const effects = ((Array.isArray(root.effects) ? root.effects : []) as unknown[]).map((item, i) => makeEffect(rec(item), i));
  const channels = ((Array.isArray(root.channels) ? root.channels : []) as unknown[]).map((item, i) => makeChannel(rec(item), i));
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    'UTF-8',
    asString(root.psdVer || root.version, '1.0'),
    asNumber(root.width, 12),
    asNumber(root.height, 8),
    layers,
    effects,
    channels,
    warnings
  );
}

function parseAsciiPsd(text: string, fileName: string): PdDataset {
  const version = /PSD dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /PSD dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'PsdDoc');
  const name = prettyModelName(fileName, dumpName);
  const layers: PdLayer[] = [];
  const effects: PdEffect[] = [];
  const channels: PdChannel[] = [];
  let width = 12;
  let height = 8;
  const size = /\bSIZE\s+([\d.]+)\s+([\d.]+)/i.exec(text);
  if (size) {
    width = Number(size[1]) || width;
    height = Number(size[2]) || height;
  }
  let m: RegExpExecArray | null;
  const chRe = /\bCHANNEL\s+(\S+)/gi;
  while ((m = chRe.exec(text))) channels.push(makeChannel({ name: m[1] }, channels.length));
  const layerRe =
    /\bLAYER\s+(\S+)\s+(visible|hidden)\s+(#[0-9a-fA-F]{3,8}|\S+)\s+(BOX|CIRCLE|LINE|TEXT)\s+(.+)$/gim;
  while ((m = layerRe.exec(text))) {
    const geom = m[4].toUpperCase();
    const rest = m[5].trim().split(/\s+/);
    const raw: Record<string, unknown> = { name: m[1], visible: m[2], colorHex: m[3] };
    if (geom === 'CIRCLE') {
      raw.kind = 'circle';
      raw.x = rest[0];
      raw.y = rest[1];
      raw.r = rest[2];
    } else if (geom === 'LINE') {
      raw.kind = 'line';
      raw.x = rest[0];
      raw.y = rest[1];
      raw.x2 = rest[2];
      raw.y2 = rest[3];
    } else if (geom === 'TEXT') {
      raw.kind = 'text';
      raw.text = rest[0];
      raw.x = rest[1];
      raw.y = rest[2];
      if (/shop/i.test(String(rest[0]))) raw.name = m[1];
    } else {
      raw.kind = 'rect';
      raw.x = rest[0];
      raw.y = rest[1];
      raw.w = rest[2];
      raw.h = rest[3];
    }
    layers.push(makeLayer(raw, layers.length));
  }
  const fxRe = /\bEFFECT\s+(\S+)\s+(\S+)\s+(\S+)/gi;
  while ((m = fxRe.exec(text))) effects.push(makeEffect({ name: m[1], layer: m[2], kind: m[3] }, effects.length));
  if (!layers.length) throw new Error('PSD dump has no LAYER entries');
  const warnings = ['ASCII PSD dump is a metadata subset — not Photoshop, GIMP, or a full PSD kernel.'];
  return finishDataset(name, 'psd', name, 'UTF-8', version, width, height, layers, effects, channels, warnings);
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

function parseCsvAsPd(text: string, fileName: string): PdDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('PSD CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const layers: PdLayer[] = [];
  const effects: PdEffect[] = [];
  const channels: PdChannel[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'channel') {
      channels.push(makeChannel({ name: row.name || row.layer }, channels.length));
      return;
    }
    if (type === 'effect') {
      effects.push(makeEffect({ name: row.name || row.effect, layer: row.layer, kind: row.kind || row.value }, effects.length));
      return;
    }
    const kind = asKind(row.kind || 'rect');
    const value = row.value || '';
    const dim = /^([\d.]+)x([\d.]+)$/.exec(value);
    layers.push(
      makeLayer(
        {
          kind,
          name: row.name || row.layer,
          visible: true,
          w: dim?.[1],
          h: dim?.[2],
          r: kind === 'circle' ? value : undefined,
          text: kind === 'text' ? value : '',
          x: kind === 'circle' ? 10 : kind === 'line' ? 6 : kind === 'text' ? 4.2 : 0,
          y: kind === 'circle' ? 6 : kind === 'line' ? 1 : kind === 'text' ? 4.2 : 0,
          x2: kind === 'line' ? 6 : undefined,
          y2: kind === 'line' ? 7 : undefined
        },
        layers.length
      )
    );
  });
  const name = prettyModelName(fileName, 'PsdDoc');
  return finishDataset(name, 'csv', name, 'UTF-8', '1.0', 12, 8, layers, effects, channels, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: PdSourceKind): PdDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'PsdDoc')).trim();
  const keys: string[] = [];
  const layers: PdLayer[] = [];
  const effects: PdEffect[] = [];
  const channels: PdChannel[] = [];
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
        channels.push(makeChannel({ name: row.name }, channels.length));
        continue;
      }
      if (type === 'effect') {
        effects.push(makeEffect({ name: row.name, kind: row.kind, layer: row.layer || row.name }, effects.length));
        continue;
      }
      layers.push(makeLayer({ kind: row.kind || 'rect', name: row.name, text: row.kind }, layers.length));
    }
  }
  if (!layers.length) throw new Error('PSD markdown contains no layers');
  return finishDataset(prettyModelName(fileName, name), sourceKind, name, 'UTF-8', '1.0', 12, 8, layers, effects, channels, []);
}

function parsePd01(bytes: Uint8Array, fileName: string): PdDataset {
  if (bytes.length < 8) throw new Error('PSD dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('PSD dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid PD01 JSON');
  }
  return ingestJson(parsed, fileName, 'psd');
}

export function buildSamplePdBytes(): Uint8Array {
  const json = te.encode(PD_JSON_SAMPLE);
  const out: number[] = [...PD_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSamplePdJson(): string {
  return PD_JSON_SAMPLE;
}

export function parsePdText(text: string, fileName = ''): PdDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('PSD dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikePsdDump(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid PSD JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'psd' || looksLikePsdDump(raw)) return parseAsciiPsd(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsPd(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a PSD dump');
}

export function parsePdBytes(bytes: Uint8Array, fileName = ''): PdDataset {
  if (!bytes.length) throw new Error('PSD dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed PSD files are not supported — decompress first');
  if (isPsdBinary(bytes)) throw new Error('Binary Photoshop PSD (8BPS) is not expanded here — export a PSD dump or JSON');
  if (isPdMagic(bytes)) return parsePd01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('ZIP PSD archives are not expanded here — export a PSD dump or JSON');
  return parsePdText(td.decode(bytes), fileName);
}

export function filterPdLayers(items: PdLayer[], query: string): PdLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:')) {
        return `${l.name} ${l.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) return `${l.kind} layer`.includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('fx:') || token.startsWith('effect:') || token.startsWith('ch:') || token.startsWith('channel:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.kind} ${l.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterPdEffects(items: PdEffect[], query: string): PdEffect[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('fx:') || token.startsWith('effect:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${e.name} ${e.kind} ${e.layer}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('layer:') || token.startsWith('ch:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.kind} ${e.layer}`.toLowerCase().includes(token);
    })
  );
}

export function filterPdChannels(items: PdChannel[], query: string): PdChannel[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('ch:') || token.startsWith('channel:') || token.startsWith('name:')) {
        return c.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('layer:') || token.startsWith('fx:') || token.startsWith('row:') || token.startsWith('type:') || token.startsWith('kind:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return c.name.toLowerCase().includes(token);
    })
  );
}

export function filterPdRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('layer:') ||
        token.startsWith('fx:') ||
        token.startsWith('effect:') ||
        token.startsWith('ch:') ||
        token.startsWith('channel:')
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
