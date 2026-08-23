import type { SvColumn, SvDataset, SvLayer, SvShape, SvShapeKind, SvSourceKind } from '../types/svg-viewer.types';
import { SV_JSON_SAMPLE } from '../constants/svg-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const SV_MAGIC = new Uint8Array([0x53, 0x56, 0x30, 0x31]); // SV01
const PALETTE = ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee'];

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

function asKind(value: unknown, fallback: SvShapeKind = 'other'): SvShapeKind {
  const k = asString(value, fallback).toLowerCase();
  if (k === 'rect' || k === 'circle' || k === 'ellipse' || k === 'line' || k === 'polyline' || k === 'polygon' || k === 'path' || k === 'text' || k === 'other') {
    return k;
  }
  return fallback;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function looksLikeSvgDump(text: string): boolean {
  if (/\b(?:EPUB|MOBI|AZW|LATEX|PSD) dump\b/i.test(text)) return false;
  return /\bSVG dump\b/i.test(text) || (/^\s*LAYER\s+\S+/m.test(text) && /^\s*(?:SHAPE|TEXT)\s+/m.test(text));
}

function looksLikeSvgXml(text: string): boolean {
  return /<svg[\s>]/i.test(text) || /<rect\b/i.test(text) || /<circle\b/i.test(text);
}

function looksLikeSvg(text: string): boolean {
  return looksLikeSvgDump(text) || looksLikeSvgXml(text);
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isSvMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === SV_MAGIC[0] && bytes[1] === SV_MAGIC[1] && bytes[2] === SV_MAGIC[2] && bytes[3] === SV_MAGIC[3];
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.(?:svg|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
  if (/shop/i.test(fromFile) || /shop/i.test(fallback)) return 'ShopFloor';
  return fromFile;
}

function colorFor(index: number, hex = ''): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) return hex;
  return PALETTE[index % PALETTE.length];
}

function makeShape(raw: Record<string, unknown>, index: number): SvShape {
  const name = asString(raw.name || raw.id, `shape${index + 1}`);
  const kind = asKind(raw.kind || raw.type || raw.tag);
  const x = asNumber(raw.x ?? raw.x1 ?? raw.cx, 0);
  const y = asNumber(raw.y ?? raw.y1 ?? raw.cy, 0);
  const w = asNumber(raw.w ?? raw.width, kind === 'ellipse' ? asNumber(raw.rx, 0) * 2 : 0);
  const h = asNumber(raw.h ?? raw.height, kind === 'ellipse' ? asNumber(raw.ry, 0) * 2 : 0);
  const r = asNumber(raw.r ?? raw.radius, kind === 'circle' ? 0.35 : 0);
  return {
    id: name,
    index,
    name,
    kind,
    layer: asString(raw.layer, 'default') || 'default',
    colorHex: colorFor(index, asString(raw.colorHex || raw.fill || raw.stroke || raw.color)),
    x,
    y,
    x2: asNumber(raw.x2, x + w),
    y2: asNumber(raw.y2, y + h),
    w: w || Math.abs(asNumber(raw.x2, x) - x),
    h: h || Math.abs(asNumber(raw.y2, y) - y),
    r,
    text: asString(raw.text || raw.value)
  };
}

