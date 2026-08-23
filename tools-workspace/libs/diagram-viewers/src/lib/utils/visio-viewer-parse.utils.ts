import type {
  VsdConnector,
  VsdDataset,
  VsdPage,
  VsdShape,
  VsdSourceKind
} from '../types/visio-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeVisioXml(text: string): boolean {
  return /<(?:VisioDocument|PageContents|Pages|Page|Shapes|Shape|visio)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:visio|vdx|vsdx|xml)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) return { source: fence[1].trim(), fenced: true };
  return { source: text.trim(), fenced: false };
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

function decodeLabel(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function num(value: string | undefined, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function inchesToPx(value: number): number {
  return value * 72;
}

function tagText(inner: string, name: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`, 'i');
  const match = re.exec(inner);
  return match ? decodeLabel(match[1] || '') : '';
}

function cellValue(inner: string, name: string): string {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?Cell\\b([^>]*?\\bN="${name}"[^>]*?)\\/?>|<(?:[\\w.-]+:)?Cell\\b([^>]*?\\bN="${name}"[^>]*)>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?Cell>`,
    'i'
  );
  const match = re.exec(inner);
  if (!match) return '';
  const a = attrs(match[1] || match[2] || '');
  return a.V || a.v || decodeLabel(match[3] || '');
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

export function isVisioZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

function extractStoredZipXml(bytes: Uint8Array): string[] {
  const texts: string[] = [];
  let i = 0;
  while (i + 30 < bytes.length) {
    if (!(bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04)) {
      i += 1;
      continue;
    }
    const method = readU16(bytes, i + 8);
    const compSize = readU32(bytes, i + 18);
    const nameLen = readU16(bytes, i + 26);
    const extraLen = readU16(bytes, i + 28);
    const nameStart = i + 30;
    const name = new TextDecoder('utf-8').decode(bytes.slice(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    if (method === 0 && /\.xml$/i.test(name) && /(page|visio|document)/i.test(name)) {
      const xml = new TextDecoder('utf-8').decode(bytes.slice(dataStart, dataStart + compSize));
      if (looksLikeVisioXml(xml)) texts.push(xml);
    }
    i = dataStart + compSize;
  }
  return texts;
}

function upsertPage(pages: VsdPage[], next: { id: string; name: string; width?: number; height?: number }): VsdPage {
  const existing = pages.find((p) => p.id === next.id || p.name === next.name);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.width) existing.width = next.width;
    if (next.height) existing.height = next.height;
    return existing;
  }
  const created: VsdPage = {
    id: next.id,
    index: pages.length,
    name: next.name,
    width: next.width || 792,
    height: next.height || 612,
    shapeCount: 0,
    connectorCount: 0
  };
  pages.push(created);
  return created;
}

function parseShapeInner(inner: string, a: Record<string, string>): { label: string; x: number; y: number; width: number; height: number } {
  const text = tagText(inner, 'Text') || decodeLabel(a.NameU || a.Name || a.label || a.value || '');
  const pinX = num(tagText(inner, 'PinX') || cellValue(inner, 'PinX'), NaN);
  const pinY = num(tagText(inner, 'PinY') || cellValue(inner, 'PinY'), NaN);
  const width = num(tagText(inner, 'Width') || cellValue(inner, 'Width') || a.width, 1.6);
  const height = num(tagText(inner, 'Height') || cellValue(inner, 'Height') || a.height, 0.6);
  const xAttr = num(a.x, NaN);
  const yAttr = num(a.y, NaN);
  const x = Number.isFinite(xAttr) ? xAttr : Number.isFinite(pinX) ? inchesToPx(pinX) : 80;
  const y = Number.isFinite(yAttr) ? yAttr : Number.isFinite(pinY) ? inchesToPx(8.5 - pinY) : 80;
  const w = width > 12 ? width : inchesToPx(width);
  const h = height > 12 ? height : inchesToPx(height);
  return { label: text || a.ID || a.id || 'Shape', x, y, width: w, height: h };
}

function isConnectorShape(a: Record<string, string>, inner: string): boolean {
  const type = (a.Type || a.type || '').toLowerCase();
  if (type === 'connector' || /connector/i.test(a.NameU || a.Name || '')) return true;
  return /<XForm1D\b/i.test(inner);
}

function parsePageShapes(
  xml: string,
  page: VsdPage,
  shapes: VsdShape[],
  connectors: VsdConnector[]
): void {
  const shapeRe =
    /<(?:[\w.-]+:)?Shape\b([^>]*?)\/>|<(?:[\w.-]+:)?Shape\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?Shape>/gi;
  const pendingConnectors: Array<{ id: string; label: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = shapeRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const inner = match[3] || '';
    const id = a.ID || a.Id || a.id || a.NameU || '';
    if (!id) continue;
    if (isConnectorShape(a, inner)) {
      pendingConnectors.push({ id, label: tagText(inner, 'Text') || decodeLabel(a.NameU || a.Name || '') });
      continue;
    }
    const geo = parseShapeInner(inner, a);
    shapes.push({
      id: `${page.id}:${id}`,
      index: shapes.length,
      pageId: page.id,
      pageName: page.name,
      label: geo.label,
      master: a.Master || a.MasterName || a.NameU || '',
      x: geo.x,
      y: geo.y,
      width: geo.width,
      height: geo.height
    });
  }
  const connects = new Map<string, { begin?: string; end?: string }>();
  const connectRe =
    /<(?:[\w.-]+:)?Connect\b([^>]*?)\/>|<(?:[\w.-]+:)?Connect\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?Connect>/gi;
  while ((match = connectRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const from = a.FromSheet || a.from || a.source || '';
    const to = a.ToSheet || a.to || a.target || '';
    if (!from || !to) continue;
    const cell = (a.FromCell || '').toLowerCase();
    const rec = connects.get(from) ?? {};
    if (cell.includes('end')) rec.end = to;
    else rec.begin = rec.begin || to;
    connects.set(from, rec);
  }
  for (const pending of pendingConnectors) {
    const rec = connects.get(pending.id);
    if (!rec?.begin || !rec?.end) continue;
    connectors.push({
      id: `${page.id}:${pending.id}`,
      index: connectors.length,
      pageId: page.id,
      pageName: page.name,
      source: rec.begin,
      target: rec.end,
      sourceName: '',
      targetName: '',
      label: pending.label
    });
  }
}

function parseSimpleVisio(
  xml: string,
  pages: VsdPage[],
  shapes: VsdShape[],
  connectors: VsdConnector[]
): void {
  const pageRe = /<(?:[\w.-]+:)?page\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?page>/gi;
  let match: RegExpExecArray | null;
  while ((match = pageRe.exec(xml))) {
    const a = attrs(match[1] || '');
    const page = upsertPage(pages, {
      id: a.id || a.name || `page-${pages.length + 1}`,
      name: a.name || a.id || `Page ${pages.length + 1}`,
      width: num(a.width, 792),
      height: num(a.height, 612)
    });
    for (const shapeMatch of (match[2] || '').matchAll(/<(?:[\w.-]+:)?shape\b([^>]*)\/?>/gi)) {
      const s = attrs(shapeMatch[1] || '');
      if (s.edge === '1' || s.source || s.target) continue;
      if (!s.id && !s.label && !s.value) continue;
      const id = s.id || s.label || `s-${shapes.length + 1}`;
      shapes.push({
        id: `${page.id}:${id}`,
        index: shapes.length,
        pageId: page.id,
        pageName: page.name,
        label: decodeLabel(s.label || s.value || id),
        master: s.master || '',
        x: num(s.x),
        y: num(s.y),
        width: num(s.width, 120),
        height: num(s.height, 56)
      });
    }
    for (const connMatch of (match[2] || '').matchAll(/<(?:[\w.-]+:)?(?:connector|connect|edge)\b([^>]*)\/?>/gi)) {
      const c = attrs(connMatch[1] || '');
      if (!c.source || !c.target) continue;
      connectors.push({
        id: `${page.id}:${c.id || `e-${connectors.length + 1}`}`,
        index: connectors.length,
        pageId: page.id,
        pageName: page.name,
        source: c.source,
        target: c.target,
        sourceName: '',
        targetName: '',
        label: decodeLabel(c.label || c.value || '')
      });
    }
  }
}

function parseVisioXml(xml: string, fileName: string, sourceKind: VsdSourceKind): VsdDataset {
  const warnings: string[] = [];
  const pages: VsdPage[] = [];
  const shapes: VsdShape[] = [];
  const connectors: VsdConnector[] = [];
  const root = /<(?:VisioDocument|visio)\b([^>]*)>/i.exec(xml);
  const rootName = attrs(root?.[1] || '').name || fileName.replace(/\.[^.]+$/, '') || 'Visio';
  const pageRe =
    /<(?:[\w.-]+:)?Page\b([^>]*?)\/>|<(?:[\w.-]+:)?Page\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?Page>/gi;
  let match: RegExpExecArray | null;
  let foundPage = false;
  while ((match = pageRe.exec(xml))) {
    foundPage = true;
    const a = attrs(match[1] || match[2] || '');
    const inner = match[3] || '';
    const page = upsertPage(pages, {
      id: a.ID || a.Id || a.id || a.NameU || a.Name || `page-${pages.length + 1}`,
      name: a.Name || a.NameU || a.name || `Page ${pages.length + 1}`,
      width: inchesToPx(num(tagText(inner, 'Width'), 11)),
      height: inchesToPx(num(tagText(inner, 'Height'), 8.5))
    });
    parsePageShapes(inner, page, shapes, connectors);
    for (const connMatch of inner.matchAll(/<(?:[\w.-]+:)?(?:connector|edge)\b([^>]*)\/?>/gi)) {
      const c = attrs(connMatch[1] || '');
      if (!c.source || !c.target) continue;
      const dup = connectors.some(
        (existing) => existing.pageId === page.id && existing.source === c.source && existing.target === c.target && existing.label === decodeLabel(c.label || c.value || '')
      );
      if (dup) continue;
      connectors.push({
        id: `${page.id}:${c.id || `e-${connectors.length + 1}`}`,
        index: connectors.length,
        pageId: page.id,
        pageName: page.name,
        source: c.source,
        target: c.target,
        sourceName: '',
        targetName: '',
        label: decodeLabel(c.label || c.value || '')
      });
    }
  }
  if (!foundPage && /<(?:PageContents|Shapes)\b/i.test(xml)) {
    const page = upsertPage(pages, { id: 'page-1', name: rootName });
    parsePageShapes(xml, page, shapes, connectors);
  }
  if (!pages.length) parseSimpleVisio(xml, pages, shapes, connectors);
  if (!pages.length) throw new Error('Visio XML contains no pages');
  return finishDataset(rootName, sourceKind, pages[0]?.name || rootName, pages, shapes, connectors, warnings);
}

function finishDataset(
  name: string,
  sourceKind: VsdSourceKind,
  title: string,
  pages: VsdPage[],
  shapes: VsdShape[],
  connectors: VsdConnector[],
  warnings: string[]
): VsdDataset {
  const labelById = new Map(shapes.map((s) => [s.id, s.label] as const));
  const labelByRaw = new Map<string, string>();
  for (const s of shapes) {
    const raw = s.id.includes(':') ? s.id.slice(s.id.indexOf(':') + 1) : s.id;
    labelByRaw.set(`${s.pageId}:${raw}`, s.label);
    labelByRaw.set(raw, s.label);
  }
  connectors.forEach((c, i) => {
    c.index = i;
    c.sourceName =
      labelById.get(c.source) ||
      labelById.get(`${c.pageId}:${c.source}`) ||
      labelByRaw.get(`${c.pageId}:${c.source}`) ||
      labelByRaw.get(c.source) ||
      c.source;
    c.targetName =
      labelById.get(c.target) ||
      labelById.get(`${c.pageId}:${c.target}`) ||
      labelByRaw.get(`${c.pageId}:${c.target}`) ||
      labelByRaw.get(c.target) ||
      c.target;
  });
  shapes.forEach((s, i) => {
    s.index = i;
  });
  pages.forEach((p, i) => {
    p.index = i;
    p.shapeCount = shapes.filter((s) => s.pageId === p.id).length;
    p.connectorCount = connectors.filter((c) => c.pageId === p.id).length;
  });
  if (!pages.length) warnings.push('Visio file contains no pages.');
  if (!shapes.length && pages.length) warnings.push('Visio file has pages but no shapes.');
  return { name, sourceKind, title: title || name, pages, shapes, connectors, warnings };
}

function parseJson(text: string, fileName: string): VsdDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid Visio JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Visio JSON must be an object');
  const pageRaw = (Array.isArray(obj.pages) ? obj.pages : [obj]) as unknown[];
  const pages: VsdPage[] = [];
  const shapes: VsdShape[] = [];
  const connectors: VsdConnector[] = [];
  pageRaw.forEach((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const page = upsertPage(pages, {
      id: asString(rec.id || rec.name, `page-${i + 1}`),
      name: asString(rec.name || rec.id, `Page ${i + 1}`),
      width: Number(rec.width) || 792,
      height: Number(rec.height) || 612
    });
    const shapeRaw = (Array.isArray(rec.shapes) ? rec.shapes : []) as unknown[];
    for (const shapeItem of shapeRaw) {
      const s = (shapeItem ?? {}) as Record<string, unknown>;
      const id = asString(s.id || s.label, `s-${shapes.length + 1}`);
      shapes.push({
        id: `${page.id}:${id}`,
        index: shapes.length,
        pageId: page.id,
        pageName: page.name,
        label: asString(s.label || s.value || id),
        master: asString(s.master),
        x: Number(s.x) || 0,
        y: Number(s.y) || 0,
        width: Number(s.width) || 120,
        height: Number(s.height) || 56
      });
    }
    const connRaw = (Array.isArray(rec.connectors) ? rec.connectors : Array.isArray(rec.connects) ? rec.connects : []) as unknown[];
    for (const connItem of connRaw) {
      const c = (connItem ?? {}) as Record<string, unknown>;
      const source = asString(c.source || c.from);
      const target = asString(c.target || c.to);
      if (!source || !target) continue;
      connectors.push({
        id: `${page.id}:${asString(c.id, `e-${connectors.length + 1}`)}`,
        index: connectors.length,
        pageId: page.id,
        pageName: page.name,
        source,
        target,
        sourceName: '',
        targetName: '',
        label: asString(c.label || c.value)
      });
    }
  });
  if (!pages.length) throw new Error('Visio JSON is missing pages');
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'Visio JSON'),
    'json',
    asString(obj.title || obj.name || pages[0]?.name),
    pages,
    shapes,
    connectors,
    []
  );
}

