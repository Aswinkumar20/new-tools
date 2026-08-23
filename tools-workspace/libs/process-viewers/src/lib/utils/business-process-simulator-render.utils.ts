import type { BpsimEdge, BpsimNode, BpsimScenario, BpsimStep } from '../types/business-process-simulator.types';

export function bpsimNodeColor(kind: string, enabled: boolean, tokens: number): string {
  if (enabled) return '#22c55e';
  if (tokens > 0) return '#f59e0b';
  if (kind === 'start') return '#38bdf8';
  if (kind === 'end') return '#f43f5e';
  if (kind === 'gateway') return '#a78bfa';
  if (kind === 'place') return '#fb7185';
  if (kind === 'transition') return '#64748b';
  return '#94a3b8';
}

export function bpsimScenarioColor(index: number): string {
  const colors = ['#f59e0b', '#38bdf8', '#34d399', '#a78bfa', '#f472b6'];
  return colors[index % colors.length];
}

export function renderBpsimGraph(
  canvas: HTMLCanvasElement,
  nodes: BpsimNode[],
  edges: BpsimEdge[],
  marking: Record<string, number>,
  enabledIds: ReadonlyArray<string>,
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) return;
  const enabled = new Set(enabledIds);
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 28;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(nodes.map((n) => [n.id, { x: mapX(n.x), y: mapY(n.y) }] as const));
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (e.label) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(e.label.slice(0, 16), (a.x + b.x) / 2, (a.y + b.y) / 2 - 4);
    }
  }
  for (const n of nodes) {
    const p = pos.get(n.id);
    if (!p) continue;
    const tokens = marking[n.id] ?? 0;
    ctx.fillStyle = n.id === selectedId ? '#fde68a' : bpsimNodeColor(n.kind, enabled.has(n.id), tokens);
    if (n.kind === 'gateway') {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 12);
      ctx.lineTo(p.x + 12, p.y);
      ctx.lineTo(p.x, p.y + 12);
      ctx.lineTo(p.x - 12, p.y);
      ctx.closePath();
      ctx.fill();
    } else if (n.kind === 'place') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - 14, p.y - 10, 28, 20);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${n.name.slice(0, 14)}${tokens ? ` · ${tokens}` : ''}`, p.x - 20, p.y + 24);
  }
}

export function renderBpsimTokens(
  canvas: HTMLCanvasElement,
  nodes: BpsimNode[],
  marking: Record<string, number>,
  enabledIds: ReadonlyArray<string>,
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const list = nodes.filter((n) => n.kind !== 'transition').slice(0, 12);
  if (!list.length) return;
  const enabled = new Set(enabledIds);
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / list.length));
  list.forEach((n, i) => {
    const y = 16 + i * rowH;
    const tokens = marking[n.id] ?? 0;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(180, 83, 9, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = bpsimNodeColor(n.kind, enabled.has(n.id), tokens);
    ctx.fillRect(16, y, Math.max(4, tokens * 18), 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${n.name} · ${tokens}`, 16 + Math.max(4, tokens * 18) + 8, y + 11);
  });
}

export function renderBpsimScenarios(
  canvas: HTMLCanvasElement,
  scenarios: BpsimScenario[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!scenarios.length) return;
  const rowH = Math.min(44, Math.max(28, (canvas.height - 24) / scenarios.length));
  scenarios.forEach((s, i) => {
    const y = 16 + i * rowH;
    if (s.id === selectedId) {
      ctx.fillStyle = 'rgba(180, 83, 9, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = bpsimScenarioColor(i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(s.name, 36, y + 11);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(s.description || `${Object.keys(s.marking).length} tokens`, 36, y + 24);
  });
}

export function renderBpsimTrace(canvas: HTMLCanvasElement, trace: BpsimStep[], selectedStep: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!trace.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('Fire an enabled step to start the trace.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / trace.length));
  trace.forEach((step, i) => {
    const y = 16 + i * rowH;
    if (step.step === selectedStep) {
      ctx.fillStyle = 'rgba(180, 83, 9, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Step ${step.step} · ${step.nodeName}`, 32, y + 11);
  });
}
