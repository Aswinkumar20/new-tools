import type { DnsQuery, DnsTypeStat } from '../types/dns-log-viewer.types';

const TYPE_COLORS: Record<string, string> = {
  A: '#38bdf8',
  AAAA: '#818cf8',
  MX: '#34d399',
  TXT: '#fbbf24',
  PTR: '#fb7185',
  CNAME: '#a78bfa',
  NS: '#2dd4bf',
  SOA: '#f97316',
  SRV: '#94a3b8',
  ANY: '#e2e8f0'
};

const RCODE_COLORS: Record<string, string> = {
  NOERROR: '#22c55e',
  NXDOMAIN: '#f97316',
  SERVFAIL: '#ef4444',
  REFUSED: '#fb7185',
  '—': '#64748b'
};

export function dnsQtypeColor(qtype: string): string {
  return TYPE_COLORS[qtype.toUpperCase()] ?? '#94a3b8';
}

export function dnsRcodeColor(rcode: string): string {
  return RCODE_COLORS[rcode.toUpperCase()] ?? '#94a3b8';
}

export function renderDnsTypes(canvas: HTMLCanvasElement, types: DnsTypeStat[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!types.length) return;
  const pad = 24;
  const max = Math.max(...types.map((t) => t.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / types.length));
  types.forEach((t, i) => {
    const y = pad + i * rowH;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${t.name} (${t.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 140) * t.count) / max;
    ctx.fillStyle = dnsQtypeColor(t.name);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}

export function renderDnsTimeline(
  canvas: HTMLCanvasElement,
  queries: DnsQuery[],
  selectedId: string | null,
  durationMs: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!queries.length) return;
  const pad = 28;
  const maxT = Math.max(durationMs, 1);
  const w = canvas.width - pad * 2;
  const y = canvas.height / 2;
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(pad + w, y);
  ctx.stroke();
  queries.forEach((q) => {
    const x = pad + (q.relMs / maxT) * w;
    ctx.fillStyle = q.rcode && q.rcode !== 'NOERROR' ? dnsRcodeColor(q.rcode) : dnsQtypeColor(q.qtype);
    ctx.beginPath();
    ctx.arc(x, y, q.id === selectedId ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText('0 ms', pad, canvas.height - 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(maxT)} ms`, pad + w, canvas.height - 10);
  ctx.textAlign = 'left';
}
