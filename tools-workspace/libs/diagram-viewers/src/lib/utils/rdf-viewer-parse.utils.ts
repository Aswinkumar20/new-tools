import type { RdfDataset, RdfNode, RdfPrefix, RdfSourceKind, RdfTriple } from '../types/rdf-viewer.types';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';

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
  return /<(?:rdf:RDF|RDF|rdf|triple|prefix)\b/i.test(text);
}

function looksLikeTurtle(text: string): boolean {
  return /(?:^|\n)\s*(?:@prefix|PREFIX)\b/i.test(text) || /(?:^|\n)\s*(?:<[^>]+>|[\w.-]+:[\w.-]+)\s+(?:a\b|[\w.-]+:[\w.-]+|<[^>]+>)/.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:ttl|turtle|rdf|n3|nt|xml|json|jsonld)?\s*([\s\S]*?)```/i.exec(text);
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

function defaultPrefixes(): Record<string, string> {
  return { rdf: RDF_NS, rdfs: RDFS_NS, owl: OWL_NS, xsd: XSD_NS };
}

function localName(iri: string, prefixes: Record<string, string>): string {
  for (const [prefix, base] of Object.entries(prefixes)) {
    if (prefix && iri.startsWith(base) && iri.length > base.length) return `${prefix}:${iri.slice(base.length)}`;
  }
  const hash = iri.lastIndexOf('#');
  const slash = iri.lastIndexOf('/');
  const i = Math.max(hash, slash);
  return i >= 0 && i < iri.length - 1 ? iri.slice(i + 1) : iri;
}

function prefixOf(iri: string, prefixes: Record<string, string>): string {
  for (const [prefix, base] of Object.entries(prefixes)) {
    if (prefix && iri.startsWith(base)) return prefix;
  }
  return '';
}

interface Term {
  iri: string;
  name: string;
  literal: boolean;
  blank: boolean;
}

function expandTerm(raw: string, prefixes: Record<string, string>): Term {
  const term = raw.trim();
  if (!term) return { iri: '', name: '', literal: false, blank: false };
  if (term === 'a') return { iri: RDF_TYPE, name: 'rdf:type', literal: false, blank: false };
  if (term.startsWith('_:')) return { iri: term, name: term, literal: false, blank: true };
  if (term.startsWith('"') || term.startsWith("'")) {
    const quote = term[0];
    const end = term.indexOf(quote, 1);
    const lit = end > 0 ? term.slice(1, end) : term.slice(1).replace(/['"]$/, '');
    return { iri: lit, name: lit, literal: true, blank: false };
  }
  if (term.startsWith('<') && term.endsWith('>')) {
    const iri = term.slice(1, -1);
    return { iri, name: localName(iri, prefixes), literal: false, blank: false };
  }
  const colon = term.indexOf(':');
  if (colon > 0) {
    const p = term.slice(0, colon);
    const local = term.slice(colon + 1);
    const base = prefixes[p];
    const iri = base ? `${base}${local}` : term;
    return { iri, name: term, literal: false, blank: false };
  }
  return { iri: term, name: term, literal: false, blank: false };
}

function turtleTerms(text: string): string[] {
  const terms: string[] = [];
  const re =
    /<(?:\\.|[^>])+>|"(?:\\.|[^"\\])*"(?:@[A-Za-z0-9-]+|\^\^<[^>]+>|\^\^[\w:.-]+)?|'(?:\\.|[^'\\])*'|_:[\w.-]+|\ba\b|[A-Za-z_][\w.-]*:[A-Za-z_][\w.-]*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) terms.push(match[0]);
  return terms;
}

function splitOutside(text: string, sep: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inStr = false;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      buf += ch;
      if (ch === quote && text[i - 1] !== '\\') inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      quote = ch;
      buf += ch;
      continue;
    }
    if (text.startsWith(sep, i)) {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i += sep.length - 1;
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function splitTurtleStatements(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inStr = false;
  let quote = '';
  let inIri = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      buf += ch;
      if (ch === quote && text[i - 1] !== '\\') inStr = false;
      continue;
    }
    if (inIri) {
      buf += ch;
      if (ch === '>') inIri = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '<') {
      inIri = true;
      buf += ch;
      continue;
    }
    if (ch === '#') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '.') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function collectPrefixes(text: string, prefixes: Record<string, string>): string {
  return text.replace(/(?:@prefix|PREFIX)\s+([\w.-]*):\s*<([^>]+)>\s*\.?/gi, (_m, p: string, iri: string) => {
    prefixes[p || ''] = iri;
    return '\n';
  });
}

function upsertNode(nodes: RdfNode[], iri: string, name: string, blank: boolean, prefixes: Record<string, string>): RdfNode {
  const existing = nodes.find((n) => n.id === iri);
  if (existing) {
    if (name && name !== iri) existing.name = name;
    return existing;
  }
  const created: RdfNode = {
    id: iri,
    index: nodes.length,
    name: name || localName(iri, prefixes),
    kind: blank ? 'blank' : 'iri',
    iri,
    prefix: prefixOf(iri, prefixes),
    x: 0,
    y: 0
  };
  nodes.push(created);
  return created;
}

function addTriple(
  triples: RdfTriple[],
  nodes: RdfNode[],
  prefixes: Record<string, string>,
  subjectRaw: string,
  predicateRaw: string,
  objectRaw: string
): void {
  const s = expandTerm(subjectRaw, prefixes);
  const p = expandTerm(predicateRaw, prefixes);
  const o = expandTerm(objectRaw, prefixes);
  if (!s.iri || !p.iri || o.iri === '') return;
  if (!s.literal) upsertNode(nodes, s.iri, s.name, s.blank, prefixes);
  if (!o.literal) upsertNode(nodes, o.iri, o.name, o.blank, prefixes);
  triples.push({
    id: `t-${triples.length + 1}`,
    index: triples.length,
    subject: s.iri,
    predicate: p.iri,
    object: o.iri,
    subjectName: s.name,
    predicateName: p.name,
    objectName: o.name,
    literal: o.literal
  });
}

function parseTurtleTriples(text: string, prefixes: Record<string, string>, triples: RdfTriple[], nodes: RdfNode[]): void {
  const body = collectPrefixes(text, prefixes);
  for (const stmt of splitTurtleStatements(body)) {
    if (/^(?:@prefix|PREFIX)\b/i.test(stmt)) continue;
    const parts = splitOutside(stmt, ';');
    if (!parts.length) continue;
    const first = turtleTerms(parts[0]);
    if (first.length < 3) continue;
    const subject = first[0];
    const predObjs = first.slice(1);
    for (let i = 0; i + 1 < predObjs.length; i += 2) addTriple(triples, nodes, prefixes, subject, predObjs[i], predObjs[i + 1]);
    for (let p = 1; p < parts.length; p++) {
      const terms = turtleTerms(parts[p]);
      for (let i = 0; i + 1 < terms.length; i += 2) addTriple(triples, nodes, prefixes, subject, terms[i], terms[i + 1]);
    }
  }
}

function parseEdgeList(text: string, prefixes: Record<string, string>, triples: RdfTriple[], nodes: RdfNode[]): void {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const arrow = /^(\S+)\s+--+([^>\s]+)--*>\s+(\S+)\s*\.?$/.exec(trimmed);
    if (arrow) {
      addTriple(triples, nodes, prefixes, arrow[1], arrow[2], arrow[3]);
      continue;
    }
    const triple = /^(\S+)\s+(\S+)\s+(\S+)\s*\.?$/.exec(trimmed);
    if (triple) addTriple(triples, nodes, prefixes, triple[1], triple[2], triple[3]);
  }
}

function layoutNodes(nodes: RdfNode[], triples: RdfTriple[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const t of triples) {
    if (t.literal) continue;
    outgoing.get(t.subject)?.push(t.object);
    incoming.get(t.object)?.push(t.subject);
  }
  const rank = new Map<string, number>();
  const starts = nodes.filter((n) => !(incoming.get(n.id)?.length)).map((n) => n.id);
  (starts.length ? starts : nodes.slice(0, 1).map((n) => n.id)).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, RdfNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(n);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((n, i) => {
      n.x = 48 + r * 200;
      n.y = 40 + i * 90;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: RdfSourceKind,
  title: string,
  prefixes: Record<string, string>,
  nodes: RdfNode[],
  triples: RdfTriple[],
  warnings: string[]
): RdfDataset {
  if (!triples.length) throw new Error('RDF document contains no triples');
  layoutNodes(nodes, triples);
  const prefixList: RdfPrefix[] = Object.entries(prefixes)
    .filter(([p, iri]) => p && iri)
    .map(([prefix, iri]) => ({ prefix, iri }));
  nodes.forEach((n, i) => (n.index = i));
  triples.forEach((t, i) => (t.index = i));
  return { name, sourceKind, title: title || name, prefixes: prefixList, nodes, triples, warnings };
}

function parseTurtle(text: string, fileName: string, sourceKind: RdfSourceKind): RdfDataset {
  const prefixes = defaultPrefixes();
  const triples: RdfTriple[] = [];
  const nodes: RdfNode[] = [];
  parseTurtleTriples(text, prefixes, triples, nodes);
  if (!triples.length) parseEdgeList(text, prefixes, triples, nodes);
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'RDF';
  return finishDataset(fromFile, sourceKind, fromFile, prefixes, nodes, triples, []);
}

function parseGenericXml(xml: string, fileName: string): RdfDataset {
  const prefixes = defaultPrefixes();
  const triples: RdfTriple[] = [];
  const nodes: RdfNode[] = [];
  const root = /<(?:rdf|graph)\b([^>]*)>/i.exec(xml);
  const name = attrs(root?.[1] || '').name || fileName.replace(/\.[^.]+$/, '') || 'RDF';
  for (const m of xml.matchAll(/<(?:[\w.-]+:)?prefix\b([^>]*?)\/>/gi)) {
    const a = attrs(m[1] || '');
    if (a.name && a.iri) prefixes[a.name] = a.iri;
  }
  for (const m of xml.matchAll(/<(?:[\w.-]+:)?triple\b([^>]*?)\/>/gi)) {
    const a = attrs(m[1] || '');
    if (a.subject && a.predicate && a.object) addTriple(triples, nodes, prefixes, a.subject, a.predicate, a.object);
  }
  if (!triples.length) throw new Error('RDF XML contains no triples');
  return finishDataset(name, 'xml', name, prefixes, nodes, triples, []);
}

function parseRdfXml(xml: string, fileName: string, sourceKind: RdfSourceKind): RdfDataset {
  const prefixes = defaultPrefixes();
  const triples: RdfTriple[] = [];
  const nodes: RdfNode[] = [];
  for (const m of xml.matchAll(/xmlns:([\w.-]+)\s*=\s*"([^"]+)"/g)) prefixes[m[1]] = m[2];
  const about = (a: Record<string, string>): string => a['rdf:about'] || a.about || (a['rdf:ID'] || a.ID ? `#${a['rdf:ID'] || a.ID}` : '');
  const resource = (a: Record<string, string>): string => a['rdf:resource'] || a.resource || '';

  const blockRe =
    /<(?:([\w.-]+):)?([\w.-]+)\b([^>]*?(?:rdf:about|rdf:ID|about|ID)=[^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?\2>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(xml))) {
    const ns = match[1] || '';
    const local = match[2] || '';
    const tagName = ns ? `${ns}:${local}` : local;
    if (/^(?:rdf:)?RDF$/i.test(tagName)) continue;
    const a = attrs(match[3] || '');
    const subjectIri = about(a);
    if (!subjectIri) continue;
    const subjTerm = subjectIri.startsWith('http') ? `<${subjectIri}>` : subjectIri;
    if (!/^(?:rdf:)?Description$/i.test(tagName)) addTriple(triples, nodes, prefixes, subjTerm, 'a', tagName);
    const inner = match[4] || '';
    for (const self of inner.matchAll(/<(?:([\w.-]+):)?([\w.-]+)\b([^>]*)\/>/g)) {
      const pred = self[1] ? `${self[1]}:${self[2]}` : self[2];
      if (/^(?:RDF|Description)$/i.test(self[2] || '')) continue;
      const pa = attrs(self[3] || '');
      const res = resource(pa);
      if (res) addTriple(triples, nodes, prefixes, subjTerm, pred, res.startsWith('http') ? `<${res}>` : res);
    }
    for (const child of inner.matchAll(/<(?:([\w.-]+):)?([\w.-]+)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?[\w.-]+>/g)) {
      const pred = child[1] ? `${child[1]}:${child[2]}` : child[2];
      if (/^(?:RDF|Description)$/i.test(child[2] || '')) continue;
      const pa = attrs(child[3] || '');
      const res = resource(pa);
      const text = (child[4] || '').replace(/<[^>]+>/g, '').trim();
      if (res) addTriple(triples, nodes, prefixes, subjTerm, pred, res.startsWith('http') ? `<${res}>` : res);
      else if (text) addTriple(triples, nodes, prefixes, subjTerm, pred, `"${text}"`);
    }
  }
  if (!triples.length) return parseGenericXml(xml, fileName);
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'RDF';
  return finishDataset(fromFile, sourceKind, fromFile, prefixes, nodes, triples, []);
}