export function parseVisioText(text: string, fileName = ''): VsdDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Visio file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: VsdSourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : ext === 'vsdx' ? 'vsdx' : ext === 'xml' ? 'xml' : 'vdx';
  const source = extracted.source;
  if (looksLikeVisioXml(source) || /<(?:page|shape|connector)\b/i.test(source)) {
    const parsed = parseVisioXml(source, fileName, sourceKind);
    if (!parsed.pages.length) throw new Error('Visio file contains no pages');
    return parsed;
  }
  throw new Error('Not a Visio diagram');
}

export function parseVisioBytes(bytes: Uint8Array, fileName = ''): VsdDataset {
  if (!bytes.length) throw new Error('Visio file is empty');
  if (isVisioZip(bytes)) {
    const stored = extractStoredZipXml(bytes);
    if (stored.length) {
      const parsed = parseVisioText(stored.join('\n'), fileName.replace(/\.vsdx$/i, '.vdx') || 'visio.vdx');
      parsed.sourceKind = 'vsdx';
      parsed.warnings = [
        ...parsed.warnings,
        'VSDX zip contained uncompressed XML entries. Prefer exporting .vdx for full fidelity.'
      ];
      return parsed;
    }
    throw new Error('VSDX is a zip package — export uncompressed Visio XML (.vdx) from Visio or unzip visio/pages/*.xml.');
  }
  return parseVisioText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterVsdPages(pages: VsdPage[], query: string): VsdPage[] {
  const q = query.trim().toLowerCase();
  if (!q) return pages;
  const tokens = q.split(/\s+/).filter(Boolean);
  return pages.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('page:')) return p.name.toLowerCase().includes(token.slice(5)) || p.id.toLowerCase().includes(token.slice(5));
      return `${p.id} ${p.name}`.toLowerCase().includes(token);
    })
  );
}

