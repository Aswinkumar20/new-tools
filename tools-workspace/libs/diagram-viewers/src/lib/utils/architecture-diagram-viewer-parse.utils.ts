import type {
  ArchBox,
  ArchBoxKind,
  ArchConnector,
  ArchConnectorStyle,
  ArchDataset,
  ArchSourceKind
} from '../types/architecture-diagram-viewer.types';

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

function looksLikeXml(text: string): boolean {
  return /<(?:architecture|boxes|box|connector)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:uml|plantuml|puml|mermaid|arch(?:itecture)?)?\s*([\s\S]*?)```/i.exec(text);
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

function kindFromKeyword(raw: string): ArchBoxKind {
  const v = raw.trim().toLowerCase();
  if (v === 'database' || v === 'storage' || v === 'disk') return 'database';
  if (v === 'cloud') return 'cloud';
  if (v === 'queue' || v === 'queueing') return 'queue';
  if (v === 'package' || v === 'folder' || v === 'frame') return 'package';
  if (v === 'node' || v === 'server') return 'node';
  if (v === 'component' || v === 'service') return 'service';
  if (v === 'rectangle' || v === 'app') return 'app';
  return 'other';
}

function kindFromName(raw: string): ArchBoxKind {
  const v = raw.trim().toLowerCase();
  if (v === 'app' || v === 'service' || v === 'database' || v === 'cloud' || v === 'queue' || v === 'package' || v === 'node') return v;
  return kindFromKeyword(v);
}

function styleFromOp(op: string): ArchConnectorStyle {
  if (op.includes('..')) return 'depend';
  if (op === '==>' || op === '===') return 'sync';
  return 'call';
}

function styleFromName(raw: string): ArchConnectorStyle {
  const v = raw.trim().toLowerCase();
  if (v === 'data' || v === 'depend' || v === 'sync' || v === 'call') return v;
  return 'call';
}

function upsertBox(boxes: ArchBox[], next: { id: string; name: string; kind: ArchBoxKind; stereotype?: string }): ArchBox {
  const existing = boxes.find((b) => b.id === next.id);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind !== 'other') existing.kind = next.kind;
    if (next.stereotype) existing.stereotype = next.stereotype;
    return existing;
  }
  const created: ArchBox = {
    id: next.id,
    index: boxes.length,
    name: next.name,
    kind: next.kind,
    stereotype: next.stereotype || '',
    x: 0,
    y: 0
  };
  boxes.push(created);
  return created;
}

function boxToken(token: string): { id: string; name: string } {
  const cleaned = token.trim();
  const pumlBox = /^\[([^\]]+)\]$/.exec(cleaned);
  if (pumlBox) return { id: unquote(pumlBox[1]).replace(/\s+/g, ''), name: unquote(pumlBox[1]) };
  const cyl = /^([A-Za-z][\w-]*)\[\(([^)]+)\)\]$/.exec(cleaned);
  if (cyl) return { id: cyl[1], name: cyl[2] };
  const stadium = /^([A-Za-z][\w-]*)\(\[([^\]]+)\]\)$/.exec(cleaned);
  if (stadium) return { id: stadium[1], name: stadium[2] };
  const rect = /^([A-Za-z][\w-]*)\[([^\]]+)\]$/.exec(cleaned);
  if (rect) return { id: rect[1], name: rect[2] };
  const round = /^([A-Za-z][\w-]*)\(([^)]+)\)$/.exec(cleaned);
  if (round) return { id: round[1], name: round[2] };
  const idOnly = /^([A-Za-z][\w-]*)$/.exec(cleaned);
  if (idOnly) return { id: idOnly[1], name: idOnly[1] };
  const id = unquote(cleaned.replace(/\s+/g, ' '));
  return { id, name: id };
}

const REL_OPS = ['..>', '<..', '-->', '<--', '==>', '---', '--', '..'];

function parseConnectorLine(line: string): { left: string; right: string; op: string; label: string } | null {
  const rels = [...REL_OPS].sort((a, b) => b.length - a.length);
  const labeled = /^(.*?)\s*:\s*(.+)$/.exec(line);
  const main = labeled && rels.some((op) => labeled[1].includes(op)) ? labeled[1].trim() : line;
  const label = labeled && rels.some((op) => labeled[1].includes(op)) ? labeled[2].trim() : '';
  for (const op of rels) {
    const padded = ` ${op} `;
    const idx = main.indexOf(padded);
    if (idx < 0) continue;
    const left = main.slice(0, idx).trim();
    const right = main.slice(idx + padded.length).trim();
    if (!left || !right) continue;
    return { left, right, op, label };
  }
  return null;
}

function layoutBoxes(boxes: ArchBox[], connectors: ArchConnector[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const b of boxes) {
    incoming.set(b.id, []);
    outgoing.set(b.id, []);
  }
  for (const c of connectors) {
    outgoing.get(c.source)?.push(c.target);
    incoming.get(c.target)?.push(c.source);
  }
  const rank = new Map<string, number>();
  const starts = boxes.filter((b) => !(incoming.get(b.id)?.length)).map((b) => b.id);
  (starts.length ? starts : boxes.slice(0, 1).map((b) => b.id)).forEach((id) => rank.set(id, 0));
  const queue = [...rank.keys()];
  while (queue.length) {
    const id = queue.shift() as string;
    const r = rank.get(id) ?? 0;
    for (const next of outgoing.get(id) ?? []) {
      if (!rank.has(next)) {
        rank.set(next, r + 1);
        queue.push(next);
      }
    }
  }
  const buckets = new Map<number, ArchBox[]>();
  for (const b of boxes) {
    const r = rank.get(b.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(b);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((b, i) => {
      b.x = 56 + r * 170;
      b.y = 48 + i * 100;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: ArchSourceKind,
  title: string,
  boxes: ArchBox[],
  connectors: ArchConnector[],
  warnings: string[]
): ArchDataset {
  const nameById = new Map(boxes.map((b) => [b.id, b.name] as const));
  connectors.forEach((c, i) => {
    c.index = i;
    c.sourceName = nameById.get(c.source) || c.source;
    c.targetName = nameById.get(c.target) || c.target;
  });
  boxes.forEach((b, i) => {
    b.index = i;
  });
  layoutBoxes(boxes, connectors);
  if (!boxes.length) warnings.push('Architecture diagram contains no boxes.');
  if (!connectors.length && boxes.length) warnings.push('Architecture diagram has boxes but no connectors.');
  return { name, sourceKind, title: title || name, boxes, connectors, warnings };
}

function parseXml(xml: string, fileName: string): ArchDataset {
  const root = /<architecture\b([^>]*)>/i.exec(xml);
  const name = attrs(root?.[1] || '').name || fileName.replace(/\.[^.]+$/, '') || 'Architecture';
  const boxes: ArchBox[] = [];
  const connectors: ArchConnector[] = [];
  for (const m of xml.matchAll(/<box\b([^>]*)\/?>/gi)) {
    const a = attrs(m[1] || '');
    const id = a.id || a.name || `b-${boxes.length + 1}`;
    upsertBox(boxes, { id, name: a.name || id, kind: kindFromName(a.kind || ''), stereotype: a.stereotype || '' });
  }
  for (const m of xml.matchAll(/<connector\b([^>]*)\/?>/gi)) {
    const a = attrs(m[1] || '');
    const source = a.source || a.from || '';
    const target = a.target || a.to || '';
    if (!source || !target) continue;
    upsertBox(boxes, { id: source, name: source, kind: 'other' });
    upsertBox(boxes, { id: target, name: target, kind: 'other' });
    connectors.push({
      id: `c-${connectors.length + 1}`,
      index: connectors.length,
      source,
      target,
      sourceName: '',
      targetName: '',
      label: a.label || a.name || '',
      style: styleFromName(a.style || '')
    });
  }
  if (!boxes.length) throw new Error('Architecture XML contains no boxes');
  return finishDataset(name, 'xml', name, boxes, connectors, []);
}

function parseJson(text: string, fileName: string): ArchDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid architecture JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Architecture JSON must be an object');
  const boxRaw = (Array.isArray(obj.boxes) ? obj.boxes : Array.isArray(obj.nodes) ? obj.nodes : []) as unknown[];
  if (!boxRaw.length) throw new Error('Architecture JSON is missing boxes');
  const boxes: ArchBox[] = boxRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `b-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.label, asString(rec.id, `b-${i + 1}`)),
      kind: kindFromName(asString(rec.kind || rec.type)),
      stereotype: asString(rec.stereotype),
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const connRaw = (Array.isArray(obj.connectors) ? obj.connectors : Array.isArray(obj.edges) ? obj.edges : Array.isArray(obj.links) ? obj.links : []) as unknown[];
  const connectors: ArchConnector[] = connRaw
    .map((item, i) => {
      const rec = (item ?? {}) as Record<string, unknown>;
      return {
        id: asString(rec.id, `c-${i + 1}`),
        index: i,
        source: asString(rec.source || rec.from),
        target: asString(rec.target || rec.to),
        sourceName: '',
        targetName: '',
        label: asString(rec.label),
        style: styleFromName(asString(rec.style))
      };
    })
    .filter((c) => c.source && c.target);
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'Architecture JSON'),
    'json',
    asString(obj.title),
    boxes,
    connectors,
    []
  );
}