function rebuildSource(title: string, viewBox: string, width: number, height: number, shapes: SvShape[]): string {
  const layers = new Map<string, SvShape[]>();
  for (const s of shapes) {
    const list = layers.get(s.layer) || [];
    list.push(s);
    layers.set(s.layer, list);
  }
  const vb = viewBox || `0 0 ${width || 12} ${height || 8}`;
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${width || 12}" height="${height || 8}">`,
    `  <!-- ${title || 'SVG dump'} -->`
  ];
  for (const [layer, items] of layers) {
    lines.push(`  <g id="${layer}">`);
    for (const s of items) {
      if (s.kind === 'circle') lines.push(`    <circle id="${s.name}" cx="${s.x}" cy="${s.y}" r="${s.r || 0.35}" fill="${s.colorHex}"/>`);
      else if (s.kind === 'ellipse') lines.push(`    <ellipse id="${s.name}" cx="${s.x}" cy="${s.y}" rx="${s.w / 2 || s.r}" ry="${s.h / 2 || s.r}" fill="${s.colorHex}"/>`);
      else if (s.kind === 'line') lines.push(`    <line id="${s.name}" x1="${s.x}" y1="${s.y}" x2="${s.x2}" y2="${s.y2}" stroke="${s.colorHex}"/>`);
      else if (s.kind === 'text') lines.push(`    <text id="${s.name}" x="${s.x}" y="${s.y}" fill="${s.colorHex}">${s.text || s.name}</text>`);
      else if (s.kind === 'polyline' || s.kind === 'polygon') {
        const pts = `${s.x},${s.y} ${s.x2},${s.y2}`;
        lines.push(`    <${s.kind} id="${s.name}" points="${pts}" fill="none" stroke="${s.colorHex}"/>`);
      } else {
        lines.push(`    <rect id="${s.name}" x="${s.x}" y="${s.y}" width="${s.w || 1}" height="${s.h || 1}" fill="${s.colorHex}"/>`);
      }
    }
    lines.push('  </g>');
  }
  lines.push('</svg>');
  return lines.join('\n');
}

function finishDataset(
  name: string,
  sourceKind: SvSourceKind,
  title: string,
  encoding: string,
  svgVer: string,
  viewBox: string,
  width: number,
  height: number,
  shapes: SvShape[],
  layersIn: SvLayer[],
  sourceText: string,
  warnings: string[]
): SvDataset {
  if (!shapes.length) throw new Error('SVG dump contains no shapes');
  shapes.forEach((s, i) => (s.index = i));
  const layerMap = new Map<string, SvLayer>();
  layersIn.forEach((l, i) => layerMap.set(l.name, { ...l, index: i, shapeCount: 0 }));
  for (const s of shapes) {
    const existing = layerMap.get(s.layer);
    if (existing) {
      existing.shapeCount += 1;
      if (!existing.colorHex) existing.colorHex = s.colorHex;
    } else {
      layerMap.set(s.layer, { id: s.layer, index: layerMap.size, name: s.layer, colorHex: s.colorHex, shapeCount: 1 });
    }
  }
  const layers = Array.from(layerMap.values());
  layers.forEach((l, i) => (l.index = i));
  const columns: SvColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'layer', index: 2, name: 'layer', type: 'STRING' },
    { id: 'shape', index: 3, name: 'shape', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...layers.map((l) => ({ name: l.name, type: 'layer', layer: l.name, shape: '', value: l.colorHex })),
    ...shapes.map((s) => ({
      name: s.name,
      type: s.kind === 'text' ? 'text' : 'shape',
      layer: s.layer,
      shape: s.name,
      value: s.text || (s.kind === 'circle' ? String(s.r) : s.kind === 'line' ? 'aisle' : `${s.w}x${s.h}`)
    }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    svgVer: svgVer || '1.1',
    viewBox: viewBox || `0 0 ${width || 12} ${height || 8}`,
    width: width || 12,
    height: height || 8,
    shapeCount: shapes.length,
    layerCount: layers.length,
    sourceText: sourceText || rebuildSource(title || name, viewBox, width, height, shapes),
    shapes,
    layers,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: SvSourceKind = 'json', warnings: string[] = []): SvDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'SvgDoc'));
  const shapes = ((Array.isArray(root.shapes) ? root.shapes : []) as unknown[]).map((item, i) => makeShape(rec(item), i));
  const layers = ((Array.isArray(root.layers) ? root.layers : []) as unknown[]).map((item, i) => {
    const r = rec(item);
    const layerName = asString(r.name || r.id, `layer${i + 1}`);
    return {
      id: layerName,
      index: i,
      name: layerName,
      colorHex: colorFor(i, asString(r.colorHex || r.color)),
      shapeCount: asNumber(r.shapeCount, 0)
    };
  });
  const width = asNumber(root.width, 12);
  const height = asNumber(root.height, 8);
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    'UTF-8',
    asString(root.svgVer || root.version, '1.1'),
    asString(root.viewBox, `0 0 ${width} ${height}`),
    width,
    height,
    shapes,
    layers,
    asString(root.sourceText),
    warnings
  );
}

