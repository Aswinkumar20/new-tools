import type {
  DepCycle,
  DepDataset,
  DepEdge,
  DepKind,
  DepPackage,
  DepSourceKind,
  DepTreeRow
} from '../types/dependency-graph-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:dependencies|packages|package|graph)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:json|yaml|yml|dot|lock|dependencies)?\s*([\s\S]*?)```/i.exec(text);
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

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pkgNameFromLockKey(key: string): string {
  if (!key || key === '') return 'root';
  const cleaned = key.replace(/^node_modules\//, '').replace(/^\/+/, '');
  const at = cleaned.lastIndexOf('@');
  if (at > 0 && !cleaned.startsWith('@')) return cleaned.slice(0, at);
  const scoped = /^(@[^/]+\/[^@/]+)(?:@|\/|$)/.exec(cleaned);
  if (scoped) return scoped[1];
  const slash = cleaned.lastIndexOf('/');
  return slash >= 0 ? cleaned.slice(slash + 1).replace(/@.*$/, '') : cleaned.replace(/@.*$/, '');
}

function upsertPackage(
  packages: DepPackage[],
  next: { id: string; name?: string; version?: string; kind?: DepKind }
): DepPackage {
  const existing = packages.find((p) => p.id === next.id || p.name === next.id);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.version) existing.version = next.version;
    if (next.kind && next.kind !== 'transitive') existing.kind = next.kind;
    return existing;
  }
  const created: DepPackage = {
    id: next.id,
    index: packages.length,
    name: next.name || next.id,
    version: next.version || '',
    kind: next.kind || 'transitive',
    x: 0,
    y: 0
  };
  packages.push(created);
  return created;
}

function addEdge(edges: DepEdge[], source: string, target: string, spec = ''): void {
  if (!source || !target || source === target) return;
  if (edges.some((e) => e.source === source && e.target === target)) return;
  edges.push({
    id: `e-${edges.length + 1}`,
    index: edges.length,
    source,
    target,
    sourceName: '',
    targetName: '',
    spec
  });
}

function layoutPackages(packages: DepPackage[], edges: DepEdge[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const p of packages) {
    incoming.set(p.id, []);
    outgoing.set(p.id, []);
  }
  for (const e of edges) {
    outgoing.get(e.source)?.push(e.target);
    incoming.get(e.target)?.push(e.source);
  }
  const rank = new Map<string, number>();
  const starts = packages.filter((p) => !(incoming.get(p.id)?.length)).map((p) => p.id);
  (starts.length ? starts : packages.slice(0, 1).map((p) => p.id)).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, DepPackage[]>();
  for (const p of packages) {
    const r = rank.get(p.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(p);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((p, i) => {
      p.x = 48 + r * 200;
      p.y = 40 + i * 90;
    });
  }
}

function findCycles(packages: DepPackage[], edges: DepEdge[]): DepCycle[] {
  const outgoing = new Map<string, string[]>();
  for (const p of packages) outgoing.set(p.id, []);
  for (const e of edges) outgoing.get(e.source)?.push(e.target);
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const dfs = (id: string): void => {
    seen.add(id);
    stack.push(id);
    onStack.add(id);
    for (const next of outgoing.get(id) ?? []) {
      if (!seen.has(next)) dfs(next);
      else if (onStack.has(next)) {
        const idx = stack.indexOf(next);
        if (idx >= 0) cycles.push([...stack.slice(idx), next]);
      }
    }
    stack.pop();
    onStack.delete(id);
  };
  for (const p of packages) if (!seen.has(p.id)) dfs(p.id);
  const uniq = new Map<string, string[]>();
  for (const cycle of cycles) {
    const core = cycle.slice(0, -1);
    const rotated = [...core].sort()[0];
    const start = core.indexOf(rotated);
    const norm = [...core.slice(start), ...core.slice(0, start)];
    uniq.set(norm.join('>'), [...norm, norm[0]]);
  }
  return [...uniq.values()].map((nodes, i) => ({
    id: `c-${i + 1}`,
    index: i,
    nodes,
    path: nodes.join(' → ')
  }));
}

function buildTree(packages: DepPackage[], edges: DepEdge[], cyclicIds: Set<string>): DepTreeRow[] {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const p of packages) {
    outgoing.set(p.id, []);
    incoming.set(p.id, []);
  }
  for (const e of edges) {
    outgoing.get(e.source)?.push(e.target);
    incoming.get(e.target)?.push(e.source);
  }
  const roots = packages.filter((p) => !(incoming.get(p.id)?.length));
  const start = roots.length ? roots : packages.slice(0, 1);
  const rows: DepTreeRow[] = [];
  const walk = (id: string, depth: number, trail: Set<string>): void => {
    const pkg = packages.find((p) => p.id === id);
    if (!pkg) return;
    rows.push({ id: pkg.id, name: pkg.name, version: pkg.version, depth, cyclic: cyclicIds.has(pkg.id) || trail.has(id) });
    if (trail.has(id)) return;
    const nextTrail = new Set(trail);
    nextTrail.add(id);
    for (const child of outgoing.get(id) ?? []) walk(child, depth + 1, nextTrail);
  };
  for (const root of start) walk(root.id, 0, new Set());
  return rows;
}

