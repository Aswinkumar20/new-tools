import type { HttpTraceExchange } from '../types/http-trace-viewer.types';
import { statusColor } from './har-render.utils';

export { statusColor };

export function methodColor(method: string): string {
  const map: Record<string, string> = {
    GET: '#38bdf8',
    POST: '#22c55e',
    PUT: '#f59e0b',
    PATCH: '#a855f7',
    DELETE: '#fb7185',
    HEAD: '#94a3b8',
    OPTIONS: '#64748b'
  };
  return map[method] ?? '#e2e8f0';
}

export function renderHttpTraceTimeline(
  canvas: HTMLCanvasElement,
  exchanges: HttpTraceExchange[],
  selectedId: string | null,
  totalDurationMs: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!exchanges.length) return;
  const pad = 24;
  const labelW = 210;
  const span = Math.max(totalDurationMs, 1);
  const rowH = Math.min(36, Math.max(22, (canvas.height - pad * 2) / exchanges.length));
  exchanges.forEach((e, i) => {
    const y = pad + i * rowH;
    if (e.id === selectedId) {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = statusColor(e.status);
    ctx.fillRect(pad, y, 6, rowH - 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.method} ${e.path}`.slice(0, 28), pad + 12, y + 12);
    const x = labelW + (e.startMs / span) * (canvas.width - labelW - pad);
    const w = Math.max(4, (Math.max(e.durationMs, 1) / span) * (canvas.width - labelW - pad));
    ctx.fillStyle = methodColor(e.method);
    ctx.fillRect(x, y + 4, w, 10);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${e.status || '—'} · ${Math.round(e.durationMs)} ms`, x + w + 8, y + 13);
  });
}
