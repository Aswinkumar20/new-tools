import type {
  UmlDataset,
  UmlKind,
  UmlLink,
  UmlLinkKind,
  UmlLinkStyle,
  UmlNode,
  UmlNodeKind,
  UmlSourceKind
} from '../types/uml-viewer.types';

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

function looksLikeXmi(text: string): boolean {
  return /<(?:[\w.-]+:)?(XMI|Model|packagedElement)\b/i.test(text) && /uml|xmi/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:uml|plantuml|puml|mermaid)?\s*([\s\S]*?)```/i.exec(text);
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

function upsertNode(nodes: UmlNode[], next: { id: string; name: string; kind: UmlNodeKind; members?: string[] }): UmlNode {
  const existing = nodes.find((n) => n.id === next.id);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind !== 'other') existing.kind = next.kind;
    if (next.members?.length) existing.members = [...existing.members, ...next.members];
    return existing;
  }
  const created: UmlNode = {
    id: next.id,
    index: nodes.length,
    name: next.name,
    kind: next.kind,
    members: next.members ? [...next.members] : [],
    x: 0,
    y: 0
  };
  nodes.push(created);
  return created;
}

const REL_OPS: Array<{ op: string; style: UmlLinkStyle }> = [
  { op: '<|--', style: 'inherit' },
  { op: '--|>', style: 'inherit' },
  { op: '<|..', style: 'realize' },
  { op: '..|>', style: 'realize' },
  { op: '*--', style: 'compose' },
  { op: '--*', style: 'compose' },
  { op: '<..', style: 'depend' },
  { op: '..>', style: 'depend' },
  { op: '-->', style: 'assoc' },
  { op: '<--', style: 'assoc' },
  { op: '..', style: 'depend' },
  { op: '--', style: 'assoc' }
];

function parseClassRel(line: string): { left: string; right: string; op: string; style: UmlLinkStyle; label: string } | null {
  const rels = [...REL_OPS].sort((a, b) => b.op.length - a.op.length);
  const labeled = /^(.*?)\s*:\s*(.+)$/.exec(line);
  const main = labeled && rels.some((r) => labeled[1].includes(r.op)) ? labeled[1].trim() : line;
  const label = labeled && rels.some((r) => labeled[1].includes(r.op)) ? labeled[2].trim() : '';
  for (const rel of rels) {
    const padded = ` ${rel.op} `;
    const idx = main.indexOf(padded);
    if (idx < 0) continue;
    const left = main.slice(0, idx).trim();
    const right = main.slice(idx + padded.length).trim();
    if (!left || !right) continue;
    return { left, right, op: rel.op, style: rel.style, label };
  }
  return null;
}

function idFromToken(token: string): string {
  const cleaned = token.trim();
  const card = /^"([^"]*)"\s+(.+)$/.exec(cleaned) || /^(.+?)\s+"([^"]*)"$/.exec(cleaned);
  if (card && cleaned.startsWith('"') && /^"([^"]*)"\s+/.test(cleaned)) return unquote(card[2]);
  if (card && /"([^"]*)"$/.test(cleaned) && !cleaned.startsWith('"')) return unquote(card[1]);
  return unquote(cleaned.replace(/\s+/g, ' '));
}

function flipRel(op: string): boolean {
  return op.startsWith('<') || op.endsWith('--*') || op === '<--';
}

function isSequenceMessage(left: string, arrow: string, right: string, nodes: UmlNode[]): boolean {
  if (arrow === '->>' || arrow === '-->>' || arrow === '->') return true;
  const seq = (kind: UmlNodeKind | undefined) => kind === 'actor' || kind === 'participant';
  const cls = (kind: UmlNodeKind | undefined) => kind === 'class' || kind === 'interface' || kind === 'enum';
  const leftKind = nodes.find((n) => n.id === left)?.kind;
  const rightKind = nodes.find((n) => n.id === right)?.kind;
  if (seq(leftKind) || seq(rightKind)) return true;
  if (cls(leftKind) || cls(rightKind)) return false;
  if (nodes.some((n) => seq(n.kind)) && !nodes.some((n) => cls(n.kind))) return true;
  return false;
}

function layoutClass(nodes: UmlNode[], links: UmlLink[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const l of links.filter((x) => x.linkKind === 'relation')) {
    outgoing.get(l.source)?.push(l.target);
    incoming.get(l.target)?.push(l.source);
  }
  const rank = new Map<string, number>();
  const starts = nodes.filter((n) => n.kind !== 'actor' && n.kind !== 'participant' && !(incoming.get(n.id)?.length)).map((n) => n.id);
  (starts.length ? starts : nodes.filter((n) => n.kind !== 'actor' && n.kind !== 'participant').slice(0, 1).map((n) => n.id)).forEach((id) =>
    rank.set(id, 0)
  );
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
  const buckets = new Map<number, UmlNode[]>();
  for (const n of nodes.filter((x) => x.kind !== 'actor' && x.kind !== 'participant')) {
    const r = rank.get(n.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(n);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((n, i) => {
      n.x = 56 + r * 160;
      n.y = 48 + i * 92;
    });
  }
  nodes
    .filter((n) => n.kind === 'actor' || n.kind === 'participant')
    .forEach((n, i) => {
      n.x = 70 + i * 150;
      n.y = 36;
    });
}

function finishDataset(
  name: string,
  sourceKind: UmlSourceKind,
  title: string,
  nodes: UmlNode[],
  links: UmlLink[],
  warnings: string[]
): UmlDataset {
  const nameById = new Map(nodes.map((n) => [n.id, n.name] as const));
  links.forEach((l, i) => {
    l.index = i;
    l.sourceName = nameById.get(l.source) || l.source;
    l.targetName = nameById.get(l.target) || l.target;
  });
  nodes.forEach((n, i) => {
    n.index = i;
  });
  layoutClass(nodes, links);
  const classCount = nodes.filter((n) => n.kind === 'class' || n.kind === 'interface' || n.kind === 'enum').length;
  const seqCount = nodes.filter((n) => n.kind === 'actor' || n.kind === 'participant').length || links.filter((l) => l.linkKind === 'message').length;
  let kind: UmlKind = 'class';
  if (classCount && seqCount) kind = 'mixed';
  else if (seqCount && !classCount) kind = 'sequence';
  if (!nodes.length) warnings.push('UML diagram contains no classifiers or lifelines.');
  if (!links.length && nodes.length) warnings.push('UML diagram has nodes but no links.');
  return { name, sourceKind, kind, title: title || name, nodes, links, warnings };
}

function parseXmi(xml: string, fileName: string): UmlDataset {
  const modelName = attrs(/<(?:[\w.-]+:)?Model\b([^>]*)/i.exec(xml)?.[1] ?? '').name || fileName.replace(/\.[^.]+$/, '') || 'UML model';
  const nodes: UmlNode[] = [];
  const links: UmlLink[] = [];
  const elRe =
    /<(?:[\w.-]+:)?packagedElement\b([^>]*?)\/>|<(?:[\w.-]+:)?packagedElement\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?packagedElement>/gi;
  let match: RegExpExecArray | null;
  while ((match = elRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const inner = match[3] || '';
    const type = (a['xmi:type'] || a.type || '').toLowerCase();
    const id = a['xmi:id'] || a.id || a.name || `n-${nodes.length + 1}`;
    const name = a.name || id;
    if (/class$/i.test(type) || type === 'uml:class') {
      const members = [...inner.matchAll(/<(?:[\w.-]+:)?owned(Attribute|Operation)\b([^>]*)\/?>/gi)].map((m) => {
        const ma = attrs(m[2] || '');
        return ma.name || 'member';
      });
      upsertNode(nodes, { id, name, kind: 'class', members });
    } else if (/interface$/i.test(type)) {
      upsertNode(nodes, { id, name, kind: 'interface' });
    } else if (/enumeration|enum$/i.test(type)) {
      upsertNode(nodes, { id, name, kind: 'enum' });
    } else if (/actor$/i.test(type)) {
      upsertNode(nodes, { id, name, kind: 'actor' });
    } else if (/association$/i.test(type)) {
      const ends = [...inner.matchAll(/<(?:[\w.-]+:)?memberEnd\b([^>]*)\/?>/gi)].map((m) => attrs(m[1] || '')['xmi:idref'] || attrs(m[1] || '').idref || '');
      if (ends[0] && ends[1]) {
        links.push({
          id: `l-${links.length + 1}`,
          index: links.length,
          source: ends[0],
          target: ends[1],
          sourceName: '',
          targetName: '',
          label: name === id ? '' : name,
          style: 'assoc',
          linkKind: 'relation'
        });
      }
    } else if (/generalization$/i.test(type)) {
      const general = a.general || attrs(inner)['general'];
      if (general) {
        links.push({
          id: `l-${links.length + 1}`,
          index: links.length,
          source: id,
          target: general,
          sourceName: '',
          targetName: '',
          label: '',
          style: 'inherit',
          linkKind: 'relation'
        });
      }
    } else if (/message$/i.test(type)) {
      const send = a.sendEvent || a.source || '';
      const recv = a.receiveEvent || a.target || '';
      if (send && recv) {
        upsertNode(nodes, { id: send, name: send, kind: 'participant' });
        upsertNode(nodes, { id: recv, name: recv, kind: 'participant' });
        links.push({
          id: `m-${links.length + 1}`,
          index: links.length,
          source: send,
          target: recv,
          sourceName: '',
          targetName: '',
          label: a.name || '',
          style: 'message',
          linkKind: 'message'
        });
      }
    } else if (/lifeline$/i.test(type)) {
      upsertNode(nodes, { id, name, kind: 'participant' });
    }
  }
  if (!nodes.length) throw new Error('XMI contains no UML classifiers');
  return finishDataset(modelName, 'xmi', modelName, nodes, links, []);
}

function parsePlantLike(source: string, fileName: string, sourceKind: UmlSourceKind): UmlDataset {
  const warnings: string[] = [];
  let title = '';
  const lines = source
    .replace(/\/'[\s\S]*?'\//g, '\n')
    .split(/\r?\n/)
    .map((l) => l.replace(/'.*$/, '').trim())
    .filter((l) => l && !/^@(start|end)uml\b/i.test(l) && !/^skinparam\b|^hide\b|^show\b|^!include\b/i.test(l));
  const nodes: UmlNode[] = [];
  const links: UmlLink[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      title = unquote(titleMatch[1]);
      i++;
      continue;
    }
    const decl = /^(abstract\s+)?(class|interface|enum|actor|participant)\s+([A-Za-z][\w.-]*)(?:\s+as\s+(\S+))?(?:\s*\{)?\s*$/i.exec(line);
    if (decl) {
      const kindRaw = decl[2].toLowerCase();
      const kind: UmlNodeKind =
        kindRaw === 'interface' || kindRaw === 'enum' || kindRaw === 'actor' || kindRaw === 'participant' ? kindRaw : 'class';
      const name = decl[3];
      const id = decl[4] ? unquote(decl[4]) : name;
      const members: string[] = [];
      if (line.includes('{') || (lines[i + 1] || '').startsWith('{')) {
        if (!line.includes('{')) i++;
        i++;
        while (i < lines.length && lines[i] !== '}') {
          if (lines[i] && lines[i] !== '{') members.push(lines[i].replace(/^[+\-#~]\s*/, ''));
          i++;
        }
      }
      upsertNode(nodes, { id, name, kind, members });
      if (id !== name) upsertNode(nodes, { id: name, name, kind, members });
      i++;
      continue;
    }
    const msg = /^([A-Za-z][A-Za-z0-9_]*)\s*(-->>|->>|-->|->)\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (msg && isSequenceMessage(msg[1], msg[2], msg[3], nodes)) {
      const leftKind = nodes.find((n) => n.id === msg[1])?.kind;
      const rightKind = nodes.find((n) => n.id === msg[3])?.kind;
      upsertNode(nodes, { id: msg[1], name: msg[1], kind: leftKind && leftKind !== 'other' ? leftKind : 'participant' });
      upsertNode(nodes, { id: msg[3], name: msg[3], kind: rightKind && rightKind !== 'other' ? rightKind : 'participant' });
      links.push({
        id: `m-${links.length + 1}`,
        index: links.length,
        source: msg[1],
        target: msg[3],
        sourceName: '',
        targetName: '',
        label: msg[4].trim(),
        style: msg[2].includes('--') ? 'return' : 'message',
        linkKind: 'message'
      });
      i++;
      continue;
    }
    const rel = parseClassRel(line);
    if (rel) {
      const left = idFromToken(rel.left);
      const right = idFromToken(rel.right);
      upsertNode(nodes, { id: left, name: left, kind: 'other' });
      upsertNode(nodes, { id: right, name: right, kind: 'other' });
      const flipped = flipRel(rel.op);
      links.push({
        id: `r-${links.length + 1}`,
        index: links.length,
        source: flipped ? right : left,
        target: flipped ? left : right,
        sourceName: '',
        targetName: '',
        label: rel.label,
        style: rel.style,
        linkKind: 'relation'
      });
      i++;
      continue;
    }
    if (/^(note|activate|deactivate|loop|alt|opt|else|end)\b/i.test(line)) {
      warnings.push(`Sequence keyword "${line.split(/\s+/)[0]}" is preview-only.`);
      i++;
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
    i++;
  }
  const fallback = title || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'UML diagram';
  return finishDataset(fallback, sourceKind, title, nodes, links, warnings);
}

function parseMermaidSequence(source: string, fileName: string, sourceKind: UmlSourceKind): UmlDataset {
  const warnings: string[] = [];
  const lines = source.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
  const nodes: UmlNode[] = [];
  const links: UmlLink[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const participant = /^(?:participant|actor)\s+([A-Za-z][A-Za-z0-9_]*)(?:\s+as\s+(.+))?$/i.exec(line);
    if (participant) {
      upsertNode(nodes, {
        id: participant[1],
        name: (participant[2] || participant[1]).trim(),
        kind: /^actor\b/i.test(line) ? 'actor' : 'participant'
      });
      continue;
    }
    const msg = /^([A-Za-z][A-Za-z0-9_]*)\s*(-->>|->>|-->|->)\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (msg) {
      upsertNode(nodes, { id: msg[1], name: msg[1], kind: 'participant' });
      upsertNode(nodes, { id: msg[3], name: msg[3], kind: 'participant' });
      links.push({
        id: `m-${links.length + 1}`,
        index: links.length,
        source: msg[1],
        target: msg[3],
        sourceName: '',
        targetName: '',
        label: msg[4].trim(),
        style: msg[2].includes('--') ? 'return' : 'message',
        linkKind: 'message'
      });
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'UML sequence';
  return finishDataset(name, sourceKind, name, nodes, links, warnings);
}

function parseUmlJson(text: string, fileName: string): UmlDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid UML JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('UML JSON must be an object');
  const nodeRaw = (Array.isArray(obj.nodes) ? obj.nodes : Array.isArray(obj.classifiers) ? obj.classifiers : []) as unknown[];
  if (!nodeRaw.length) throw new Error('UML JSON is missing classifiers');
  const nodes: UmlNode[] = nodeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const kindRaw = asString(rec.kind || rec.type).toLowerCase();
    const kind: UmlNodeKind =
      kindRaw === 'class' || kindRaw === 'interface' || kindRaw === 'enum' || kindRaw === 'actor' || kindRaw === 'participant'
        ? kindRaw
        : 'other';
    const members = Array.isArray(rec.members) ? rec.members.map((m) => asString(m)).filter(Boolean) : [];
    return {
      id: asString(rec.id, `n-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.label, asString(rec.id, `n-${i + 1}`)),
      kind,
      members,
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const linkRaw = (Array.isArray(obj.links) ? obj.links : Array.isArray(obj.relations) ? obj.relations : Array.isArray(obj.messages) ? obj.messages : []) as unknown[];
  const links: UmlLink[] = linkRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const styleRaw = asString(rec.style).toLowerCase();
    const style: UmlLinkStyle =
      styleRaw === 'inherit' || styleRaw === 'compose' || styleRaw === 'realize' || styleRaw === 'depend' || styleRaw === 'message' || styleRaw === 'return'
        ? styleRaw
        : 'assoc';
    const linkKind: UmlLinkKind = asString(rec.linkKind).toLowerCase() === 'message' || style === 'message' || style === 'return' ? 'message' : 'relation';
    return {
      id: asString(rec.id, `l-${i + 1}`),
      index: i,
      source: asString(rec.source || rec.from),
      target: asString(rec.target || rec.to),
      sourceName: '',
      targetName: '',
      label: asString(rec.label),
      style,
      linkKind
    };
  }).filter((l) => l.source && l.target);
  return finishDataset(asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'UML JSON'), 'json', asString(obj.title), nodes, links, []);
}

