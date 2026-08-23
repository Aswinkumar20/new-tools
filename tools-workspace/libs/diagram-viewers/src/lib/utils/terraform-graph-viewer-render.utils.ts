import type { TfEdge, TfResource } from '../types/terraform-graph-viewer.types';

export function tfResourceColor(type: string, index: number): string {
  if (type === 'provider') return '#fdba74';
  if (type.startsWith('aws_')) return '#fb923c';
  if (type.startsWith('google_') || type.startsWith('gcp_')) return '#fcd34d';
  if (type.startsWith('azurerm_') || type.startsWith('azure_')) return '#7dd3fc';
  const colors = ['#fdba74', '#fb923c', '#f97316', '#fed7aa', '#ea580c'];
  return colors[index % colors.length];
}

export function renderTfDiagram(
  canvas: HTMLCanvasElement,
  resources: TfResource[],
  edges: TfEdge[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!resources.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No resources in this Terraform graph.', 16, 28);
    return;
  }
  const xs = resources.map((r) => r.x);
  const ys = resources.map((r) => r.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 48;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(resources.map((r) => [r.id, { x: mapX(r.x), y: mapY(r.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (e.label) {
      ctx.fillStyle = '#fed7aa';
      ctx.font = '10px sans-serif';
      ctx.fillText(e.label.slice(0, 18), (a.x + b.x) / 2 - 12, (a.y + b.y) / 2 - 4);
    }
  }
  resources.forEach((resource, i) => {
    const p = pos.get(resource.id);
    if (!p) return;
    ctx.fillStyle = resource.id === selectedId ? '#ffedd5' : tfResourceColor(resource.type, i);
    ctx.fillRect(p.x - 58, p.y - 18, 116, 36);
    ctx.fillStyle = '#7c2d12';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(resource.name.slice(0, 16), p.x - 52, p.y - 2);
    ctx.font = '10px sans-serif';
    ctx.fillText(resource.type.slice(0, 18), p.x - 52, p.y + 12);
  });
}

export function renderTfResources(canvas: HTMLCanvasElement, resources: TfResource[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!resources.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching resources in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / resources.length));
  resources.forEach((r, i) => {
    const y = 16 + i * rowH;
    if (r.id === selectedId) {
      ctx.fillStyle = 'rgba(124, 45, 18, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = tfResourceColor(r.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${r.name} · ${r.type}`, 36, y + 11);
  });
}

export function renderTfEdges(canvas: HTMLCanvasElement, edges: TfEdge[], selectedId: string | null): void {
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
      ctx.fillStyle = 'rgba(124, 45, 18, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.sourceName} → ${e.targetName}${e.label ? ` · ${e.label}` : ''}`, 32, y + 11);
  });
}
