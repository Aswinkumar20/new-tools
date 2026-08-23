import type { KgDataset, KgEntity, KgLink, KgSourceKind } from '../types/knowledge-graph-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:knowledge-graph|knowledgegraph|kg|graph|entity|node|link|edge)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:json|xml|csv|kg|graph)?\s*([\s\S]*?)```/i.exec(text);
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

function upsertEntity(entities: KgEntity[], next: { id: string; name?: string; type?: string; label?: string }): KgEntity {
  const existing = entities.find((e) => e.id === next.id || e.name === next.name);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.type && next.type.toLowerCase() !== 'entity') existing.type = next.type;
    if (next.label) existing.label = next.label;
    return existing;
  }
  const created: KgEntity = {
    id: next.id,
    index: entities.length,
    name: next.name || next.id,
    type: next.type || 'Entity',
    label: next.label || '',
    x: 0,
    y: 0
  };
  entities.push(created);
  return created;
}

function addLink(links: KgLink[], source: string, target: string, rel: string, sourceName = '', targetName = ''): void {
  if (!source || !target) return;
  if (links.some((l) => l.source === source && l.target === target && l.rel === rel)) return;
  links.push({
    id: `l-${links.length + 1}`,
    index: links.length,
    source,
    target,
    sourceName: sourceName || source,
    targetName: targetName || target,
    rel: rel || 'related'
  });
}