export function parseUmlText(text: string, fileName = ''): UmlDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('UML file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseUmlJson(raw, fileName);
  if (looksLikeXmi(raw) || ext === 'xmi') return parseXmi(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: UmlSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : ext === 'xml' ? 'xmi' : 'puml';
  if (/^sequenceDiagram\b/i.test(extracted.source)) return parseMermaidSequence(extracted.source, fileName, sourceKind);
  if (
    /@(start)uml\b/i.test(extracted.source) ||
    /\b(class|interface|enum|actor|participant)\b/i.test(extracted.source)
  ) {
    const parsed = parsePlantLike(extracted.source, fileName, sourceKind);
    if (!parsed.nodes.length) throw new Error('UML diagram contains no classifiers or lifelines');
    return parsed;
  }
  throw new Error('Not a UML class or sequence diagram');
}

export function parseUmlBytes(bytes: Uint8Array, fileName = ''): UmlDataset {
  if (!bytes.length) throw new Error('UML file is empty');
  return parseUmlText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterUmlNodes(nodes: UmlNode[], query: string, view: 'all' | 'class' | 'sequence' = 'all'): UmlNode[] {
  let list = nodes;
  if (view === 'class') list = list.filter((n) => n.kind === 'class' || n.kind === 'interface' || n.kind === 'enum' || n.kind === 'other');
  if (view === 'sequence') list = list.filter((n) => n.kind === 'actor' || n.kind === 'participant');
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('kind:')) return n.kind === token.slice(5);
      if (token.startsWith('node:') || token.startsWith('class:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return n.name.toLowerCase().includes(needle) || n.id.toLowerCase().includes(needle);
      }
      return `${n.id} ${n.name} ${n.kind} ${n.members.join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterUmlLinks(links: UmlLink[], query: string, view: 'all' | 'relation' | 'message' = 'all'): UmlLink[] {
  let list = links;
  if (view === 'relation') list = list.filter((l) => l.linkKind === 'relation');
  if (view === 'message') list = list.filter((l) => l.linkKind === 'message');
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('label:') || token.startsWith('msg:')) return l.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return l.sourceName.toLowerCase().includes(token.slice(5)) || l.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return l.targetName.toLowerCase().includes(token.slice(3)) || l.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('style:')) return l.style === token.slice(6);
      return `${l.source} ${l.target} ${l.sourceName} ${l.targetName} ${l.label} ${l.style} ${l.linkKind}`.toLowerCase().includes(token);
    })
  );
}