function finishDataset(
  name: string,
  sourceKind: DepSourceKind,
  title: string,
  packages: DepPackage[],
  edges: DepEdge[],
  warnings: string[]
): DepDataset {
  const nameById = new Map(packages.map((p) => [p.id, p.name] as const));
  edges.forEach((e, i) => {
    e.index = i;
    e.sourceName = nameById.get(e.source) || e.source;
    e.targetName = nameById.get(e.target) || e.target;
  });
  packages.forEach((p, i) => {
    p.index = i;
  });
  layoutPackages(packages, edges);
  const cycles = findCycles(packages, edges);
  const cyclicIds = new Set(cycles.flatMap((c) => c.nodes));
  const tree = buildTree(packages, edges, cyclicIds);
  if (!packages.length) warnings.push('Dependency graph contains no packages.');
  if (!edges.length && packages.length) warnings.push('Dependency graph has packages but no edges.');
  if (cycles.length) warnings.push(`Detected ${cycles.length} dependency cycle(s).`);
  return { name, sourceKind, title: title || name, packages, edges, cycles, tree, warnings };
}

function parsePackageLock(raw: Record<string, unknown>, fileName: string, sourceKind: DepSourceKind): DepDataset {
  const packages: DepPackage[] = [];
  const edges: DepEdge[] = [];
  const lockPkgs = rec(raw.packages);
  const keys = Object.keys(lockPkgs);
  if (!keys.length && rec(raw.dependencies)) {
    return parseNpmV1(raw, fileName, sourceKind);
  }
  const rootMeta = rec(lockPkgs[''] || lockPkgs['.']);
  const rootName = asString(rootMeta.name || raw.name, fileName.replace(/\.[^.]+$/, '') || 'root');
  upsertPackage(packages, { id: rootName, name: rootName, version: asString(rootMeta.version || raw.version), kind: 'root' });
  const direct = rec(rootMeta.dependencies);
  for (const [dep, spec] of Object.entries(direct)) {
    upsertPackage(packages, { id: dep, name: dep, kind: 'direct' });
    addEdge(edges, rootName, dep, asString(spec));
  }
  for (const [key, value] of Object.entries(lockPkgs)) {
    if (!key) continue;
    const meta = rec(value);
    const name = asString(meta.name, pkgNameFromLockKey(key));
    upsertPackage(packages, { id: name, name, version: asString(meta.version), kind: direct[name] ? 'direct' : 'transitive' });
    for (const [dep, spec] of Object.entries(rec(meta.dependencies))) {
      upsertPackage(packages, { id: dep, name: dep });
      addEdge(edges, name, dep, asString(spec));
    }
  }
  if (!packages.length) throw new Error('package-lock.json contains no packages');
  return finishDataset(rootName, sourceKind, rootName, packages, edges, []);
}

function parseNpmV1(raw: Record<string, unknown>, fileName: string, sourceKind: DepSourceKind): DepDataset {
  const packages: DepPackage[] = [];
  const edges: DepEdge[] = [];
  const rootName = asString(raw.name, fileName.replace(/\.[^.]+$/, '') || 'root');
  upsertPackage(packages, { id: rootName, name: rootName, version: asString(raw.version), kind: 'root' });
  const walk = (from: string, deps: Record<string, unknown>, kind: DepKind): void => {
    for (const [name, value] of Object.entries(deps)) {
      const meta = rec(value);
      upsertPackage(packages, { id: name, name, version: asString(meta.version), kind });
      addEdge(edges, from, name, asString(meta.version));
      walk(name, rec(meta.dependencies), 'transitive');
    }
  };
  walk(rootName, rec(raw.dependencies), 'direct');
  return finishDataset(rootName, sourceKind, rootName, packages, edges, []);
}

function parsePackageJson(raw: Record<string, unknown>, fileName: string): DepDataset {
  const packages: DepPackage[] = [];
  const edges: DepEdge[] = [];
  const rootName = asString(raw.name, fileName.replace(/\.[^.]+$/, '') || 'package');
  upsertPackage(packages, { id: rootName, name: rootName, version: asString(raw.version), kind: 'root' });
  for (const [name, spec] of Object.entries(rec(raw.dependencies))) {
    upsertPackage(packages, { id: name, name, kind: 'direct' });
    addEdge(edges, rootName, name, asString(spec));
  }
  for (const [name, spec] of Object.entries(rec(raw.devDependencies))) {
    upsertPackage(packages, { id: name, name, kind: 'direct' });
    addEdge(edges, rootName, name, asString(spec));
  }
  if (packages.length < 2) throw new Error('package.json has no dependencies');
  return finishDataset(rootName, 'package', rootName, packages, edges, []);
}