function parseAsciiSvg(text: string, fileName: string): SvDataset {
  const version = /SVG dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.1';
  const dumpName = /SVG dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyModelName(fileName, 'SvgDoc');
  const name = prettyModelName(fileName, dumpName);
  const shapes: SvShape[] = [];
  const layers: SvLayer[] = [];
  let viewBox = '0 0 12 8';
  let width = 12;
  let height = 8;
  let m: RegExpExecArray | null;
  const vb = /\bVIEWBOX\s+([\d.\s-]+)/i.exec(text);
  if (vb) {
    viewBox = vb[1].trim().replace(/\s+/g, ' ');
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length >= 4) {
      width = parts[2];
      height = parts[3];
    }
  }
  const layerRe = /\bLAYER\s+(\S+)\s+(#[0-9a-fA-F]{3,8}|\S+)/gi;
  while ((m = layerRe.exec(text))) {
    layers.push({ id: m[1], index: layers.length, name: m[1], colorHex: colorFor(layers.length, m[2]), shapeCount: 0 });
  }
  const shapeRe = /\bSHAPE\s+(\S+)\s+(\S+)\s+(\S+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?/gi;
  while ((m = shapeRe.exec(text))) {
    const hit = m;
    const kind = asKind(hit[1]);
    const raw: Record<string, unknown> = { kind, name: hit[2], layer: hit[3], x: hit[4], y: hit[5] };
    if (kind === 'circle') raw.r = hit[6];
    else if (kind === 'line') {
      raw.x2 = hit[6];
      raw.y2 = hit[7] ?? hit[6];
    } else {
      raw.w = hit[6];
      raw.h = hit[7] ?? hit[6];
    }
    const layer = layers.find((l) => l.name === hit[3]);
    if (layer) raw.colorHex = layer.colorHex;
    shapes.push(makeShape(raw, shapes.length));
  }
  const textRe = /\bTEXT\s+(\S+)\s+(\S+)\s+([-\d.]+)\s+([-\d.]+)/gi;
  while ((m = textRe.exec(text))) {
    const hit = m;
    const layer = layers.find((l) => l.name === hit[2]);
    shapes.push(
      makeShape(
        { kind: 'text', name: /shop/i.test(hit[1]) ? 'title' : hit[1], layer: hit[2], x: hit[3], y: hit[4], text: hit[1], colorHex: layer?.colorHex },
        shapes.length
      )
    );
  }
  if (!shapes.length) throw new Error('SVG dump has no SHAPE or TEXT entries');
  const warnings = ['ASCII SVG dump is a metadata subset — not Inkscape, Illustrator, or a full SVG DOM.'];
  return finishDataset(name, 'svg', name, 'UTF-8', version, viewBox, width, height, shapes, layers, '', warnings);
}

function attr(tag: string, name: string): string {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag);
  return m?.[1] ?? '';
}

