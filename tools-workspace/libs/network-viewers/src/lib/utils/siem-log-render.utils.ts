import type { SiemCorrelation, SiemEvent, SiemSeverityStat } from '../types/siem-log-viewer.types';

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#38bdf8',
  info: '#94a3b8'
};

export function severityColor(severity: string): string {
  return SEV_COLORS[severity] ?? '#e2e8f0';
}

export function renderSiemSeverity(canvas: HTMLCanvasElement, severities: SiemSeverityStat[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!severities.length) return;
  const pad = 24;
  const max = Math.max(...severities.map((s) => s.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / severities.length));
  severities.forEach((s, i) => {
    const y = pad + i * rowH;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${s.name} (${s.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 140) * s.count) / max;
    ctx.fillStyle = severityColor(s.name);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}

export function renderSiemCorrelations(canvas: HTMLCanvasElement, correlations: SiemCorrelation[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!correlations.length) return;
  const pad = 20;
  const rowH = Math.min(48, Math.max(32, (canvas.height - pad * 2) / correlations.length));
  correlations.forEach((c, i) => {
    const y = pad + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.18)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = severityColor(c.severity);
    ctx.fillRect(pad, y, 8, rowH - 14);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(c.label.slice(0, 48), pad + 16, y + 12);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${c.events} events · ${c.severity} · ${c.hosts.join(', ') || '—'}`, pad + 16, y + 28);
  });
}

export function renderSiemTimeline(canvas: HTMLCanvasElement, events: SiemEvent[], selectedId: string | null, durationMs: number): void {
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
    ctx.fillStyle = severityColor(e.severity);
    ctx.beginPath();
    ctx.arc(x, y, e.id === selectedId ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
}
