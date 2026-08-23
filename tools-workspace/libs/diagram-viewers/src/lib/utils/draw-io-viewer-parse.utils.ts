import type {
  DioConnector,
  DioDataset,
  DioPage,
  DioShape,
  DioSourceKind
} from '../types/draw-io-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeDrawioXml(text: string): boolean {
  return /<(?:mxfile|mxGraphModel|diagram|drawio|mxCell)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:drawio|dio|xml|svg)?\s*([\s\S]*?)```/i.exec(text);
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

function isCompressedPayload(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  if (/<mxGraphModel\b/i.test(t) || /<root\b/i.test(t) || /<mxCell\b/i.test(t)) return false;
  return /^[A-Za-z0-9+/=\s]+$/.test(t) && t.replace(/\s+/g, '').length > 40;
}

function extractGeometry(inner: string, a: Record<string, string>): { x: number; y: number; width: number; height: number } {
  const geo = /<mxGeometry\b([^>]*)\/?>/i.exec(inner);
  const g = geo ? attrs(geo[1] || '') : {};
  return {
    x: num(g.x || a.x),
    y: num(g.y || a.y),
    width: num(g.width || a.width, 80),
    height: num(g.height || a.height, 40)
  };
}

function parseMxCells(
  xml: string,
  page: DioPage,
  shapes: DioShape[],
  connectors: DioConnector[]
): void {
  const cellRe =
    /<(?:[\w.-]+:)?mxCell\b([^>]*?)\/>|<(?:[\w.-]+:)?mxCell\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?mxCell>/gi;
  let match: RegExpExecArray | null;
  while ((match = cellRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const inner = match[3] || '';
    const id = a.id || '';
    if (!id || id === '0' || id === '1') continue;
    const label = decodeLabel(a.value || a.label || '');
    if (a.edge === '1' || /edge=/i.test(match[0]) && a.source && a.target) {
      connectors.push({
        id: `${page.id}:${id}`,
        index: connectors.length,
        pageId: page.id,
        pageName: page.name,
        source: a.source || '',
        target: a.target || '',
        sourceName: '',
        targetName: '',
        label
      });
      continue;
    }
    if (a.vertex === '1' || a.vertex === 'true' || inner.includes('<mxGeometry')) {
      const geo = extractGeometry(inner, a);
      shapes.push({
        id: `${page.id}:${id}`,
        index: shapes.length,
        pageId: page.id,
        pageName: page.name,
        label: label || id,
        style: a.style || '',
        x: geo.x,
        y: geo.y,
        width: geo.width,
        height: geo.height
      });
    }
  }
}

function finishDataset(
  name: string,
  sourceKind: DioSourceKind,
  title: string,
  pages: DioPage[],
  shapes: DioShape[],
  connectors: DioConnector[],
  warnings: string[]
): DioDataset {
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
  if (!pages.length) warnings.push('Draw.io file contains no pages.');
  if (!shapes.length && pages.length) warnings.push('Draw.io file has pages but no shapes.');
  return { name, sourceKind, title: title || name, pages, shapes, connectors, warnings };
}

function parseMxFile(xml: string, fileName: string, sourceKind: DioSourceKind): DioDataset {
  const warnings: string[] = [];
  const pages: DioPage[] = [];
  const shapes: DioShape[] = [];
  const connectors: DioConnector[] = [];
  const root = /<mxfile\b([^>]*)>/i.exec(xml);
  const rootName = attrs(root?.[1] || '').name || fileName.replace(/\.[^.]+$/, '') || 'Draw.io';
  const diagramRe = /<diagram\b([^>]*)>([\s\S]*?)<\/diagram>/gi;
  let match: RegExpExecArray | null;
  let found = false;
  while ((match = diagramRe.exec(xml))) {
    found = true;
    const a = attrs(match[1] || '');
    const body = match[2] || '';
    const page: DioPage = {
      id: a.id || a.name || `page-${pages.length + 1}`,
      index: pages.length,
      name: a.name || a.id || `Page ${pages.length + 1}`,
      width: 827,
      height: 1169,
      shapeCount: 0,
      connectorCount: 0
    };
    const model = /<mxGraphModel\b([^>]*)>/i.exec(body);
    if (model) {
      const ma = attrs(model[1] || '');
      page.width = num(ma.pageWidth, page.width);
      page.height = num(ma.pageHeight, page.height);
    }
    pages.push(page);
    if (isCompressedPayload(body)) {
      warnings.push(`Page "${page.name}" is compressed — export uncompressed XML from diagrams.net.`);
      continue;
    }
    parseMxCells(body, page, shapes, connectors);
  }
  if (!found && /<mxGraphModel\b/i.test(xml)) {
    const page: DioPage = {
      id: 'page-1',
      index: 0,
      name: rootName,
      width: 827,
      height: 1169,
      shapeCount: 0,
      connectorCount: 0
    };
    const model = /<mxGraphModel\b([^>]*)>/i.exec(xml);
    if (model) {
      const ma = attrs(model[1] || '');
      page.width = num(ma.pageWidth, page.width);
      page.height = num(ma.pageHeight, page.height);
    }
    pages.push(page);
    parseMxCells(xml, page, shapes, connectors);
  }
  if (!found && !pages.length) {
    const simpleRe = /<page\b([^>]*)>([\s\S]*?)<\/page>/gi;
    while ((match = simpleRe.exec(xml))) {
      const a = attrs(match[1] || '');
      const page: DioPage = {
        id: a.id || a.name || `page-${pages.length + 1}`,
        index: pages.length,
        name: a.name || a.id || `Page ${pages.length + 1}`,
        width: num(a.width, 827),
        height: num(a.height, 1169),
        shapeCount: 0,
        connectorCount: 0
      };
      pages.push(page);
      for (const shapeMatch of (match[2] || '').matchAll(/<(?:[\w.-]+:)?(?:shape|mxCell)\b([^>]*)\/?>/gi)) {
        const s = attrs(shapeMatch[1] || '');
        if (s.edge === '1' || s.source || s.target) continue;
        if (!s.id && !s.label && !s.value) continue;
        shapes.push({
          id: `${page.id}:${s.id || s.label || `s-${shapes.length + 1}`}`,
          index: shapes.length,
          pageId: page.id,
          pageName: page.name,
          label: decodeLabel(s.label || s.value || s.id || ''),
          style: s.style || '',
          x: num(s.x),
          y: num(s.y),
          width: num(s.width, 80),
          height: num(s.height, 40)
        });
      }
      for (const connMatch of (match[2] || '').matchAll(/<(?:[\w.-]+:)?(?:connector|edge)\b([^>]*)\/?>/gi)) {
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
  const title = pages[0]?.name || rootName;
  if (!pages.length) throw new Error('Draw.io XML contains no pages');
  return finishDataset(rootName, sourceKind, title, pages, shapes, connectors, warnings);
}

function parseJson(text: string, fileName: string): DioDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid draw.io JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Draw.io JSON must be an object');
  const pageRaw = (Array.isArray(obj.pages) ? obj.pages : [obj]) as unknown[];
  const pages: DioPage[] = [];
  const shapes: DioShape[] = [];
  const connectors: DioConnector[] = [];
  pageRaw.forEach((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const page: DioPage = {
      id: asString(rec.id || rec.name, `page-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.id, `Page ${i + 1}`),
      width: Number(rec.width) || 827,
      height: Number(rec.height) || 1169,
      shapeCount: 0,
      connectorCount: 0
    };
    pages.push(page);
    const shapeRaw = (Array.isArray(rec.shapes) ? rec.shapes : Array.isArray(rec.cells) ? rec.cells : []) as unknown[];
    for (const shapeItem of shapeRaw) {
      const s = (shapeItem ?? {}) as Record<string, unknown>;
      const id = asString(s.id || s.label, `s-${shapes.length + 1}`);
      shapes.push({
        id: `${page.id}:${id}`,
        index: shapes.length,
        pageId: page.id,
        pageName: page.name,
        label: asString(s.label || s.value || id),
        style: asString(s.style),
        x: Number(s.x) || 0,
        y: Number(s.y) || 0,
        width: Number(s.width) || 80,
        height: Number(s.height) || 40
      });
    }
    const connRaw = (Array.isArray(rec.connectors) ? rec.connectors : Array.isArray(rec.edges) ? rec.edges : []) as unknown[];
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
  if (!pages.length) throw new Error('Draw.io JSON is missing pages');
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'Draw.io JSON'),
    'json',
    asString(obj.title || obj.name || pages[0]?.name),
    pages,
    shapes,
    connectors,
    []
  );
}

export function parseDrawioText(text: string, fileName = ''): DioDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Draw.io file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: DioSourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'svg' ? 'svg' : ext === 'txt' ? 'txt' : ext === 'xml' ? 'xml' : 'drawio';
  const source = extracted.source;
  if (looksLikeDrawioXml(source) || /<drawio\b/i.test(source) || /<page\b/i.test(source)) {
    const parsed = parseMxFile(source, fileName, sourceKind);
    if (!parsed.pages.length) throw new Error('Draw.io file contains no pages');
    return parsed;
  }
  throw new Error('Not a draw.io diagram');
}

export function parseDrawioBytes(bytes: Uint8Array, fileName = ''): DioDataset {
  if (!bytes.length) throw new Error('Draw.io file is empty');
  return parseDrawioText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterDioPages(pages: DioPage[], query: string): DioPage[] {
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

export function filterDioShapes(shapes: DioShape[], query: string, pageId = ''): DioShape[] {
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
      return `${s.id} ${s.label} ${s.pageName} ${s.style}`.toLowerCase().includes(token);
    })
  );
}

export function filterDioConnectors(connectors: DioConnector[], query: string, pageId = ''): DioConnector[] {
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