function parseSvgElements(chunk: string, layer: string, shapes: SvShape[], layerColor = ''): void {
  let m: RegExpExecArray | null;
  const rectRe = /<rect\b([^>]*)\/?>/gi;
  while ((m = rectRe.exec(chunk))) {
    const t = m[1];
    shapes.push(
      makeShape(
        {
          kind: 'rect',
          name: attr(t, 'id') || `rect${shapes.length + 1}`,
          layer,
          x: attr(t, 'x'),
          y: attr(t, 'y'),
          w: attr(t, 'width'),
          h: attr(t, 'height'),
          colorHex: attr(t, 'fill') || layerColor
        },
        shapes.length
      )
    );
  }
  const circleRe = /<circle\b([^>]*)\/?>/gi;
  while ((m = circleRe.exec(chunk))) {
    const t = m[1];
    shapes.push(
      makeShape(
        {
          kind: 'circle',
          name: attr(t, 'id') || `circle${shapes.length + 1}`,
          layer,
          x: attr(t, 'cx'),
          y: attr(t, 'cy'),
          r: attr(t, 'r'),
          colorHex: attr(t, 'fill') || layerColor
        },
        shapes.length
      )
    );
  }
  const ellipseRe = /<ellipse\b([^>]*)\/?>/gi;
  while ((m = ellipseRe.exec(chunk))) {
    const t = m[1];
    shapes.push(
      makeShape(
        {
          kind: 'ellipse',
          name: attr(t, 'id') || `ellipse${shapes.length + 1}`,
          layer,
          x: attr(t, 'cx'),
          y: attr(t, 'cy'),
          rx: attr(t, 'rx'),
          ry: attr(t, 'ry'),
          colorHex: attr(t, 'fill') || layerColor
        },
        shapes.length
      )
    );
  }
  const lineRe = /<line\b([^>]*)\/?>/gi;
  while ((m = lineRe.exec(chunk))) {
    const t = m[1];
    shapes.push(
      makeShape(
        {
          kind: 'line',
          name: attr(t, 'id') || `line${shapes.length + 1}`,
          layer,
          x: attr(t, 'x1'),
          y: attr(t, 'y1'),
          x2: attr(t, 'x2'),
          y2: attr(t, 'y2'),
          colorHex: attr(t, 'stroke') || attr(t, 'fill') || layerColor
        },
        shapes.length
      )
    );
  }
  const textRe = /<text\b([^>]*)>([^<]*)<\/text>/gi;
  while ((m = textRe.exec(chunk))) {
    const t = m[1];
    const body = m[2].trim();
    shapes.push(
      makeShape(
        {
          kind: 'text',
          name: attr(t, 'id') || (/shop/i.test(body) ? 'title' : body || `text${shapes.length + 1}`),
          layer,
          x: attr(t, 'x'),
          y: attr(t, 'y'),
          text: body,
          colorHex: attr(t, 'fill') || layerColor
        },
        shapes.length
      )
    );
  }
  const polyRe = /<(polyline|polygon)\b([^>]*)\/?>/gi;
  while ((m = polyRe.exec(chunk))) {
    const kind = asKind(m[1], 'polyline');
    const t = m[2];
    const pts = attr(t, 'points')
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    shapes.push(
      makeShape(
        {
          kind,
          name: attr(t, 'id') || `${kind}${shapes.length + 1}`,
          layer,
          x: pts[0] ?? 0,
          y: pts[1] ?? 0,
          x2: pts[2] ?? pts[0] ?? 0,
          y2: pts[3] ?? pts[1] ?? 0,
          colorHex: attr(t, 'stroke') || attr(t, 'fill') || layerColor
        },
        shapes.length
      )
    );
  }
  const pathRe = /<path\b([^>]*)\/?>/gi;
  while ((m = pathRe.exec(chunk))) {
    const t = m[1];
    const d = attr(t, 'd');
    const start = /[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/.exec(d);
    shapes.push(
      makeShape(
        {
          kind: 'path',
          name: attr(t, 'id') || `path${shapes.length + 1}`,
          layer,
          x: start?.[1] ?? 0,
          y: start?.[2] ?? 0,
          colorHex: attr(t, 'stroke') || attr(t, 'fill') || layerColor
        },
        shapes.length
      )
    );
  }
}

function parseSvgXml(text: string, fileName: string): SvDataset {
  const name = prettyModelName(fileName, 'SvgDoc');
  const svgTag = /<svg\b([^>]*)>/i.exec(text)?.[1] || '';
  const viewBox = attr(svgTag, 'viewBox') || '0 0 12 8';
  const vbParts = viewBox.split(/\s+/).map(Number);
  const width = asNumber(attr(svgTag, 'width'), vbParts[2] || 12);
  const height = asNumber(attr(svgTag, 'height'), vbParts[3] || 8);
  const shapes: SvShape[] = [];
  const gRe = /<g\b([^>]*)>([\s\S]*?)<\/g>/gi;
  let m: RegExpExecArray | null;
  let grouped = false;
  while ((m = gRe.exec(text))) {
    grouped = true;
    const layer = attr(m[1], 'id') || attr(m[1], 'inkscape:label') || 'default';
    parseSvgElements(m[2], layer, shapes);
  }
  if (!grouped) parseSvgElements(text, 'default', shapes);
  if (!shapes.length) throw new Error('SVG source has no drawable shapes');
  const warnings = ['SVG subset maps rect, circle, ellipse, line, text, polyline, and path — full SVG DOM and filters are not applied.'];
  return finishDataset(name, 'svg', name, 'UTF-8', '1.1', viewBox, width, height, shapes, [], text, warnings);
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

function parseCsvAsSv(text: string, fileName: string): SvDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('SVG CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const shapes: SvShape[] = [];
  const layers: SvLayer[] = [];
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || row.kind || '').toLowerCase();
    if (type === 'layer') {
      layers.push({
        id: row.name || row.layer,
        index: layers.length,
        name: row.name || row.layer,
        colorHex: colorFor(layers.length, row.value || row.kind),
        shapeCount: 0
      });
      return;
    }
    const kind = asKind(row.kind || (type === 'text' ? 'text' : 'rect'));
    const value = row.value || '';
    const dim = /^([\d.]+)x([\d.]+)$/.exec(value);
    shapes.push(
      makeShape(
        {
          kind,
          name: row.name || row.shape,
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
        shapes.length
      )
    );
  });
  const name = prettyModelName(fileName, 'SvgDoc');
  return finishDataset(name, 'csv', name, 'UTF-8', '1.1', '0 0 12 8', 12, 8, shapes, layers, '', []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: SvSourceKind): SvDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'SvgDoc')).trim();
  const keys: string[] = [];
  const shapes: SvShape[] = [];
  const layers: SvLayer[] = [];
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
      if (type === 'layer') {
        layers.push({ id: row.name, index: layers.length, name: row.name, colorHex: colorFor(layers.length, row.kind), shapeCount: 0 });
        continue;
      }
      shapes.push(makeShape({ kind: row.kind || (type === 'text' ? 'text' : 'rect'), name: row.name, layer: row.layer || row.name, text: row.kind }, shapes.length));
    }
  }
  if (!shapes.length && !layers.length) throw new Error('SVG markdown contains no shapes or layers');
  if (!shapes.length) {
    shapes.push(makeShape({ kind: 'rect', name: 'slab', layer: layers[0]?.name || 'slab', w: 12, h: 8 }, 0));
  }
  return finishDataset(prettyModelName(fileName, name), sourceKind, name, 'UTF-8', '1.1', '0 0 12 8', 12, 8, shapes, layers, '', []);
}