function layoutEntities(entities: KgEntity[], links: KgLink[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const e of entities) {
    incoming.set(e.id, []);
    outgoing.set(e.id, []);
  }
  for (const l of links) {
    outgoing.get(l.source)?.push(l.target);
    incoming.get(l.target)?.push(l.source);
  }
  const rank = new Map<string, number>();
  const starts = entities.filter((e) => !(incoming.get(e.id)?.length)).map((e) => e.id);
  (starts.length ? starts : entities.slice(0, 1).map((e) => e.id)).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, KgEntity[]>();
  for (const e of entities) {
    const r = rank.get(e.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(e);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((e, i) => {
      e.x = 48 + r * 200;
      e.y = 40 + i * 100;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: KgSourceKind,
  title: string,
  entities: KgEntity[],
  links: KgLink[],
  warnings: string[]
): KgDataset {
  if (!entities.length) throw new Error('Knowledge graph contains no entities');
  const byId = new Map(entities.map((e) => [e.id, e.name]));
  const byName = new Map(entities.map((e) => [e.name.toLowerCase(), e.id]));
  for (const l of links) {
    if (!byId.has(l.source)) l.source = byName.get(l.source.toLowerCase()) || l.source;
    if (!byId.has(l.target)) l.target = byName.get(l.target.toLowerCase()) || l.target;
    l.sourceName = byId.get(l.source) || l.sourceName || l.source;
    l.targetName = byId.get(l.target) || l.targetName || l.target;
  }
  layoutEntities(entities, links);
  entities.forEach((e, i) => (e.index = i));
  links.forEach((l, i) => (l.index = i));
  return { name, sourceKind, title: title || name, entities, links, warnings };
}

function ingestEntityRow(entities: KgEntity[], row: Record<string, unknown>): void {
  const id = asString(row.id || row.name || row.label || row['@id']);
  if (!id) return;
  upsertEntity(entities, {
    id,
    name: asString(row.name || row.label || id),
    type: asString(row.type || row.kind || row.category || row.labelType, 'Entity'),
    label: asString(row.label || row.title || row.description)
  });
}

function ingestLinkRow(entities: KgEntity[], links: KgLink[], row: Record<string, unknown>): void {
  const source = asString(row.source || row.from || row.start || row.out || rec(row.startNode).id);
  const target = asString(row.target || row.to || row.end || row.in || rec(row.endNode).id);
  if (!source || !target) return;
  const rel = asString(row.rel || row.relation || row.type || row.label || row.predicate, 'related');
  upsertEntity(entities, { id: source, name: asString(row.sourceName || row.fromName, source), type: asString(row.sourceType) || undefined });
  upsertEntity(entities, { id: target, name: asString(row.targetName || row.toName, target), type: asString(row.targetType) || undefined });
  addLink(links, source, target, rel, asString(row.sourceName), asString(row.targetName));
}

function parseJson(raw: unknown, fileName: string): KgDataset {
  const root = rec(Array.isArray(raw) ? { entities: raw } : raw);
  const entities: KgEntity[] = [];
  const links: KgLink[] = [];
  const name = asString(root.name || root.title, fileName.replace(/\.[^.]+$/, '') || 'Knowledge graph');
  const entityList = Array.isArray(root.entities)
    ? root.entities
    : Array.isArray(root.nodes)
      ? root.nodes
      : Array.isArray(root.vertices)
        ? root.vertices
        : [];
  const linkList = Array.isArray(root.links)
    ? root.links
    : Array.isArray(root.edges)
      ? root.edges
      : Array.isArray(root.relationships)
        ? root.relationships
        : Array.isArray(root.relations)
          ? root.relations
          : [];
  for (const item of entityList) ingestEntityRow(entities, rec(item));
  for (const item of linkList) ingestLinkRow(entities, links, rec(item));
  if (!entities.length) throw new Error('Knowledge graph JSON contains no entities');
  return finishDataset(name, 'json', asString(root.title || root.name, name), entities, links, []);
}

function parseXml(xml: string, fileName: string): KgDataset {
  const root = /<(?:knowledge-graph|knowledgegraph|kg|graph)\b([^>]*)>/i.exec(xml);
  const name = attrs(root?.[1] || '').name || fileName.replace(/\.[^.]+$/, '') || 'Knowledge graph';
  const entities: KgEntity[] = [];
  const links: KgLink[] = [];
  const entityRe =
    /<(?:[\w.-]+:)?(?:entity|node|vertex)\b([^>]*?)\/>|<(?:[\w.-]+:)?(?:entity|node|vertex)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:entity|node|vertex)>/gi;
  let match: RegExpExecArray | null;
  while ((match = entityRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const id = a.id || a.name || '';
    if (!id) continue;
    upsertEntity(entities, { id, name: a.name || a.label || id, type: a.type || a.kind || 'Entity', label: a.label || '' });
  }
  const linkRe =
    /<(?:[\w.-]+:)?(?:link|edge|rel|relationship)\b([^>]*?)\/>|<(?:[\w.-]+:)?(?:link|edge|rel|relationship)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:link|edge|rel|relationship)>/gi;
  while ((match = linkRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    if (!a.source && !a.from) continue;
    if (!a.target && !a.to) continue;
    const source = a.source || a.from;
    const target = a.target || a.to;
    upsertEntity(entities, { id: source, name: source });
    upsertEntity(entities, { id: target, name: target });
    addLink(links, source, target, a.rel || a.relation || a.type || a.label || 'related');
  }
  if (!entities.length) throw new Error('Knowledge graph XML contains no entities');
  return finishDataset(name, 'xml', name, entities, links, []);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') inQ = false;
      else cur += ch;
      continue;
    }
    if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text: string, fileName: string): KgDataset {
  const entities: KgEntity[] = [];
  const links: KgLink[] = [];
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const ingestTable = (block: string): void => {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (lines.length < 2) return;
    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const idx = (name: string): number => header.indexOf(name);
    const isLink =
      idx('source') >= 0 || idx('from') >= 0 || (idx('target') >= 0 && idx('id') < 0) || header.includes('rel');
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);
      const get = (name: string, fallback = ''): string => {
        const i = idx(name);
        return i >= 0 ? cols[i] || fallback : fallback;
      };
      if (isLink) {
        const source = get('source') || get('from');
        const target = get('target') || get('to');
        if (!source || !target) continue;
        upsertEntity(entities, { id: source, name: get('sourcename', source), type: get('sourcetype') || undefined });
        upsertEntity(entities, { id: target, name: get('targetname', target), type: get('targettype') || undefined });
        addLink(links, source, target, get('rel') || get('relation') || get('type') || get('label') || 'related');
      } else {
        const id = get('id') || get('name');
        if (!id) continue;
        upsertEntity(entities, { id, name: get('name', id), type: get('type') || get('kind') || 'Entity', label: get('label') });
      }
    }
  };
  if (blocks.length) blocks.forEach(ingestTable);
  else ingestTable(text);
  if (!entities.length) throw new Error('Knowledge graph CSV contains no entities');
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Knowledge graph';
  return finishDataset(fromFile, 'csv', fromFile, entities, links, []);
}

function parseEdgeList(text: string, fileName: string, sourceKind: KgSourceKind): KgDataset {
  const entities: KgEntity[] = [];
  const links: KgLink[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) continue;
    const typed = /^(\S+)\s*:\s*(\S+)$/.exec(trimmed);
    if (typed && !/->/.test(trimmed)) {
      upsertEntity(entities, { id: typed[1], name: typed[1], type: typed[2] });
      continue;
    }
    const arrow = /^(\S+)\s+--+([^>\s]+)--*>\s+(\S+)$/.exec(trimmed) || /^(\S+)\s+->\s+(\S+)$/.exec(trimmed);
    if (arrow) {
      const source = arrow[1];
      const rel = arrow.length === 4 ? arrow[2] : 'related';
      const target = arrow.length === 4 ? arrow[3] : arrow[2];
      upsertEntity(entities, { id: source, name: source });
      upsertEntity(entities, { id: target, name: target });
      addLink(links, source, target, rel);
    }
  }
  if (!entities.length) throw new Error('Knowledge graph contains no entities');
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Knowledge graph';
  return finishDataset(fromFile, sourceKind, fromFile, entities, links, []);
}

