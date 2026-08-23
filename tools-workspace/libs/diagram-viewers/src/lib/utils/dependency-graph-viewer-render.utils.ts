import type { DepCycle, DepEdge, DepPackage, DepTreeRow } from '../types/dependency-graph-viewer.types';

export function depPackageColor(kind: string, index: number): string {
  if (kind === 'root') return '#86efac';
  if (kind === 'direct') return '#4ade80';
  const colors = ['#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#166534'];
  return colors[index % colors.length];
}

export function renderDepDiagram(
  canvas: HTMLCanvasElement,
  packages: DepPackage[],
  edges: DepEdge[],
  selectedId: string | null,
  cyclicIds: Set<string>
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!packages.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No packages in this dependency graph.', 16, 28);
    return;
  }
  const xs = packages.map((p) => p.x);
  const ys = packages.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 48;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(packages.map((p) => [p.id, { x: mapX(p.x), y: mapY(p.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    const cyclic = cyclicIds.has(e.source) && cyclicIds.has(e.target);
    ctx.strokeStyle = cyclic ? '#f87171' : '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  packages.forEach((pkg, i) => {
    const p = pos.get(pkg.id);
    if (!p) return;
    ctx.fillStyle = pkg.id === selectedId ? '#dcfce7' : cyclicIds.has(pkg.id) ? '#fca5a5' : depPackageColor(pkg.kind, i);
    ctx.fillRect(p.x - 58, p.y - 18, 116, 36);
    ctx.fillStyle = '#14532d';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(pkg.name.slice(0, 16), p.x - 52, p.y - 2);
    ctx.font = '10px sans-serif';
    ctx.fillText((pkg.version || pkg.kind).slice(0, 18), p.x - 52, p.y + 12);
  });
}

export function renderDepTree(canvas: HTMLCanvasElement, tree: DepTreeRow[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!tree.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching tree rows in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / tree.length));
  tree.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (row.id === selectedId) {
      ctx.fillStyle = 'rgba(22, 101, 52, 0.45)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = row.cyclic ? '#fca5a5' : depPackageColor(row.depth === 0 ? 'root' : 'transitive', i);
    ctx.fillRect(16 + row.depth * 14, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name}${row.version ? `@${row.version}` : ''}${row.cyclic ? ' ↻' : ''}`, 34 + row.depth * 14, y + 10);
  });
}

export function renderDepCycles(canvas: HTMLCanvasElement, cycles: DepCycle[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!cycles.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No dependency cycles detected.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / cycles.length));
  cycles.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(185, 28, 28, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#f87171';
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(c.path, 36, y + 11);
  });
}

export function renderDepEdges(canvas: HTMLCanvasElement, edges: DepEdge[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!edges.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching edges in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / edges.length));
  edges.forEach((e, i) => {
    const y = 16 + i * rowH;
    if (e.id === selectedId) {
      ctx.fillStyle = 'rgba(22, 101, 52, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.sourceName} → ${e.targetName}${e.spec ? ` · ${e.spec}` : ''}`, 32, y + 11);
  });
}
