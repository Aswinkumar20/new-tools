import type {
  OwlAxiom,
  OwlAxiomRel,
  OwlClass,
  OwlDataset,
  OwlProperty,
  OwlPropertyKind,
  OwlSourceKind
} from '../types/owl-ontology-viewer.types';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
const OWL_CLASS = `${OWL_NS}Class`;
const OWL_OBJECT = `${OWL_NS}ObjectProperty`;
const OWL_DATA = `${OWL_NS}DatatypeProperty`;
const OWL_ANNOT = `${OWL_NS}AnnotationProperty`;
const RDFS_SUB = `${RDFS_NS}subClassOf`;
const RDFS_DOMAIN = `${RDFS_NS}domain`;
const RDFS_RANGE = `${RDFS_NS}range`;
const RDFS_LABEL = `${RDFS_NS}label`;

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
  return /<(?:rdf:RDF|RDF|owl:|ontology|class|property)\b/i.test(text);
}

function looksLikeTurtle(text: string): boolean {
  return /(?:^|\n)\s*(?:@prefix|PREFIX)\b/i.test(text) || /\bowl:(?:Class|ObjectProperty|DatatypeProperty)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:owl|ttl|turtle|rdf|xml|json)?\s*([\s\S]*?)```/i.exec(text);
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
    if (prefix && iri.startsWith(base) && iri.length > base.length) return iri.slice(base.length);
  }
  const hash = iri.lastIndexOf('#');
  const slash = iri.lastIndexOf('/');
  const i = Math.max(hash, slash);
  return i >= 0 && i < iri.length - 1 ? iri.slice(i + 1) : iri;
}

function expand(raw: string, prefixes: Record<string, string>): { iri: string; name: string; literal: boolean } {
  const term = raw.trim();
  if (!term) return { iri: '', name: '', literal: false };
  if (term === 'a') return { iri: RDF_TYPE, name: 'type', literal: false };
  if (term.startsWith('"') || term.startsWith("'")) {
    const quote = term[0];
    const end = term.indexOf(quote, 1);
    const lit = end > 0 ? term.slice(1, end) : term.slice(1).replace(/['"]$/, '');
    return { iri: lit, name: lit, literal: true };
  }
  if (term.startsWith('<') && term.endsWith('>')) {
    const iri = term.slice(1, -1);
    return { iri, name: localName(iri, prefixes), literal: false };
  }
  if (term.startsWith('http://') || term.startsWith('https://')) return { iri: term, name: localName(term, prefixes), literal: false };
  const colon = term.indexOf(':');
  if (colon > 0) {
    const p = term.slice(0, colon);
    const local = term.slice(colon + 1);
    const base = prefixes[p];
    const iri = base ? `${base}${local}` : term;
    return { iri, name: local || term, literal: false };
  }
  const base = prefixes.shop || prefixes[''] || 'http://example.org/shop#';
  if (/^[A-Za-z_][\w.-]*$/.test(term)) return { iri: `${base}${term}`, name: term, literal: false };
  return { iri: term, name: term, literal: false };
}

function turtleTerms(text: string): string[] {
  const terms: string[] = [];
  const re =
    /<(?:\\.|[^>])+>|"(?:\\.|[^"\\])*"(?:@[A-Za-z0-9-]+|\^\^<[^>]+>|\^\^[\w:.-]+)?|'(?:\\.|[^'\\])*'|_:[\w.-]+|\ba\b|[A-Za-z_][\w.-]*:[A-Za-z_][\w.-]*|[A-Za-z_][\w.-]*/g;
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

function isXsd(iri: string): boolean {
  return iri.startsWith(XSD_NS) || /^xsd:/i.test(iri);
}

function upsertClass(classes: OwlClass[], iri: string, name: string): OwlClass {
  const existing = classes.find((c) => c.id === iri || c.name === name);
  if (existing) {
    if (name && name !== existing.name && name !== iri) existing.name = name;
    if (iri && existing.id !== iri && iri.startsWith('http')) existing.id = iri;
    return existing;
  }
  const created: OwlClass = {
    id: iri || name,
    index: classes.length,
    name: name || localName(iri, defaultPrefixes()),
    iri: iri || name,
    label: '',
    superClasses: [],
    x: 0,
    y: 0
  };
  classes.push(created);
  return created;
}

function upsertProperty(
  properties: OwlProperty[],
  next: { iri: string; name: string; kind?: OwlPropertyKind; domain?: string; range?: string }
): OwlProperty {
  const existing = properties.find((p) => p.id === next.iri || p.name === next.name);
  if (existing) {
    if (next.name && next.name !== existing.name) existing.name = next.name;
    if (next.kind && next.kind !== 'annotation') existing.kind = next.kind;
    if (next.domain) existing.domain = next.domain;
    if (next.range) existing.range = next.range;
    return existing;
  }
  const created: OwlProperty = {
    id: next.iri || next.name,
    index: properties.length,
    name: next.name,
    iri: next.iri || next.name,
    kind: next.kind || 'object',
    domain: next.domain || '',
    range: next.range || '',
    x: 0,
    y: 0
  };
  properties.push(created);
  return created;
}

function addAxiom(axioms: OwlAxiom[], source: string, target: string, sourceName: string, targetName: string, rel: OwlAxiomRel): void {
  if (!source || !target) return;
  if (axioms.some((a) => a.source === source && a.target === target && a.rel === rel)) return;
  axioms.push({
    id: `a-${axioms.length + 1}`,
    index: axioms.length,
    source,
    target,
    sourceName,
    targetName,
    rel
  });
}

function applyTriple(
  predIri: string,
  subj: { iri: string; name: string; literal: boolean },
  obj: { iri: string; name: string; literal: boolean },
  classes: OwlClass[],
  properties: OwlProperty[],
  axioms: OwlAxiom[]
): void {
  if (predIri === RDF_TYPE) {
    if (obj.iri === OWL_CLASS) upsertClass(classes, subj.iri, subj.name);
    else if (obj.iri === OWL_OBJECT) upsertProperty(properties, { iri: subj.iri, name: subj.name, kind: 'object' });
    else if (obj.iri === OWL_DATA) upsertProperty(properties, { iri: subj.iri, name: subj.name, kind: 'datatype' });
    else if (obj.iri === OWL_ANNOT) upsertProperty(properties, { iri: subj.iri, name: subj.name, kind: 'annotation' });
    return;
  }
  if (predIri === RDFS_LABEL && !subj.literal) {
    const cls = classes.find((c) => c.id === subj.iri);
    if (cls) cls.label = obj.name || obj.iri;
    const prop = properties.find((p) => p.id === subj.iri);
    if (prop && obj.literal) prop.name = prop.name || obj.name;
    return;
  }
  if (predIri === RDFS_SUB) {
    const child = upsertClass(classes, subj.iri, subj.name);
    const parent = upsertClass(classes, obj.iri, obj.name);
    if (!child.superClasses.includes(parent.name)) child.superClasses.push(parent.name);
    addAxiom(axioms, child.id, parent.id, child.name, parent.name, 'subclass');
    return;
  }
  if (predIri === RDFS_DOMAIN) {
    const prop = upsertProperty(properties, { iri: subj.iri, name: subj.name });
    const domain = isXsd(obj.iri) ? obj.name : upsertClass(classes, obj.iri, obj.name).name;
    prop.domain = domain;
    if (!isXsd(obj.iri)) {
      const cls = classes.find((c) => c.name === domain || c.id === obj.iri);
      if (cls) addAxiom(axioms, prop.id, cls.id, prop.name, cls.name, 'domain');
    }
    return;
  }
  if (predIri === RDFS_RANGE) {
    const prop = upsertProperty(properties, { iri: subj.iri, name: subj.name });
    if (isXsd(obj.iri)) {
      prop.range = obj.name || 'literal';
      return;
    }
    const range = upsertClass(classes, obj.iri, obj.name);
    prop.range = range.name;
    addAxiom(axioms, prop.id, range.id, prop.name, range.name, 'range');
  }
}

function ingestTurtle(text: string, prefixes: Record<string, string>, classes: OwlClass[], properties: OwlProperty[], axioms: OwlAxiom[]): void {
  const body = collectPrefixes(text, prefixes);
  const addPair = (subjectRaw: string, predRaw: string, objRaw: string): void => {
    const s = expand(subjectRaw, prefixes);
    const p = expand(predRaw, prefixes);
    const o = expand(objRaw, prefixes);
    if (!s.iri || !p.iri) return;
    applyTriple(p.iri, s, o, classes, properties, axioms);
  };
  for (const stmt of splitTurtleStatements(body)) {
    if (/^(?:@prefix|PREFIX)\b/i.test(stmt)) continue;
    const parts = splitOutside(stmt, ';');
    if (!parts.length) continue;
    const first = turtleTerms(parts[0]);
    if (first.length < 3) continue;
    const subject = first[0];
    for (let i = 1; i + 1 < first.length; i += 2) addPair(subject, first[i], first[i + 1]);
    for (let p = 1; p < parts.length; p++) {
      const terms = turtleTerms(parts[p]);
      for (let i = 0; i + 1 < terms.length; i += 2) addPair(subject, terms[i], terms[i + 1]);
    }
  }
}

function ingestOwlXml(xml: string, prefixes: Record<string, string>, classes: OwlClass[], properties: OwlProperty[], axioms: OwlAxiom[]): void {
  for (const m of xml.matchAll(/xmlns:([\w.-]+)\s*=\s*"([^"]+)"/g)) prefixes[m[1]] = m[2];
  const about = (a: Record<string, string>): string => a['rdf:about'] || a.about || '';
  const resource = (a: Record<string, string>): string => a['rdf:resource'] || a.resource || '';
  const blockRe =
    /<(?:([\w.-]+):)?(Class|ObjectProperty|DatatypeProperty|AnnotationProperty|Description)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?\2>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(xml))) {
    const ns = match[1] || '';
    const local = match[2] || '';
    const a = attrs(match[3] || '');
    const iri = about(a);
    if (!iri) continue;
    const name = localName(iri, prefixes);
    const inner = match[4] || '';
    if (/^Class$/i.test(local) || /owl:Class/i.test(`${ns}:${local}`)) upsertClass(classes, iri, name);
    else if (/^ObjectProperty$/i.test(local)) upsertProperty(properties, { iri, name, kind: 'object' });
    else if (/^DatatypeProperty$/i.test(local)) upsertProperty(properties, { iri, name, kind: 'datatype' });
    else if (/^AnnotationProperty$/i.test(local)) upsertProperty(properties, { iri, name, kind: 'annotation' });
    const predTriples: Array<{ pred: string; obj: string; literal: boolean }> = [];
    for (const self of inner.matchAll(/<(?:([\w.-]+):)?([\w.-]+)\b([^>]*)\/>/g)) {
      const pred = self[1] ? `${self[1]}:${self[2]}` : self[2];
      const res = resource(attrs(self[3] || ''));
      if (res) predTriples.push({ pred, obj: res.startsWith('http') ? `<${res}>` : res, literal: false });
    }
    for (const child of inner.matchAll(/<(?:([\w.-]+):)?([\w.-]+)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?[\w.-]+>/g)) {
      const pred = child[1] ? `${child[1]}:${child[2]}` : child[2];
      const pa = attrs(child[3] || '');
      const res = resource(pa);
      const text = (child[4] || '').replace(/<[^>]+>/g, '').trim();
      if (res) predTriples.push({ pred, obj: res.startsWith('http') ? `<${res}>` : res, literal: false });
      else if (text) predTriples.push({ pred, obj: `"${text}"`, literal: true });
    }
    const subjectRaw = iri.startsWith('http') ? `<${iri}>` : iri;
    if (/^Class$/i.test(local)) applyTriple(RDF_TYPE, expand(subjectRaw, prefixes), expand('owl:Class', prefixes), classes, properties, axioms);
    if (/^ObjectProperty$/i.test(local)) applyTriple(RDF_TYPE, expand(subjectRaw, prefixes), expand('owl:ObjectProperty', prefixes), classes, properties, axioms);
    if (/^DatatypeProperty$/i.test(local)) applyTriple(RDF_TYPE, expand(subjectRaw, prefixes), expand('owl:DatatypeProperty', prefixes), classes, properties, axioms);
    for (const t of predTriples) {
      applyTriple(expand(t.pred, prefixes).iri, expand(subjectRaw, prefixes), expand(t.obj, prefixes), classes, properties, axioms);
    }
  }
}

function ingestGenericXml(xml: string, prefixes: Record<string, string>, classes: OwlClass[], properties: OwlProperty[], axioms: OwlAxiom[]): void {
  for (const m of xml.matchAll(/<(?:[\w.-]+:)?class\b([^>]*?)\/>/gi)) {
    const a = attrs(m[1] || '');
    const name = a.name || a.id || '';
    if (!name) continue;
    const cls = upsertClass(classes, expand(name, prefixes).iri, name);
    if (a.super || a.subclassof) {
      const parent = upsertClass(classes, expand(a.super || a.subclassof, prefixes).iri, a.super || a.subclassof);
      if (!cls.superClasses.includes(parent.name)) cls.superClasses.push(parent.name);
      addAxiom(axioms, cls.id, parent.id, cls.name, parent.name, 'subclass');
    }
  }
  for (const m of xml.matchAll(/<(?:[\w.-]+:)?property\b([^>]*?)\/>/gi)) {
    const a = attrs(m[1] || '');
    const name = a.name || a.id || '';
    if (!name) continue;
    const kind = (a.kind || 'object').toLowerCase() as OwlPropertyKind;
    const prop = upsertProperty(properties, {
      iri: expand(name, prefixes).iri,
      name,
      kind: kind === 'datatype' || kind === 'annotation' ? kind : 'object',
      domain: a.domain || '',
      range: a.range || ''
    });
    if (a.domain) {
      const d = upsertClass(classes, expand(a.domain, prefixes).iri, a.domain);
      prop.domain = d.name;
      addAxiom(axioms, prop.id, d.id, prop.name, d.name, 'domain');
    }
    if (a.range && !isXsd(a.range)) {
      const r = upsertClass(classes, expand(a.range, prefixes).iri, a.range);
      prop.range = r.name;
      addAxiom(axioms, prop.id, r.id, prop.name, r.name, 'range');
    } else if (a.range) prop.range = a.range;
  }
}

function ingestMarkdownList(text: string, prefixes: Record<string, string>, classes: OwlClass[], properties: OwlProperty[], axioms: OwlAxiom[]): void {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) continue;
    const prop = /^(\S+)\s*:\s*(\S+)\s*->\s*(\S+)$/.exec(trimmed);
    if (prop) {
      const p = upsertProperty(properties, { iri: expand(prop[1], prefixes).iri, name: prop[1], kind: 'object' });
      const d = upsertClass(classes, expand(prop[2], prefixes).iri, prop[2]);
      const r = upsertClass(classes, expand(prop[3], prefixes).iri, prop[3]);
      p.domain = d.name;
      p.range = r.name;
      addAxiom(axioms, p.id, d.id, p.name, d.name, 'domain');
      addAxiom(axioms, p.id, r.id, p.name, r.name, 'range');
      continue;
    }
    const sub = /^(\S+)\s*->\s*(\S+)$/.exec(trimmed);
    if (sub) {
      const child = upsertClass(classes, expand(sub[1], prefixes).iri, sub[1]);
      const parent = upsertClass(classes, expand(sub[2], prefixes).iri, sub[2]);
      if (!child.superClasses.includes(parent.name)) child.superClasses.push(parent.name);
      addAxiom(axioms, child.id, parent.id, child.name, parent.name, 'subclass');
      continue;
    }
    if (/^[A-Za-z_][\w.-]*$/.test(trimmed)) upsertClass(classes, expand(trimmed, prefixes).iri, trimmed);
  }
}

function ingestJson(raw: unknown, prefixes: Record<string, string>, classes: OwlClass[], properties: OwlProperty[], axioms: OwlAxiom[]): void {
  const root = rec(Array.isArray(raw) ? raw[0] : raw);
  const classList = Array.isArray(root.classes) ? root.classes : [];
  const propList = Array.isArray(root.properties) ? root.properties : [];
  for (const item of classList) {
    const row = rec(item);
    const name = asString(row.name || row.id || row.label);
    if (!name) continue;
    const cls = upsertClass(classes, expand(asString(row.iri || name), prefixes).iri, name);
    const sup = asString(row.super || row.subClassOf || (Array.isArray(row.superClasses) ? row.superClasses[0] : ''));
    if (sup) {
      const parent = upsertClass(classes, expand(sup, prefixes).iri, sup);
      if (!cls.superClasses.includes(parent.name)) cls.superClasses.push(parent.name);
      addAxiom(axioms, cls.id, parent.id, cls.name, parent.name, 'subclass');
    }
  }
  for (const item of propList) {
    const row = rec(item);
    const name = asString(row.name || row.id);
    if (!name) continue;
    const kindRaw = asString(row.kind, 'object').toLowerCase();
    const kind: OwlPropertyKind = kindRaw === 'datatype' || kindRaw === 'annotation' ? kindRaw : 'object';
    const prop = upsertProperty(properties, { iri: expand(asString(row.iri || name), prefixes).iri, name, kind });
    const domain = asString(row.domain);
    const range = asString(row.range);
    if (domain) {
      const d = upsertClass(classes, expand(domain, prefixes).iri, domain);
      prop.domain = d.name;
      addAxiom(axioms, prop.id, d.id, prop.name, d.name, 'domain');
    }
    if (range) {
      if (isXsd(range)) prop.range = range;
      else {
        const r = upsertClass(classes, expand(range, prefixes).iri, range);
        prop.range = r.name;
        addAxiom(axioms, prop.id, r.id, prop.name, r.name, 'range');
      }
    }
  }
}

function layoutOntology(classes: OwlClass[], properties: OwlProperty[], axioms: OwlAxiom[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const c of classes) {
    incoming.set(c.id, []);
    outgoing.set(c.id, []);
  }
  for (const a of axioms) {
    if (a.rel !== 'subclass') continue;
    outgoing.get(a.source)?.push(a.target);
    incoming.get(a.target)?.push(a.source);
  }
  const rank = new Map<string, number>();
  const starts = classes.filter((c) => !(incoming.get(c.id)?.length)).map((c) => c.id);
  (starts.length ? starts : classes.slice(0, 1).map((c) => c.id)).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, OwlClass[]>();
  for (const c of classes) {
    const r = rank.get(c.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(c);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((c, i) => {
      c.x = 48 + r * 210;
      c.y = 40 + i * 110;
    });
  }
  properties.forEach((p, i) => {
    const domain = classes.find((c) => c.name === p.domain || c.id === p.domain);
    p.x = (domain?.x ?? 48) + 80;
    p.y = (domain?.y ?? 40) + 40 + (i % 3) * 20;
  });
}

function finishDataset(
  name: string,
  sourceKind: OwlSourceKind,
  title: string,
  classes: OwlClass[],
  properties: OwlProperty[],
  axioms: OwlAxiom[],
  warnings: string[]
): OwlDataset {
  if (!classes.length && !properties.length) throw new Error('OWL ontology contains no classes or properties');
  layoutOntology(classes, properties, axioms);
  classes.forEach((c, i) => (c.index = i));
  properties.forEach((p, i) => (p.index = i));
  axioms.forEach((a, i) => (a.index = i));
  return { name, sourceKind, title: title || name, classes, properties, axioms, warnings };
}

export function parseOwlText(text: string, fileName = ''): OwlDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('OWL file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  const prefixes = defaultPrefixes();
  const classes: OwlClass[] = [];
  const properties: OwlProperty[] = [];
  const axioms: OwlAxiom[] = [];
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Ontology';

  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid OWL JSON');
    }
    ingestJson(parsed, prefixes, classes, properties, axioms);
    return finishDataset(asString(rec(parsed).name || rec(parsed).title, fromFile), 'json', asString(rec(parsed).title || rec(parsed).name, fromFile), classes, properties, axioms, []);
  }

  if (looksLikeXml(raw) || ext === 'xml' || ext === 'owl' || ext === 'rdf') {
    if (/<(?:rdf:)?RDF\b/i.test(raw) || /<(?:owl:)?(?:Class|ObjectProperty|DatatypeProperty)\b/i.test(raw)) {
      ingestOwlXml(raw, prefixes, classes, properties, axioms);
      if (classes.length || properties.length) {
        return finishDataset(fromFile, ext === 'owl' ? 'owl' : 'rdfxml', fromFile, classes, properties, axioms, []);
      }
    }
    ingestGenericXml(raw, prefixes, classes, properties, axioms);
    if (classes.length || properties.length) return finishDataset(fromFile, 'xml', fromFile, classes, properties, axioms, []);
    throw new Error('OWL XML contains no classes or properties');
  }

  const extracted = extractFence(raw);
  const sourceKind: OwlSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : 'turtle';
  if (looksLikeTurtle(extracted.source) || ext === 'ttl' || /\bowl:/i.test(extracted.source)) {
    ingestTurtle(extracted.source, prefixes, classes, properties, axioms);
    if (classes.length || properties.length) return finishDataset(fromFile, sourceKind, fromFile, classes, properties, axioms, []);
  }
  ingestMarkdownList(extracted.source, prefixes, classes, properties, axioms);
  if (classes.length || properties.length) return finishDataset(fromFile, sourceKind, fromFile, classes, properties, axioms, []);
  throw new Error('Not an OWL ontology');
}

export function parseOwlBytes(bytes: Uint8Array, fileName = ''): OwlDataset {
  if (!bytes.length) throw new Error('OWL file is empty');
  return parseOwlText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterOwlClasses(classes: OwlClass[], query: string): OwlClass[] {
  const q = query.trim().toLowerCase();
  if (!q) return classes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return classes.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('class:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('super:')) return c.superClasses.some((s) => s.toLowerCase().includes(token.slice(6)));
      return `${c.id} ${c.name} ${c.label} ${c.superClasses.join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterOwlProperties(properties: OwlProperty[], query: string): OwlProperty[] {
  const q = query.trim().toLowerCase();
  if (!q) return properties;
  const tokens = q.split(/\s+/).filter(Boolean);
  return properties.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('prop:') || token.startsWith('property:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('kind:')) return p.kind === token.slice(5);
      if (token.startsWith('domain:')) return p.domain.toLowerCase().includes(token.slice(7));
      if (token.startsWith('range:')) return p.range.toLowerCase().includes(token.slice(6));
      return `${p.id} ${p.name} ${p.kind} ${p.domain} ${p.range}`.toLowerCase().includes(token);
    })
  );
}

export function filterOwlAxioms(axioms: OwlAxiom[], query: string): OwlAxiom[] {
  const q = query.trim().toLowerCase();
  if (!q) return axioms;
  const tokens = q.split(/\s+/).filter(Boolean);
  return axioms.filter((a) =>
    tokens.every((token) => {
      if (token.startsWith('from:')) return a.sourceName.toLowerCase().includes(token.slice(5)) || a.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return a.targetName.toLowerCase().includes(token.slice(3)) || a.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('rel:') || token.startsWith('kind:')) return a.rel.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      return `${a.source} ${a.target} ${a.sourceName} ${a.targetName} ${a.rel}`.toLowerCase().includes(token);
    })
  );
}
