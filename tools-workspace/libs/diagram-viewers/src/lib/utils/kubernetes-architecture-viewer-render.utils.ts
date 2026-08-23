import type { K8sLink, K8sService, K8sWorkload } from '../types/kubernetes-architecture-viewer.types';

export function k8sNodeColor(kind: string, index: number): string {
  const lower = kind.toLowerCase();
  if (lower === 'ingress') return '#c4b5fd';
  if (lower === 'service' || lower === 'endpoints') return '#93c5fd';
  if (lower === 'deployment') return '#6ee7b7';
  if (lower === 'statefulset') return '#67e8f9';
  if (lower === 'daemonset') return '#fcd34d';
  const colors = ['#6ee7b7', '#34d399', '#10b981', '#a7f3d0', '#059669'];
  return colors[index % colors.length];
}

export function renderK8sDiagram(
  canvas: HTMLCanvasElement,
  workloads: K8sWorkload[],
  services: K8sService[],
  links: K8sLink[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const nodes = [...workloads, ...services];
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No workloads or services in this manifest.', 16, 28);
    return;
  }
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 48;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(nodes.map((n) => [n.id, { x: mapX(n.x), y: mapY(n.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const l of links) {
    const a = pos.get(l.source);
    const b = pos.get(l.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#bfdbfe';
    ctx.font = '10px sans-serif';
    ctx.fillText(l.rel, (a.x + b.x) / 2 - 10, (a.y + b.y) / 2 - 4);
  }
  nodes.forEach((node, i) => {
    const p = pos.get(node.id);
    if (!p) return;
    ctx.fillStyle = node.id === selectedId ? '#e0f2fe' : k8sNodeColor(node.kind, i);
    ctx.fillRect(p.x - 58, p.y - 18, 116, 36);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(node.name.slice(0, 16), p.x - 52, p.y - 2);
    ctx.font = '10px sans-serif';
    ctx.fillText(node.kind.slice(0, 18), p.x - 52, p.y + 12);
  });
}

export function renderK8sWorkloads(canvas: HTMLCanvasElement, workloads: K8sWorkload[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!workloads.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching workloads in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / workloads.length));
  workloads.forEach((w, i) => {
    const y = 16 + i * rowH;
    if (w.id === selectedId) {
      ctx.fillStyle = 'rgba(37, 99, 235, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = k8sNodeColor(w.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${w.name} · ${w.kind} · ${w.replicas} replicas`, 36, y + 11);
  });
}

export function renderK8sServices(canvas: HTMLCanvasElement, services: K8sService[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!services.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching services in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / services.length));
  services.forEach((s, i) => {
    const y = 16 + i * rowH;
    if (s.id === selectedId) {
      ctx.fillStyle = 'rgba(37, 99, 235, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = k8sNodeColor(s.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${s.name} · ${s.kind}${s.ports ? ` · ${s.ports}` : ''}`, 36, y + 11);
  });
}

export function renderK8sLinks(canvas: HTMLCanvasElement, links: K8sLink[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!links.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching service links in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / links.length));
  links.forEach((l, i) => {
    const y = 16 + i * rowH;
    if (l.id === selectedId) {
      ctx.fillStyle = 'rgba(37, 99, 235, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${l.sourceName} ${l.rel} ${l.targetName}`, 32, y + 11);
  });
}
