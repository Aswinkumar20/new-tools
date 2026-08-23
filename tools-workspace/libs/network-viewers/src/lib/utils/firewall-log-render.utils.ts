import type { FirewallActionStat, FirewallEvent } from '../types/firewall-log-viewer.types';

const ACTION_COLORS: Record<string, string> = {
  allow: '#22c55e',
  deny: '#ef4444',
  drop: '#f97316',
  reject: '#fb7185',
  nat: '#38bdf8',
  unknown: '#94a3b8'
};

export function actionColor(action: string): string {
  return ACTION_COLORS[action] ?? '#e2e8f0';
}

export function renderFirewallTimeline(
  canvas: HTMLCanvasElement,
  events: FirewallEvent[],
  selectedId: string | null,
  durationMs: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!events.length) return;
  const pad = 28;
  const maxT = Math.max(durationMs, 1);
  const w = canvas.width - pad * 2;
  const y = canvas.height / 2;
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(pad + w, y);
  ctx.stroke();
  events.forEach((e) => {
    const x = pad + (e.relMs / maxT) * w;
    ctx.fillStyle = actionColor(e.action);
    ctx.beginPath();
    ctx.arc(x, y, e.id === selectedId ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText('0 ms', pad, canvas.height - 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(maxT)} ms`, pad + w, canvas.height - 10);
  ctx.textAlign = 'left';
}

export function renderFirewallActions(canvas: HTMLCanvasElement, actions: FirewallActionStat[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!actions.length) return;
  const pad = 24;
  const max = Math.max(...actions.map((a) => a.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / actions.length));
  actions.forEach((a, i) => {
    const y = pad + i * rowH;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${a.name} (${a.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 140) * a.count) / max;
    ctx.fillStyle = actionColor(a.name);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}