export function parseKnowledgeGraphText(text: string, fileName = ''): KgDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Knowledge graph file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid knowledge graph JSON');
    }
    return parseJson(parsed, fileName);
  }
  if (looksLikeXml(raw) || ext === 'xml') return parseXml(raw, fileName);
  if (ext === 'csv' || /^[\w.-]+,[\w.-]+/m.test(raw)) {
    try {
      return parseCsv(raw, fileName);
    } catch {
      /* fall through to edge list */
    }
  }
  const extracted = extractFence(raw);
  const sourceKind: KgSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : 'csv';
  if (/->|--/.test(extracted.source) || /:\s*\S+/.test(extracted.source)) {
    return parseEdgeList(extracted.source, fileName, sourceKind);
  }
  throw new Error('Not a knowledge graph');
}

export function parseKnowledgeGraphBytes(bytes: Uint8Array, fileName = ''): KgDataset {
  if (!bytes.length) throw new Error('Knowledge graph file is empty');
  return parseKnowledgeGraphText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterKgEntities(entities: KgEntity[], query: string): KgEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return entities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return entities.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('entity:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return e.name.toLowerCase().includes(needle) || e.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) return e.type.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      return `${e.id} ${e.name} ${e.type} ${e.label}`.toLowerCase().includes(token);
    })
  );
}

export function filterKgLinks(links: KgLink[], query: string): KgLink[] {
  const q = query.trim().toLowerCase();
  if (!q) return links;
  const tokens = q.split(/\s+/).filter(Boolean);
  return links.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('from:')) return l.sourceName.toLowerCase().includes(token.slice(5)) || l.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return l.targetName.toLowerCase().includes(token.slice(3)) || l.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('rel:') || token.startsWith('kind:')) return l.rel.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      return `${l.source} ${l.target} ${l.sourceName} ${l.targetName} ${l.rel}`.toLowerCase().includes(token);
    })
  );
}
