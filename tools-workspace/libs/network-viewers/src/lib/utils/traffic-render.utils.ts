import type { TrafficProtocolStat, TrafficTalker } from '../types/network-traffic-viewer.types';

const COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#a78bfa', '#fb7185', '#94a3b8', '#f97316'];

export function renderTrafficBars(
  canvas: HTMLCanvasElement,
  rows: Array<{ label: string; value: number }>,
  color = '#38bdf8'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) return;
  const pad = 20;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const rowH = Math.min(36, Math.max(22, (canvas.height - pad * 2) / rows.length));
  rows.forEach((row, i) => {
    const y = pad + i * rowH;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(row.label, pad, y + 12);
    const w = ((canvas.width - pad * 2 - 140) * row.value) / max;
    ctx.fillStyle = COLORS[i % COLORS.length] || color;
    ctx.fillRect(pad + 130, y, Math.max(row.value ? 3 : 0, w), 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(String(row.value), pad + 136 + Math.max(w, 0), y + 11);
  });
}

export function protocolBarRows(stats: TrafficProtocolStat[]): Array<{ label: string; value: number }> {
  return stats.map((s) => ({ label: `${s.name} (${s.packets})`, value: s.bytes }));
}

export function talkerBarRows(talkers: TrafficTalker[], limit = 12): Array<{ label: string; value: number }> {
  return talkers.slice(0, limit).map((t) => ({ label: t.host, value: t.bytes }));
}