function parseMermaidFlow(source: string, fileName: string, sourceKind: ArchSourceKind): ArchDataset {
  const warnings: string[] = [];
  const lines = source.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
  const boxes: ArchBox[] = [];
  const connectors: ArchConnector[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const flow = /^(.+?)\s*(-\.->|==>|-->|---)\s*(?:\|([^|]+)\|\s*)?(.+)$/.exec(line);
    if (!flow) {
      warnings.push(`Skipped line: ${line}`);
      continue;
    }
    const left = boxToken(flow[1]);
    const right = boxToken(flow[4]);
    const leftKind: ArchBoxKind = /\[\([^)]+\)\]/.test(flow[1]) ? 'database' : 'app';
    const rightKind: ArchBoxKind = /\[\([^)]+\)\]/.test(flow[4]) ? 'database' : 'app';
    upsertBox(boxes, { id: left.id, name: left.name, kind: leftKind });
    upsertBox(boxes, { id: right.id, name: right.name, kind: rightKind });
    connectors.push({
      id: `c-${connectors.length + 1}`,
      index: connectors.length,
      source: left.id,
      target: right.id,
      sourceName: '',
      targetName: '',
      label: (flow[3] || '').trim(),
      style: flow[2] === '-.->' ? 'depend' : flow[2] === '==>' ? 'sync' : 'call'
    });
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'Architecture';
  return finishDataset(name, sourceKind, name, boxes, connectors, warnings);
}