function parseYarnLock(text: string, fileName: string): DepDataset {
  const packages: DepPackage[] = [];
  const edges: DepEdge[] = [];
  const rootName = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || 'root';
  upsertPackage(packages, { id: rootName === 'yarn' ? 'root' : rootName, name: rootName === 'yarn' ? 'root' : rootName, kind: 'root' });
  const rootId = packages[0].id;
  const blocks = text.split(/\n(?=\S)/);
  let first = true;
  for (const block of blocks) {
    const header = /^([^:\n]+):\s*$/m.exec(block);
    if (!header) continue;
    const keys = header[1].split(/\s*,\s*/).map((k) => k.replace(/^"+|"+$/g, '').replace(/@[^@]+$/, '') || k.replace(/^"+|"+$/g, ''));
    const name = pkgNameFromLockKey(keys[0].replace(/@\^.*$/, '').replace(/@~.*$/, '').replace(/@\*.*$/, ''));
    const version = /version\s+"([^"]+)"/.exec(block)?.[1] || '';
    if (!name || name === 'root') continue;
    upsertPackage(packages, { id: name, name, version, kind: first ? 'direct' : 'transitive' });
    if (first) addEdge(edges, rootId, name);
    first = false;
    const depBlock = /dependencies:\n([\s\S]*?)(?=\n\S|\n*$)/.exec(block)?.[1] || '';
    for (const line of depBlock.split('\n')) {
      const dm = /^\s+([@\w./-]+)\s+"([^"]+)"/.exec(line);
      if (!dm) continue;
      upsertPackage(packages, { id: dm[1], name: dm[1] });
      addEdge(edges, name, dm[1], dm[2]);
    }
  }
  if (packages.length < 2) throw new Error('yarn.lock contains no packages');
  return finishDataset(rootId, 'lock', rootId, packages, edges, []);
}

function parseGenericJson(raw: Record<string, unknown>, fileName: string): DepDataset {
  const packages: DepPackage[] = [];
  const edges: DepEdge[] = [];
  const pkgRaw = (Array.isArray(raw.packages) ? raw.packages : Array.isArray(raw.nodes) ? raw.nodes : []) as unknown[];
  for (const item of pkgRaw) {
    const recItem = rec(item);
    const id = asString(recItem.id || recItem.name);
    if (!id) continue;
    upsertPackage(packages, {
      id,
      name: asString(recItem.name || id),
      version: asString(recItem.version),
      kind: recItem.kind === 'root' || recItem.kind === 'direct' ? recItem.kind : 'transitive'
    });
  }
  const edgeRaw = (Array.isArray(raw.edges) ? raw.edges : Array.isArray(raw.dependencies) ? raw.dependencies : []) as unknown[];
  for (const item of edgeRaw) {
    const recItem = rec(item);
    const source = asString(recItem.source || recItem.from);
    const target = asString(recItem.target || recItem.to);
    if (!source || !target) continue;
    upsertPackage(packages, { id: source });
    upsertPackage(packages, { id: target });
    addEdge(edges, source, target, asString(recItem.spec || recItem.label));
  }
  if (!packages.length) throw new Error('Dependency JSON is missing packages');
  return finishDataset(
    asString(raw.name || raw.title, fileName.replace(/\.[^.]+$/, '') || 'Dependencies'),
    'json',
    asString(raw.title || raw.name),
    packages,
    edges,
    []
  );
}

function parseXml(xml: string, fileName: string): DepDataset {
  const root = /<(?:dependencies|packages|graph)\b([^>]*)>/i.exec(xml);
  const a = attrs(root?.[1] || '');
  const name = a.name || fileName.replace(/\.[^.]+$/, '') || 'Dependencies';
  const packages: DepPackage[] = [];
  const edges: DepEdge[] = [];
  const pkgRe =
    /<(?:[\w.-]+:)?package\b([^>]*?)\/>|<(?:[\w.-]+:)?package\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?package>/gi;
  let match: RegExpExecArray | null;
  while ((match = pkgRe.exec(xml))) {
    const pa = attrs(match[1] || match[2] || '');
    const id = pa.id || pa.name || '';
    if (!id) continue;
    upsertPackage(packages, {
      id,
      name: pa.name || id,
      version: pa.version || '',
      kind: pa.kind === 'root' || pa.kind === 'direct' ? pa.kind : 'transitive'
    });
  }
  const edgeRe =
    /<(?:[\w.-]+:)?(?:edge|dep|depends)\b([^>]*?)\/>|<(?:[\w.-]+:)?(?:edge|dep|depends)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:edge|dep|depends)>/gi;
  while ((match = edgeRe.exec(xml))) {
    const ea = attrs(match[1] || match[2] || '');
    if (!ea.source || !ea.target) continue;
    upsertPackage(packages, { id: ea.source });
    upsertPackage(packages, { id: ea.target });
    addEdge(edges, ea.source, ea.target, ea.spec || ea.label || '');
  }
  if (!packages.length) throw new Error('Dependency XML contains no packages');
  return finishDataset(name, 'xml', name, packages, edges, []);
}

