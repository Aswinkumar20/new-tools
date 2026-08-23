import type { TraceAttributeStat, TraceCase, TraceStep } from '../types/trace-explorer.types';

export function traceExplorerColor(index: number): string {
  const colors = ['#fb923c', '#f97316', '#22c55e', '#38bdf8', '#a78bfa', '#f43f5e'];
  return colors[index % colors.length];
}

export function renderTracePaths(canvas: HTMLCanvasElement, traces: TraceCase[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!traces.length) return;
  const pad = 24;
  const rowH = Math.min(40, Math.max(26, (canvas.height - pad * 2) / traces.length));
  traces.forEach((t, i) => {
    const y = pad + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(194, 65, 12, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${t.caseId} · ${t.events} steps`, pad, y + 14);
    const max = Math.max(...traces.map((x) => x.events), 1);
    ctx.fillStyle = traceExplorerColor(i);
    ctx.fillRect(pad + 160, y, Math.max(4, ((canvas.width - pad * 2 - 170) * t.events) / max), 10);
  });
}

export function renderTraceAttributes(
  canvas: HTMLCanvasElement,
  attributes: TraceAttributeStat[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!attributes.length) return;
  const pad = 24;
  const rowH = Math.min(48, Math.max(30, (canvas.height - pad * 2) / attributes.length));
  attributes.forEach((a, i) => {
    const y = pad + i * rowH;
    if (a.id === selectedId) {
      ctx.fillStyle = 'rgba(194, 65, 12, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${a.key} (${a.distinct} values)`, pad, y + 14);
    const top = a.values[0];
    if (top) {
      ctx.fillStyle = traceExplorerColor(i);
      ctx.fillRect(pad + 180, y, Math.max(4, ((canvas.width - pad * 2 - 190) * top.pct) / 100), 10);
    }
  });
}

export function renderTraceSteps(canvas: HTMLCanvasElement, steps: TraceStep[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!steps.length) return;
  const visible = steps.slice(0, 40);
  const pad = 24;
  const rowH = Math.min(34, Math.max(22, (canvas.height - pad * 2) / visible.length));
  visible.forEach((s, i) => {
    const y = pad + i * rowH;
    if (s.id === selectedId) {
      ctx.fillStyle = 'rgba(194, 65, 12, 0.4)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${s.caseId} · ${s.step}. ${s.activity}${s.resource ? ` (${s.resource})` : ''}`, pad, y + 12);
  });
}