function parseJson(raw: unknown, fileName: string): RdfDataset {
  const prefixes = defaultPrefixes();
  const triples: RdfTriple[] = [];
  const nodes: RdfNode[] = [];
  const root = rec(Array.isArray(raw) ? raw[0] : raw);
  const name = asString(root.name || root.title, fileName.replace(/\.[^.]+$/, '') || 'RDF');
  const ctx = rec(root['@context'] || root.prefixes || root.prefix);
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'string') prefixes[k] = v;
    else if (typeof rec(v)['@id'] === 'string') prefixes[k] = asString(rec(v)['@id']);
  }
  const graph = Array.isArray(root['@graph']) ? root['@graph'] : Array.isArray(root.triples) ? root.triples : Array.isArray(raw) ? raw : [];
  if (Array.isArray(root.triples) || graph.length) {
    for (const item of graph) {
      const row = rec(item);
      if (row.subject || row.s || row['@id']) {
        if (row.predicate || row.p || row.predicateName) {
          addTriple(
            triples,
            nodes,
            prefixes,
            asString(row.subject || row.s || row['@id']),
            asString(row.predicate || row.p || row.pred),
            asString(row.object || row.o || row.value)
          );
          continue;
        }
        const id = asString(row['@id'] || row.subject || row.s);
        const type = row['@type'] || row.type;
        if (id && type) {
          const types = Array.isArray(type) ? type : [type];
          for (const t of types) addTriple(triples, nodes, prefixes, id, 'a', asString(t));
        }
        for (const [k, v] of Object.entries(row)) {
          if (k.startsWith('@') || k === 'subject' || k === 's' || k === 'type') continue;
          if (typeof v === 'string') addTriple(triples, nodes, prefixes, id, k, v);
          else if (v && typeof v === 'object' && asString(rec(v)['@id'])) addTriple(triples, nodes, prefixes, id, k, asString(rec(v)['@id']));
        }
      }
    }
  }
  if (!triples.length) throw new Error('RDF JSON contains no triples');
  return finishDataset(name, 'json', asString(root.title || root.name, name), prefixes, nodes, triples, []);
}