export function filterVsdShapes(shapes: VsdShape[], query: string, pageId = ''): VsdShape[] {
  let list = pageId ? shapes.filter((s) => s.pageId === pageId) : shapes;
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('page:')) return s.pageName.toLowerCase().includes(token.slice(5)) || s.pageId.toLowerCase().includes(token.slice(5));
      if (token.startsWith('shape:') || token.startsWith('node:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return s.label.toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle);
      }
      return `${s.id} ${s.label} ${s.pageName} ${s.master}`.toLowerCase().includes(token);
    })
  );
}

export function filterVsdConnectors(connectors: VsdConnector[], query: string, pageId = ''): VsdConnector[] {
  let list = pageId ? connectors.filter((c) => c.pageId === pageId) : connectors;
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('page:')) return c.pageName.toLowerCase().includes(token.slice(5)) || c.pageId.toLowerCase().includes(token.slice(5));
      if (token.startsWith('from:')) return c.sourceName.toLowerCase().includes(token.slice(5)) || c.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return c.targetName.toLowerCase().includes(token.slice(3)) || c.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('rel:') || token.startsWith('label:')) return c.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      return `${c.source} ${c.target} ${c.sourceName} ${c.targetName} ${c.label} ${c.pageName}`.toLowerCase().includes(token);
    })
  );
}