function parseSv01(bytes: Uint8Array, fileName: string): SvDataset {
  if (bytes.length < 8) throw new Error('SVG dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('SVG dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid SV01 JSON');
  }
  return ingestJson(parsed, fileName, 'svg');
}

export function buildSampleSvBytes(): Uint8Array {
  const json = te.encode(SV_JSON_SAMPLE);
  const out: number[] = [...SV_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleSvJson(): string {
  return SV_JSON_SAMPLE;
}

export function parseSvText(text: string, fileName = ''): SvDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('SVG dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeSvg(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid SVG JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (looksLikeSvgXml(raw)) return parseSvgXml(raw, fileName);
  if (ext === 'svg' || looksLikeSvgDump(raw)) return parseAsciiSvg(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsSv(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an SVG dump');
}

export function parseSvBytes(bytes: Uint8Array, fileName = ''): SvDataset {
  if (!bytes.length) throw new Error('SVG dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed SVG files are not supported — decompress first');
  if (isSvMagic(bytes)) return parseSv01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('ZIP SVG archives are not expanded here — export a .svg dump or JSON');
  return parseSvText(td.decode(bytes), fileName);
}

export function filterSvShapes(items: SvShape[], query: string): SvShape[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('shape:') || token.startsWith('name:') || token.startsWith('text:')) {
        return `${s.name} ${s.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('layer:')) return s.layer.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('kind:')) {
        return `${s.kind} shape`.includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('row:')) return true;
      if (token === 'rect' || token === 'circle' || token === 'ellipse' || token === 'line' || token === 'text' || token === 'polyline' || token === 'polygon' || token === 'path') {
        return s.kind === token;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.kind} ${s.layer} ${s.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterSvLayers(items: SvLayer[], query: string): SvLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('layer:') || token.startsWith('name:')) {
        return l.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) return 'layer'.includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('shape:') || token.startsWith('text:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${l.name} ${l.colorHex}`.toLowerCase().includes(token);
    })
  );
}

export function filterSvRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
        token.startsWith('shape:') ||
        token.startsWith('text:')
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
