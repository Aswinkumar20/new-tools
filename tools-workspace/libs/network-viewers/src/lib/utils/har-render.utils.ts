import type { HarEntry } from '../types/har-viewer.types';

const PHASES: Array<{ key: keyof HarEntry['timings']; color: string; label: string }> = [
  { key: 'blocked', color: '#a1a1aa', label: 'Blocked' },
  { key: 'dns', color: '#22c55e', label: 'DNS' },
  { key: 'connect', color: '#f97316', label: 'Connect' },
  { key: 'ssl', color: '#a855f7', label: 'TLS' },
  { key: 'send', color: '#38bdf8', label: 'Send' },
  { key: 'wait', color: '#f59e0b', label: 'Wait' },
  { key: 'receive', color: '#3b82f6', label: 'Receive' }
];

export function statusColor(status: number): string {
  if (status >= 500) return '#ef4444';
  if (status >= 400) return '#f97316';
  if (status >= 300) return '#38bdf8';
  if (status >= 200) return '#22c55e';
  return '#94a3b8';
}

export function renderHarWaterfall(
  canvas: HTMLCanvasElement,
  entries: HarEntry[],
  selectedId: string | null,
  totalTimeMs: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rowH = 22;
  const labelW = 220;
  const pad = 12;
  const span = Math.max(totalTimeMs, 1);
  canvas.height = Math.max(280, pad * 2 + 28 + entries.length * rowH);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText('0 ms', labelW, 16);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(span)} ms`, canvas.width - pad, 16);
  ctx.textAlign = 'left';
  entries.forEach((entry, i) => {
    const y = pad + 24 + i * rowH;
    if (entry.id === selectedId) {
      ctx.fillStyle = 'rgba(14, 165, 233, 0.18)';
      ctx.fillRect(0, y - 2, canvas.width, rowH);
    }
    ctx.fillStyle = statusColor(entry.status);
    ctx.fillRect(6, y + 5, 6, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    const label = `${entry.method} ${entry.path || entry.url}`.slice(0, 34);
    ctx.fillText(label, 16, y + 14);
    let x = labelW + (entry.startMs / span) * (canvas.width - labelW - pad);
    PHASES.forEach((phase) => {
      const dur = entry.timings[phase.key];
      if (dur <= 0) return;
      const w = Math.max(1, (dur / span) * (canvas.width - labelW - pad));
      ctx.fillStyle = phase.color;
      ctx.fillRect(x, y + 5, w, 10);
      x += w;
    });
  });
}

export function renderHarTimingBars(canvas: HTMLCanvasElement, entry: HarEntry | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!entry) return;
  const pad = 24;
  const max = Math.max(...PHASES.map((p) => entry.timings[p.key]), 1);
  const rowH = 28;
  PHASES.forEach((phase, i) => {
    const y = pad + i * rowH;
    const dur = entry.timings[phase.key];
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(phase.label, pad, y + 12);
    ctx.fillStyle = phase.color;
    const w = ((canvas.width - pad * 2 - 90) * dur) / max;
    ctx.fillRect(pad + 80, y, Math.max(dur > 0 ? 2 : 0, w), 14);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${dur.toFixed(0)} ms`, pad + 86 + Math.max(w, 0), y + 12);
  });
}
