import type { NessusHostStat, NessusSeverityStat } from '../types/nessus-report-viewer.types';

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#38bdf8',
  info: '#94a3b8'
};

export function nessusSeverityColor(severity: string): string {
  return SEV_COLORS[severity] ?? '#e2e8f0';
}

export function renderNessusSeverity(canvas: HTMLCanvasElement, severities: NessusSeverityStat[]): void {
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
    ctx.fillStyle = nessusSeverityColor(s.name);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}

export function renderNessusHosts(canvas: HTMLCanvasElement, hosts: NessusHostStat[], selectedName: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!hosts.length) return;
  const pad = 24;
  const max = Math.max(...hosts.map((h) => h.count), 1);
  const rowH = Math.min(48, Math.max(32, (canvas.height - pad * 2) / hosts.length));
  hosts.forEach((h, i) => {
    const y = pad + i * rowH;
    if (h.name === selectedName) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.18)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${h.name} (${h.count})`, pad, y + 12);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`crit ${h.critical} · high ${h.high} · med ${h.medium}`, pad, y + 28);
    const w = ((canvas.width - pad * 2 - 200) * h.count) / max;
    ctx.fillStyle = h.critical ? '#ef4444' : h.high ? '#f97316' : '#a78bfa';
    ctx.fillRect(pad + 190, y + 6, Math.max(4, w), 10);
  });
}
