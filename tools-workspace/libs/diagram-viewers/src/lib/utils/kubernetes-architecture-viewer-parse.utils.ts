import type {
  K8sDataset,
  K8sLink,
  K8sLinkRel,
  K8sService,
  K8sSourceKind,
  K8sWorkload
} from '../types/kubernetes-architecture-viewer.types';

const WORKLOAD_KINDS = new Set(['deployment', 'statefulset', 'daemonset', 'replicaset', 'job', 'cronjob', 'pod']);
const SERVICE_KINDS = new Set(['service', 'ingress', 'endpoints']);

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:kubernetes|k8s|workload|service)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:ya?ml|kubernetes|k8s)?\s*([\s\S]*?)```/i.exec(text);
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

function parseScalar(raw: string): unknown {
  const v = raw.trim();
  if (!v || v === '~' || v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v.replace(/#.*$/, '').trim();
}

function indentOf(line: string): number {
  const match = /^ */.exec(line);
  return match ? match[0].length : 0;
}

interface YamlLine {
  indent: number;
  text: string;
}

function toYamlLines(text: string): YamlLine[] {
  const out: YamlLine[] = [];
  for (const raw of text.replace(/\t/g, '  ').split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    out.push({ indent: indentOf(raw), text: trimmed });
  }
  return out;
}

function parseYamlLines(lines: YamlLine[], start: number, minIndent: number): { value: unknown; next: number } {
  if (start >= lines.length || lines[start].indent < minIndent) return { value: {}, next: start };
  if (lines[start].text.startsWith('- ')) return parseYamlSeq(lines, start, lines[start].indent);
  return parseYamlMap(lines, start, lines[start].indent);
}

function parseYamlMap(lines: YamlLine[], start: number, indent: number): { value: Record<string, unknown>; next: number } {
  const obj: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent !== indent) break;
    if (line.text.startsWith('- ')) break;
    const colon = line.text.indexOf(':');
    if (colon < 0) {
      i += 1;
      continue;
    }
    const key = line.text.slice(0, colon).trim();
    const rest = line.text.slice(colon + 1).trim();
    if (rest && rest !== '|' && rest !== '>') {
      obj[key] = parseScalar(rest);
      i += 1;
    } else {
      const nested = parseYamlLines(lines, i + 1, indent + 1);
      obj[key] = nested.value;
      i = nested.next;
    }
  }
  return { value: obj, next: i };
}

function parseYamlSeq(lines: YamlLine[], start: number, indent: number): { value: unknown[]; next: number } {
  const arr: unknown[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent !== indent || !line.text.startsWith('- ')) break;
    const rest = line.text.slice(2).trim();
    if (!rest) {
      const nested = parseYamlLines(lines, i + 1, indent + 1);
      arr.push(nested.value);
      i = nested.next;
      continue;
    }
    if (rest.includes(':') && !/^['"]/.test(rest)) {
      const colon = rest.indexOf(':');
      const key = rest.slice(0, colon).trim();
      const val = rest.slice(colon + 1).trim();
      const item: Record<string, unknown> = {};
      if (val && val !== '|' && val !== '>') {
        item[key] = parseScalar(val);
        i += 1;
      } else {
        const nested = parseYamlLines(lines, i + 1, indent + 1);
        item[key] = nested.value;
        i = nested.next;
      }
      while (i < lines.length && lines[i].indent > indent && !lines[i].text.startsWith('- ')) {
        const more = parseYamlMap(lines, i, lines[i].indent);
        Object.assign(item, more.value);
        i = more.next;
      }
      arr.push(item);
    } else {
      arr.push(parseScalar(rest));
      i += 1;
    }
  }
  return { value: arr, next: i };
}

function parseSimpleYaml(text: string): unknown {
  return parseYamlLines(toYamlLines(text), 0, 0).value;
}

function parseYamlDocs(text: string): unknown[] {
  return text
    .split(/^\s*---\s*$/m)
    .map((doc) => doc.trim())
    .filter((doc) => doc && !doc.startsWith('%YAML') && !doc.startsWith('%TAG'))
    .map((doc) => parseSimpleYaml(doc));
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function strMap(value: unknown): Record<string, string> {
  const obj = rec(value);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = asString(v);
  return out;
}

function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => rec(acc)[key], obj);
}

function resourceId(kind: string, name: string, namespace: string): string {
  return `${namespace || 'default'}/${kind}/${name}`;
}

function upsertWorkload(
  workloads: K8sWorkload[],
  next: { id: string; name: string; kind: string; namespace?: string; replicas?: number; labels?: Record<string, string> }
): K8sWorkload {
  const existing = workloads.find(
    (w) => w.id === next.id || (w.name === next.name && w.kind === next.kind && w.namespace === (next.namespace || w.namespace))
  );
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind && next.kind.toLowerCase() !== 'pod') existing.kind = next.kind;
    if (next.namespace) existing.namespace = next.namespace;
    if (next.replicas) existing.replicas = next.replicas;
    if (next.labels) existing.labels = { ...existing.labels, ...next.labels };
    return existing;
  }
  const created: K8sWorkload = {
    id: next.id,
    index: workloads.length,
    name: next.name,
    kind: next.kind,
    namespace: next.namespace || 'default',
    replicas: next.replicas || 1,
    labels: next.labels || {},
    x: 0,
    y: 0
  };
  workloads.push(created);
  return created;
}

function upsertService(
  services: K8sService[],
  next: { id: string; name: string; kind: string; namespace?: string; type?: string; selector?: Record<string, string>; ports?: string }
): K8sService {
  const existing = services.find((s) => s.id === next.id || (s.name === next.name && s.kind === next.kind));
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind && next.kind.toLowerCase() !== 'service') existing.kind = next.kind;
    if (next.namespace) existing.namespace = next.namespace;
    if (next.type) existing.type = next.type;
    if (next.selector) existing.selector = { ...existing.selector, ...next.selector };
    if (next.ports) existing.ports = next.ports;
    return existing;
  }
  const created: K8sService = {
    id: next.id,
    index: services.length,
    name: next.name,
    kind: next.kind,
    namespace: next.namespace || 'default',
    type: next.type || '',
    selector: next.selector || {},
    ports: next.ports || '',
    x: 0,
    y: 0
  };
  services.push(created);
  return created;
}

function layoutNodes(workloads: K8sWorkload[], services: K8sService[], links: K8sLink[]): void {
  const nodes = [...workloads, ...services];
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const l of links) {
    outgoing.get(l.source)?.push(l.target);
    incoming.get(l.target)?.push(l.source);
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
  const buckets = new Map<number, Array<K8sWorkload | K8sService>>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(n);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((n, i) => {
      n.x = 48 + r * 210;
      n.y = 40 + i * 120;
    });
  }
}

function inferLinks(workloads: K8sWorkload[], services: K8sService[], links: K8sLink[]): void {
  for (const svc of services) {
    if (svc.kind.toLowerCase() === 'ingress') continue;
    const keys = Object.keys(svc.selector);
    if (!keys.length) continue;
    for (const wl of workloads) {
      if (wl.namespace !== svc.namespace) continue;
      if (keys.every((k) => wl.labels[k] === svc.selector[k])) {
        const dup = links.some((l) => l.source === svc.id && l.target === wl.id);
        if (!dup) {
          links.push({
            id: `l-${links.length + 1}`,
            index: links.length,
            source: svc.id,
            target: wl.id,
            sourceName: svc.name,
            targetName: wl.name,
            rel: 'selects'
          });
        }
      }
    }
  }
}

function finishDataset(
  name: string,
  sourceKind: K8sSourceKind,
  title: string,
  workloads: K8sWorkload[],
  services: K8sService[],
  links: K8sLink[],
  warnings: string[]
): K8sDataset {
  inferLinks(workloads, services, links);
  const nameById = new Map<string, string>([
    ...workloads.map((w) => [w.id, w.name] as const),
    ...services.map((s) => [s.id, s.name] as const)
  ]);
  links.forEach((l, i) => {
    l.index = i;
    l.sourceName = nameById.get(l.source) || l.sourceName || l.source;
    l.targetName = nameById.get(l.target) || l.targetName || l.target;
  });
  workloads.forEach((w, i) => {
    w.index = i;
  });
  services.forEach((s, i) => {
    s.index = i;
  });
  layoutNodes(workloads, services, links);
  if (!workloads.length) warnings.push('Kubernetes manifest contains no workloads.');
  if (!services.length && workloads.length) warnings.push('Kubernetes manifest has workloads but no services.');
  return { name, sourceKind, title: title || name, workloads, services, links, warnings };
}

function ingestManifest(
  item: unknown,
  workloads: K8sWorkload[],
  services: K8sService[],
  links: K8sLink[]
): void {
  const obj = rec(item);
  const kind = asString(obj.kind || obj.Kind);
  if (!kind) return;
  if (kind === 'List' && Array.isArray(obj.items)) {
    for (const child of obj.items) ingestManifest(child, workloads, services, links);
    return;
  }
  const meta = rec(obj.metadata);
  const spec = rec(obj.spec);
  const name = asString(meta.name || obj.name);
  if (!name) return;
  const namespace = asString(meta.namespace || obj.namespace, 'default');
  const lower = kind.toLowerCase();
  if (WORKLOAD_KINDS.has(lower)) {
    const templateLabels = strMap(get(spec, 'template.metadata.labels'));
    const metaLabels = strMap(meta.labels);
    upsertWorkload(workloads, {
      id: resourceId(kind, name, namespace),
      name,
      kind,
      namespace,
      replicas: Number(spec.replicas) || 1,
      labels: { ...metaLabels, ...templateLabels }
    });
    return;
  }
  if (SERVICE_KINDS.has(lower)) {
    const selector = strMap(spec.selector || spec.matchLabels);
    const ports = Array.isArray(spec.ports)
      ? (spec.ports as unknown[]).map((p) => asString(rec(p).port || rec(p).number)).filter(Boolean).join(', ')
      : asString(spec.port || spec.ports);
    const svc = upsertService(services, {
      id: resourceId(kind, name, namespace),
      name,
      kind,
      namespace,
      type: asString(spec.type, lower === 'ingress' ? 'Ingress' : 'ClusterIP'),
      selector,
      ports
    });
    if (lower === 'ingress') {
      const rules = Array.isArray(spec.rules) ? spec.rules : [];
      for (const rule of rules) {
        const paths = get(rec(rule), 'http.paths');
        const list = Array.isArray(paths) ? paths : [];
        for (const path of list) {
          const backendName = asString(get(rec(path), 'backend.service.name') || get(rec(path), 'backend.serviceName'));
          if (!backendName) continue;
          const target = services.find((s) => s.name === backendName && s.namespace === namespace) ||
            upsertService(services, { id: resourceId('Service', backendName, namespace), name: backendName, kind: 'Service', namespace });
          links.push({
            id: `l-${links.length + 1}`,
            index: links.length,
            source: svc.id,
            target: target.id,
            sourceName: svc.name,
            targetName: target.name,
            rel: 'routes'
          });
        }
      }
    }
  }
}

function parseK8sSource(source: string, fileName: string, sourceKind: K8sSourceKind): K8sDataset {
  const warnings: string[] = [];
  const workloads: K8sWorkload[] = [];
  const services: K8sService[] = [];
  const links: K8sLink[] = [];
  const docs = parseYamlDocs(source);
  for (const doc of docs) ingestManifest(doc, workloads, services, links);
  if (!workloads.length && !services.length) throw new Error('Kubernetes manifest contains no workloads or services');
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ');
  return finishDataset(fromFile || 'Kubernetes', sourceKind, fromFile || 'Kubernetes', workloads, services, links, warnings);
}

function parseXml(xml: string, fileName: string): K8sDataset {
  const root = /<(?:kubernetes|k8s)\b([^>]*)>/i.exec(xml);
  const a = attrs(root?.[1] || '');
  const name = a.name || fileName.replace(/\.[^.]+$/, '') || 'Kubernetes';
  const workloads: K8sWorkload[] = [];
  const services: K8sService[] = [];
  const links: K8sLink[] = [];
  const wlRe =
    /<(?:[\w.-]+:)?workload\b([^>]*?)\/>|<(?:[\w.-]+:)?workload\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?workload>/gi;
  let match: RegExpExecArray | null;
  while ((match = wlRe.exec(xml))) {
    const wa = attrs(match[1] || match[2] || '');
    const n = wa.name || wa.id || '';
    if (!n) continue;
    const labels: Record<string, string> = {};
    if (wa.app) labels.app = wa.app;
    upsertWorkload(workloads, {
      id: resourceId(wa.kind || 'Deployment', n, wa.namespace || 'default'),
      name: n,
      kind: wa.kind || 'Deployment',
      namespace: wa.namespace || 'default',
      replicas: Number(wa.replicas) || 1,
      labels
    });
  }
  const svcRe =
    /<(?:[\w.-]+:)?service\b([^>]*?)\/>|<(?:[\w.-]+:)?service\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?service>/gi;
  while ((match = svcRe.exec(xml))) {
    const sa = attrs(match[1] || match[2] || '');
    const n = sa.name || sa.id || '';
    if (!n) continue;
    const selector: Record<string, string> = {};
    if (sa.selector || sa.app) selector.app = sa.selector || sa.app;
    upsertService(services, {
      id: resourceId(sa.kind || 'Service', n, sa.namespace || 'default'),
      name: n,
      kind: sa.kind || 'Service',
      namespace: sa.namespace || 'default',
      type: sa.type || '',
      selector,
      ports: sa.port || sa.ports || ''
    });
  }
  const linkRe =
    /<(?:[\w.-]+:)?link\b([^>]*?)\/>|<(?:[\w.-]+:)?link\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?link>/gi;
  while ((match = linkRe.exec(xml))) {
    const la = attrs(match[1] || match[2] || '');
    if (!la.source || !la.target) continue;
    const source = services.find((s) => s.name === la.source || s.id === la.source)?.id ||
      workloads.find((w) => w.name === la.source || w.id === la.source)?.id ||
      la.source;
    const target = workloads.find((w) => w.name === la.target || w.id === la.target)?.id ||
      services.find((s) => s.name === la.target || s.id === la.target)?.id ||
      la.target;
    links.push({
      id: `l-${links.length + 1}`,
      index: links.length,
      source,
      target,
      sourceName: '',
      targetName: '',
      rel: (la.rel as K8sLinkRel) || 'selects'
    });
  }
  if (!workloads.length && !services.length) throw new Error('Kubernetes XML contains no workloads or services');
  return finishDataset(name, 'xml', name, workloads, services, links, []);
}

function parseJson(text: string, fileName: string): K8sDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid Kubernetes JSON');
  }
  const workloads: K8sWorkload[] = [];
  const services: K8sService[] = [];
  const links: K8sLink[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) ingestManifest(item, workloads, services, links);
  } else {
    const obj = rec(raw);
    if (Array.isArray(obj.items) || obj.kind) ingestManifest(obj, workloads, services, links);
    if (Array.isArray(obj.workloads)) {
      for (const item of obj.workloads) {
        const recItem = rec(item);
        const n = asString(recItem.name || recItem.id);
        if (!n) continue;
        upsertWorkload(workloads, {
          id: asString(recItem.id, resourceId(asString(recItem.kind, 'Deployment'), n, asString(recItem.namespace, 'default'))),
          name: n,
          kind: asString(recItem.kind, 'Deployment'),
          namespace: asString(recItem.namespace, 'default'),
          replicas: Number(recItem.replicas) || 1,
          labels: strMap(recItem.labels)
        });
      }
    }
    if (Array.isArray(obj.services)) {
      for (const item of obj.services) {
        const recItem = rec(item);
        const n = asString(recItem.name || recItem.id);
        if (!n) continue;
        upsertService(services, {
          id: asString(recItem.id, resourceId(asString(recItem.kind, 'Service'), n, asString(recItem.namespace, 'default'))),
          name: n,
          kind: asString(recItem.kind, 'Service'),
          namespace: asString(recItem.namespace, 'default'),
          type: asString(recItem.type),
          selector: strMap(recItem.selector),
          ports: asString(recItem.ports || recItem.port)
        });
      }
    }
    if (Array.isArray(obj.links)) {
      for (const item of obj.links) {
        const recItem = rec(item);
        const source = asString(recItem.source || recItem.from);
        const target = asString(recItem.target || recItem.to);
        if (!source || !target) continue;
        links.push({
          id: `l-${links.length + 1}`,
          index: links.length,
          source,
          target,
          sourceName: '',
          targetName: '',
          rel: (asString(recItem.rel, 'selects') as K8sLinkRel) || 'selects'
        });
      }
    }
  }
  if (!workloads.length && !services.length) throw new Error('Kubernetes JSON is missing workloads and services');
  return finishDataset(
    asString(rec(Array.isArray(raw) ? {} : raw).name || rec(Array.isArray(raw) ? {} : raw).title, fileName.replace(/\.[^.]+$/, '') || 'Kubernetes JSON'),
    'json',
    asString(rec(Array.isArray(raw) ? {} : raw).title || rec(Array.isArray(raw) ? {} : raw).name),
    workloads,
    services,
    links,
    []
  );
}

export function parseKubernetesText(text: string, fileName = ''): K8sDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Kubernetes file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  if (looksLikeXml(raw) || (ext === 'xml' && looksLikeXml(raw))) return parseXml(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: K8sSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : 'yaml';
  if (
    /\bkind:\s*\S+/i.test(extracted.source) ||
    /\bapiVersion:\s*\S+/i.test(extracted.source) ||
    /\b(?:Deployment|Service|Ingress|StatefulSet)\b/i.test(extracted.source)
  ) {
    return parseK8sSource(extracted.source, fileName, sourceKind);
  }
  throw new Error('Not a Kubernetes manifest');
}

export function parseKubernetesBytes(bytes: Uint8Array, fileName = ''): K8sDataset {
  if (!bytes.length) throw new Error('Kubernetes file is empty');
  return parseKubernetesText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterK8sWorkloads(workloads: K8sWorkload[], query: string): K8sWorkload[] {
  const q = query.trim().toLowerCase();
  if (!q) return workloads;
  const tokens = q.split(/\s+/).filter(Boolean);
  return workloads.filter((w) =>
    tokens.every((token) => {
      if (token.startsWith('workload:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return w.name.toLowerCase().includes(needle) || w.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('kind:')) return w.kind.toLowerCase().includes(token.slice(5));
      if (token.startsWith('ns:') || token.startsWith('namespace:')) return w.namespace.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      return `${w.id} ${w.name} ${w.kind} ${w.namespace} ${Object.entries(w.labels).map(([k, v]) => `${k}=${v}`).join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterK8sServices(services: K8sService[], query: string): K8sService[] {
  const q = query.trim().toLowerCase();
  if (!q) return services;
  const tokens = q.split(/\s+/).filter(Boolean);
  return services.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('service:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return s.name.toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('kind:')) return s.kind.toLowerCase().includes(token.slice(5));
      if (token.startsWith('ns:') || token.startsWith('namespace:')) return s.namespace.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      return `${s.id} ${s.name} ${s.kind} ${s.namespace} ${s.type} ${s.ports}`.toLowerCase().includes(token);
    })
  );
}

export function filterK8sLinks(links: K8sLink[], query: string): K8sLink[] {
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