export function parseRdfText(text: string, fileName = ''): RdfDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('RDF file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json' || ext === 'jsonld') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid RDF JSON');
    }
    return parseJson(parsed, fileName);
  }
  if ((looksLikeXml(raw) || ext === 'xml' || ext === 'rdf') && /<(?:rdf:RDF|RDF|rdf|triple)\b/i.test(raw)) {
    if (/<(?:rdf:)?RDF\b/i.test(raw) || /rdf:about=/i.test(raw)) {
      return parseRdfXml(raw, fileName, ext === 'rdf' ? 'rdfxml' : 'xml');
    }
    return parseGenericXml(raw, fileName);
  }
  const extracted = extractFence(raw);
  const sourceKind: RdfSourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'nt' ? 'ntriples' : ext === 'txt' ? 'txt' : 'turtle';
  if (looksLikeTurtle(extracted.source) || ext === 'ttl' || ext === 'nt' || /->|--/.test(extracted.source)) {
    return parseTurtle(extracted.source, fileName, sourceKind);
  }
  throw new Error('Not an RDF document');
}

export function parseRdfBytes(bytes: Uint8Array, fileName = ''): RdfDataset {
  if (!bytes.length) throw new Error('RDF file is empty');
  return parseRdfText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterRdfNodes(nodes: RdfNode[], query: string): RdfNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('node:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return n.name.toLowerCase().includes(needle) || n.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('kind:')) return n.kind === token.slice(5);
      if (token.startsWith('prefix:')) return n.prefix.toLowerCase().includes(token.slice(7));
      return `${n.id} ${n.name} ${n.kind} ${n.prefix} ${n.iri}`.toLowerCase().includes(token);
    })
  );
}

export function filterRdfTriples(triples: RdfTriple[], query: string): RdfTriple[] {
  const q = query.trim().toLowerCase();
  if (!q) return triples;
  const tokens = q.split(/\s+/).filter(Boolean);
  return triples.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('sub:') || token.startsWith('subject:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return t.subjectName.toLowerCase().includes(needle) || t.subject.toLowerCase().includes(needle);
      }
      if (token.startsWith('pred:') || token.startsWith('predicate:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return t.predicateName.toLowerCase().includes(needle) || t.predicate.toLowerCase().includes(needle);
      }
      if (token.startsWith('obj:') || token.startsWith('object:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return t.objectName.toLowerCase().includes(needle) || t.object.toLowerCase().includes(needle);
      }
      return `${t.subject} ${t.predicate} ${t.object} ${t.subjectName} ${t.predicateName} ${t.objectName}`.toLowerCase().includes(token);
    })
  );
}
