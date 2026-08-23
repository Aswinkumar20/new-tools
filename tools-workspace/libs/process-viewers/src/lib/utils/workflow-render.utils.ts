import type { WorkflowEdge, WorkflowNode, WorkflowStat } from '../types/workflow-diagram-viewer.types';

const KIND_COLORS: Record<string, string> = {
  start: '#22c55e',
  end: '#f43f5e',
  task: '#38bdf8',
  decision: '#f59e0b',
  fork: '#a78bfa',
  join: '#818cf8',
  event: '#fb7185',
  subprocess: '#14b8a6'
};

export function workflowKindColor(kind: string): string {
  return KIND_COLORS[kind] ?? '#94a3b8';
}

export function renderWorkflowKinds(canvas: HTMLCanvasElement, kinds: WorkflowStat[], selected: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!kinds.length) return;
  const pad = 24;
  const max = Math.max(...kinds.map((k) => k.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / kinds.length));
  kinds.forEach((k, i) => {
    const y = pad + i * rowH;
    if (k.name === selected) {
      ctx.fillStyle = 'rgba(190, 24, 93, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${k.name} (${k.count})`, pad, y + 14);
    ctx.fillStyle = workflowKindColor(k.name);
    ctx.fillRect(pad + 150, y, Math.max(4, ((canvas.width - pad * 2 - 160) * k.count) / max), 12);
  });
}

export function renderWorkflowEdges(canvas: HTMLCanvasElement, edges: WorkflowEdge[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!edges.length) return;
  const pad = 24;
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / edges.length));
  edges.forEach((e, i) => {
    const y = pad + i * rowH;
    if (e.id === selectedId) {
      ctx.fillStyle = 'rgba(190, 24, 93, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${e.sourceName} → ${e.targetName}${e.label ? ` (${e.label})` : ''}`, pad, y + 14);
    ctx.fillStyle = '#fb7185';
    ctx.fillRect(canvas.width - pad - 72, y, 64, 12);
  });
}

export function renderWorkflowDiagram(
  canvas: HTMLCanvasElement,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) return;
  const laid = layoutNodes(nodes, canvas.width, canvas.height);
  const byId = new Map(laid.map((n) => [n.id, n]));
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 1.5;
  for (const e of edges) {
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const n of laid) {
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(190, 24, 93, 0.4)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = workflowKindColor(n.kind);
    if (n.kind === 'decision') {
      ctx.beginPath();
      ctx.moveTo(n.x, n.y - 14);
      ctx.lineTo(n.x + 14, n.y);
      ctx.lineTo(n.x, n.y + 14);
      ctx.lineTo(n.x - 14, n.y);
      ctx.closePath();
      ctx.fill();
    } else if (n.kind === 'task' || n.kind === 'subprocess') {
      ctx.fillRect(n.x - 16, n.y - 10, 32, 20);
    } else {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.kind === 'start' || n.kind === 'end' ? 12 : 11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.name.slice(0, 22), n.x - 16, n.y + 26);
  }
}

function layoutNodes(nodes: WorkflowNode[], width: number, height: number): Array<WorkflowNode & { x: number; y: number }> {
  const withPos = nodes.filter((n) => n.x || n.y);
  if (withPos.length >= Math.max(2, Math.floor(nodes.length * 0.5))) {
    const xs = withPos.map((n) => n.x);
    const ys = withPos.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs, minX + 1);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys, minY + 1);
    const pad = 28;
    return nodes.map((n) => ({
      ...n,
      x: pad + (((n.x || minX) - minX) / (maxX - minX)) * (width - pad * 2),
      y: pad + (((n.y || minY) - minY) / (maxY - minY)) * (height - pad * 2)
    }));
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const cellW = width / (cols + 0.5);
  const cellH = height / (Math.ceil(nodes.length / cols) + 0.5);
  return nodes.map((n, i) => ({
    ...n,
    x: cellW * (0.7 + (i % cols)),
    y: cellH * (0.7 + Math.floor(i / cols))
  }));
}
