import type { SyslogMessage, SyslogStat } from '../types/syslog-viewer.types';

const SEV_COLORS: Record<string, string> = {
  emerg: '#ef4444',
  alert: '#f97316',
  crit: '#fb7185',
  err: '#f59e0b',
  warning: '#eab308',
  notice: '#38bdf8',
  info: '#94a3b8',
  debug: '#64748b'
};

const FAC_COLORS = ['#34d399', '#2dd4bf', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#fb7185', '#fbbf24'];

export function syslogSeverityColor(severity: string): string {
  return SEV_COLORS[severity] ?? '#e2e8f0';
}

export function syslogFacilityColor(name: string, index = 0): string {
  return FAC_COLORS[Math.abs(index) % FAC_COLORS.length] ?? '#34d399';
}

export function renderSyslogSeverity(canvas: HTMLCanvasElement, severities: SyslogStat[]): void {
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
    ctx.fillStyle = syslogSeverityColor(s.name);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}

export function renderSyslogFacilities(canvas: HTMLCanvasElement, facilities: SyslogStat[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!facilities.length) return;
  const pad = 24;
  const max = Math.max(...facilities.map((f) => f.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / facilities.length));
  facilities.forEach((f, i) => {
    const y = pad + i * rowH;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${f.name} (${f.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 140) * f.count) / max;
    ctx.fillStyle = syslogFacilityColor(f.name, i);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}

export function renderSyslogTimeline(
  canvas: HTMLCanvasElement,
  messages: SyslogMessage[],
  selectedId: string | null,
  durationMs: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!messages.length) return;
  const pad = 28;
  const maxT = Math.max(durationMs, 1);
  const w = canvas.width - pad * 2;
  const y = canvas.height / 2;
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(pad + w, y);
  ctx.stroke();
  messages.forEach((m) => {
    const x = pad + (m.relMs / maxT) * w;
    ctx.fillStyle = syslogSeverityColor(m.severity);
    ctx.beginPath();
    ctx.arc(x, y, m.id === selectedId ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
}