function parseEdgeList(text: string, fileName: string, sourceKind: DepSourceKind): DepDataset {
  const packages: DepPackage[] = [];
  const edges: DepEdge[] = [];
  const lineRe = /(?:"([^"]+)"|([A-Za-z_@][\w./@-]*)|\S+)\s*(?:->|=>|:)\s*(?:"([^"]+)"|([A-Za-z_@][\w./@-]*)|\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(text))) {
    const source = (match[1] || match[2] || '').replace(/[,;]$/, '');
    const target = (match[3] || match[4] || '').replace(/[,;]$/, '');
    if (!source || !target || source === '->') continue;
    upsertPackage(packages, { id: source, name: source, kind: packages.length ? 'transitive' : 'root' });
    upsertPackage(packages, { id: target, name: target });
    addEdge(edges, source, target);
  }
  if (!packages.length) throw new Error('Dependency graph contains no packages');
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Dependencies';
  return finishDataset(fromFile, sourceKind, fromFile, packages, edges, []);
}

export function parseDependencyGraphText(text: string, fileName = ''): DepDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Dependency graph file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  const base = fileName.split(/[/\\]/).pop()?.toLowerCase() || '';
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid dependency JSON');
    }
    const obj = rec(Array.isArray(parsed) ? parsed[0] : parsed);
    if (obj.lockfileVersion != null || rec(obj.packages)[''] || rec(obj.packages)['.']) {
      return parsePackageLock(obj, fileName, base.includes('package-lock') || obj.lockfileVersion != null ? 'lock' : 'json');
    }
    if ((obj.dependencies || obj.devDependencies) && !Array.isArray(obj.packages) && !Array.isArray(obj.edges)) {
      return parsePackageJson(obj, fileName);
    }
    return parseGenericJson(obj, fileName);
  }
  if (looksLikeXml(raw) || (ext === 'xml' && looksLikeXml(raw))) return parseXml(raw, fileName);
  if (base === 'yarn.lock' || /^# yarn lockfile/i.test(raw) || (ext === 'lock' && /version\s+"/.test(raw))) {
    return parseYarnLock(raw, fileName);
  }
  const extracted = extractFence(raw);
  const sourceKind: DepSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : ext === 'dot' ? 'dot' : 'lock';
  if (/->|=>/.test(extracted.source) || /^\S+\s*:\s*\S+/m.test(extracted.source)) {
    return parseEdgeList(extracted.source, fileName, sourceKind);
  }
  throw new Error('Not a dependency graph');
}

export function parseDependencyGraphBytes(bytes: Uint8Array, fileName = ''): DepDataset {
  if (!bytes.length) throw new Error('Dependency graph file is empty');
  return parseDependencyGraphText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterDepPackages(packages: DepPackage[], query: string): DepPackage[] {
  const q = query.trim().toLowerCase();
  if (!q) return packages;
  const tokens = q.split(/\s+/).filter(Boolean);
  return packages.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('pkg:') || token.startsWith('package:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('kind:')) return p.kind === token.slice(5);
      return `${p.id} ${p.name} ${p.version} ${p.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterDepEdges(edges: DepEdge[], query: string): DepEdge[] {
  const q = query.trim().toLowerCase();
  if (!q) return edges;
  const tokens = q.split(/\s+/).filter(Boolean);
  return edges.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('from:')) return e.sourceName.toLowerCase().includes(token.slice(5)) || e.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return e.targetName.toLowerCase().includes(token.slice(3)) || e.target.toLowerCase().includes(token.slice(3));
      return `${e.source} ${e.target} ${e.sourceName} ${e.targetName} ${e.spec}`.toLowerCase().includes(token);
    })
  );
}

export function filterDepCycles(cycles: DepCycle[], query: string): DepCycle[] {
  const q = query.trim().toLowerCase();
  if (!q) return cycles;
  const tokens = q.split(/\s+/).filter(Boolean);
  return cycles.filter((c) => tokens.every((token) => c.path.toLowerCase().includes(token.replace(/^cycle:/, ''))));
}

export function filterDepTree(tree: DepTreeRow[], query: string): DepTreeRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tree.filter((row) =>
    tokens.every((token) => `${row.id} ${row.name} ${row.version}`.toLowerCase().includes(token.replace(/^(?:pkg|package|name):/, '')))
  );
}