function parsePlantLike(source: string, fileName: string, sourceKind: ArchSourceKind): ArchDataset {
  const warnings: string[] = [];
  let title = '';
  const lines = source
    .replace(/\/'[\s\S]*?'\//g, '\n')
    .split(/\r?\n/)
    .map((l) => l.replace(/'.*$/, '').trim())
    .filter((l) => l && !/^@(start|end)uml\b/i.test(l) && !/^skinparam\b|^hide\b|^show\b|^!include\b/i.test(l));
  const boxes: ArchBox[] = [];
  const connectors: ArchConnector[] = [];
  for (const line of lines) {
    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      title = unquote(titleMatch[1]);
      continue;
    }
    const decl =
      /^(rectangle|component|database|cloud|queue|node|package|folder|frame|storage)\s+(?:"([^"]+)"|(\S+))(?:\s+as\s+(\S+))?$/i.exec(
        line
      );
    if (decl) {
      const name = decl[2] || unquote(decl[3]);
      const id = decl[4] ? unquote(decl[4]) : name.replace(/\s+/g, '');
      upsertBox(boxes, { id, name, kind: kindFromKeyword(decl[1]) });
      continue;
    }
    const bracket = /^\[([^\]]+)\](?:\s+as\s+(\S+))?$/.exec(line);
    if (bracket) {
      const name = bracket[1];
      const id = bracket[2] ? unquote(bracket[2]) : name.replace(/\s+/g, '');
      upsertBox(boxes, { id, name, kind: 'service' });
      continue;
    }
    const rel = parseConnectorLine(line);
    if (rel) {
      const left = boxToken(rel.left);
      const right = boxToken(rel.right);
      upsertBox(boxes, { id: left.id, name: left.name, kind: 'other' });
      upsertBox(boxes, { id: right.id, name: right.name, kind: 'other' });
      connectors.push({
        id: `c-${connectors.length + 1}`,
        index: connectors.length,
        source: left.id,
        target: right.id,
        sourceName: '',
        targetName: '',
        label: rel.label,
        style: rel.label.toLowerCase() === 'sql' || /db|data/i.test(rel.label) ? 'data' : styleFromOp(rel.op)
      });
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
  }
  const fallback = title || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Architecture diagram';
  return finishDataset(fallback, sourceKind, title, boxes, connectors, warnings);
}

