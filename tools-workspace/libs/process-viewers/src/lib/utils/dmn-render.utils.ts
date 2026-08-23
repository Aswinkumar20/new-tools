import type { DmnDrdNode, DmnStat } from '../types/dmn-viewer.types';

const POLICY_COLORS: Record<string, string> = {
  UNIQUE: '#0ea5e9',
  FIRST: '#f97316',
  PRIORITY: '#a78bfa',
  ANY: '#22c55e',
  COLLECT: '#eab308',
  'RULE ORDER': '#38bdf8',
  'OUTPUT ORDER': '#fb7185'
};

const KIND_COLORS: Record<string, string> = {
  decision: '#14b8a6',
  input: '#38bdf8',
  knowledge: '#f59e0b'
};

export function dmnHitPolicyColor(policy: string): string {
  const key = policy.toUpperCase();
  if (key.startsWith('COLLECT')) return POLICY_COLORS.COLLECT;
  return POLICY_COLORS[key] ?? '#94a3b8';
}

export function dmnNodeKindColor(kind: string): string {
  return KIND_COLORS[kind] ?? '#94a3b8';
}

export function renderDmnHitPolicies(canvas: HTMLCanvasElement, policies: DmnStat[], selected: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!policies.length) return;
  const pad = 24;
  const max = Math.max(...policies.map((p) => p.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / policies.length));
  policies.forEach((p, i) => {
    const y = pad + i * rowH;
    if (p.name === selected) {
      ctx.fillStyle = 'rgba(15, 118, 110, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${p.name} (${p.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 160) * p.count) / max;
    ctx.fillStyle = dmnHitPolicyColor(p.name);
    ctx.fillRect(pad + 150, y, Math.max(4, w), 12);
  });
}

export function renderDmnDrd(canvas: HTMLCanvasElement, nodes: DmnDrdNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) return;
  const pad = 24;
  const max = Math.max(nodes.length, 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / max));
  nodes.forEach((n, i) => {
    const y = pad + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(15, 118, 110, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${n.name} · ${n.kind}`, pad, y + 14);
    ctx.fillStyle = dmnNodeKindColor(n.kind);
    ctx.fillRect(canvas.width - pad - 80, y, 72, 12);
  });
}
