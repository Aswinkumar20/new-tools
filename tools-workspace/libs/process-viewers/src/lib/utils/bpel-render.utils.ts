import type { BpelActivity, BpelPartner, BpelStat } from '../types/bpel-viewer.types';

const KIND_COLORS: Record<string, string> = {
  receive: '#22c55e',
  reply: '#38bdf8',
  invoke: '#a78bfa',
  assign: '#f59e0b',
  if: '#fb7185',
  elseif: '#f472b6',
  else: '#94a3b8',
  while: '#14b8a6',
  sequence: '#0ea5e9',
  flow: '#f97316',
  throw: '#f43f5e',
  wait: '#64748b',
  pick: '#eab308',
  scope: '#6366f1'
};

export function bpelKindColor(kind: string): string {
  return KIND_COLORS[kind] ?? '#94a3b8';
}

export function renderBpelKinds(canvas: HTMLCanvasElement, kinds: BpelStat[], selected: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!kinds.length) return;
  const pad = 24;
  const max = Math.max(...kinds.map((k) => k.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / kinds.length));
  kinds.forEach((k, i) => {
    const y = pad + i * rowH;
    if (k.name === selected) {
      ctx.fillStyle = 'rgba(67, 56, 202, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${k.name} (${k.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 160) * k.count) / max;
    ctx.fillStyle = bpelKindColor(k.name);
    ctx.fillRect(pad + 150, y, Math.max(4, w), 12);
  });
}

export function renderBpelPartners(canvas: HTMLCanvasElement, partners: BpelPartner[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!partners.length) return;
  const pad = 24;
  const max = Math.max(...partners.map((p) => p.activityCount), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / partners.length));
  partners.forEach((p, i) => {
    const y = pad + i * rowH;
    if (p.id === selectedId) {
      ctx.fillStyle = 'rgba(67, 56, 202, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${p.name} (${p.activityCount})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 180) * p.activityCount) / max;
    ctx.fillStyle = '#818cf8';
    ctx.fillRect(pad + 170, y, Math.max(p.activityCount ? 4 : 0, w), 12);
  });
}

export function renderBpelOrchestration(canvas: HTMLCanvasElement, activities: BpelActivity[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!activities.length) return;
  const pad = 20;
  const rowH = Math.min(28, Math.max(18, (canvas.height - pad * 2) / activities.length));
  activities.forEach((a, i) => {
    const y = pad + i * rowH;
    const x = pad + Math.min(a.depth, 8) * 14;
    if (a.id === selectedId) {
      ctx.fillStyle = 'rgba(67, 56, 202, 0.4)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = bpelKindColor(a.kind);
    ctx.fillRect(x, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${a.kind} · ${a.name}`, x + 16, y + 10);
  });
}