export function parseArchitectureText(text: string, fileName = ''): ArchDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Architecture file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  if (looksLikeXml(raw) || (ext === 'xml' && looksLikeXml(raw))) return parseXml(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: ArchSourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'mmd' || /^flowchart\b/i.test(extracted.source) ? 'mermaid' : ext === 'txt' ? 'txt' : 'puml';
  if (/^flowchart\b/i.test(extracted.source)) {
    const parsed = parseMermaidFlow(extracted.source, fileName, sourceKind);
    if (!parsed.boxes.length) throw new Error('Architecture diagram contains no boxes');
    return parsed;
  }
  if (
    /@startuml\b/i.test(extracted.source) ||
    /\b(rectangle|component|database|cloud|queue|node|package)\b/i.test(extracted.source) ||
    /\[[^\]]+\]/.test(extracted.source)
  ) {
    if (/\b(actor|participant)\b/i.test(extracted.source) && !/\b(rectangle|component|database)\b/i.test(extracted.source)) {
      throw new Error('Not an architecture diagram');
    }
    const parsed = parsePlantLike(extracted.source, fileName, sourceKind);
    if (!parsed.boxes.length) throw new Error('Architecture diagram contains no boxes');
    return parsed;
  }
  throw new Error('Not an architecture diagram');
}

export function parseArchitectureBytes(bytes: Uint8Array, fileName = ''): ArchDataset {
  if (!bytes.length) throw new Error('Architecture file is empty');
  return parseArchitectureText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterArchBoxes(boxes: ArchBox[], query: string, kind: 'all' | ArchBoxKind = 'all'): ArchBox[] {
  let list = kind === 'all' ? boxes : boxes.filter((b) => b.kind === kind);
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((b) =>
    tokens.every((token) => {
      if (token.startsWith('kind:')) return b.kind === token.slice(5);
      if (token.startsWith('box:') || token.startsWith('node:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return b.name.toLowerCase().includes(needle) || b.id.toLowerCase().includes(needle);
      }
      return `${b.id} ${b.name} ${b.kind} ${b.stereotype}`.toLowerCase().includes(token);
    })
  );
}

export function filterArchConnectors(connectors: ArchConnector[], query: string): ArchConnector[] {
  const q = query.trim().toLowerCase();
  if (!q) return connectors;
  const tokens = q.split(/\s+/).filter(Boolean);
  return connectors.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('rel:') || token.startsWith('label:')) return c.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return c.sourceName.toLowerCase().includes(token.slice(5)) || c.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return c.targetName.toLowerCase().includes(token.slice(3)) || c.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('style:')) return c.style === token.slice(6);
      return `${c.source} ${c.target} ${c.sourceName} ${c.targetName} ${c.label} ${c.style}`.toLowerCase().includes(token);
    })
  );
}
