import type { NmapHost, NmapStat } from '../types/nmap-report-viewer.types';

const STATE_COLORS: Record<string, string> = {
  open: '#22c55e',
  closed: '#94a3b8',
  filtered: '#f97316',
  unknown: '#64748b'
};

const SVC_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#fb7185', '#2dd4bf', '#a78bfa', '#f97316'];

export function nmapStateColor(state: string): string {
  return STATE_COLORS[state] ?? '#e2e8f0';
}

export function nmapServiceColor(name: string, index = 0): string {
  return SVC_COLORS[Math.abs(index) % SVC_COLORS.length];
}

export function renderNmapHosts(canvas: HTMLCanvasElement, hosts: NmapHost[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!hosts.length) return;
  const pad = 24;
  const max = Math.max(...hosts.map((h) => Math.max(h.openCount, h.ports.length)), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / hosts.length));
  hosts.forEach((h, i) => {
    const y = pad + i * rowH;
    if (h.id === selectedId) {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.18)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${h.hostname || h.ip} (${h.openCount} open)`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 180) * h.openCount) / max;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(pad + 170, y, Math.max(4, w), 12);
  });
}

export function renderNmapServices(canvas: HTMLCanvasElement, services: NmapStat[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!services.length) return;
  const pad = 24;
  const max = Math.max(...services.map((s) => s.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / services.length));
  services.forEach((s, i) => {
    const y = pad + i * rowH;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${s.name} (${s.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 140) * s.count) / max;
    ctx.fillStyle = nmapServiceColor(s.name, i);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}
