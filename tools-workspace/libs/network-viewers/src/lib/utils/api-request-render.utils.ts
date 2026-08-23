import type { ApiCall } from '../types/api-request-viewer.types';
import { methodColor, statusColor } from './http-trace-render.utils';

export { methodColor, statusColor };

export function renderApiMethodBars(canvas: HTMLCanvasElement, calls: ApiCall[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const counts = new Map<string, { count: number; errors: number }>();
  for (const call of calls) {
    const rec = counts.get(call.method) ?? { count: 0, errors: 0 };
    rec.count += 1;
    if (call.status >= 400) rec.errors += 1;
    counts.set(call.method, rec);
  }
  const rows = [...counts.entries()];
  if (!rows.length) return;
  const pad = 24;
  const max = Math.max(...rows.map(([, v]) => v.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / rows.length));
  rows.forEach(([method, rec], i) => {
    const y = pad + i * rowH;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${method} (${rec.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 140) * rec.count) / max;
    ctx.fillStyle = methodColor(method);
    ctx.fillRect(pad + 120, y, Math.max(4, w), 12);
    if (rec.errors) {
      ctx.fillStyle = '#fb7185';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${rec.errors} err`, pad + 128 + w, y + 11);
    }
  });
}
