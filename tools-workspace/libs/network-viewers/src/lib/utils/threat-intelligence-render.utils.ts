import type { ThreatStat } from '../types/threat-intelligence-viewer.types';

const TYPE_COLORS: Record<string, string> = {
  domain: '#7c3aed',
  ip: '#2563eb',
  url: '#0ea5e9',
  email: '#4338ca',
  sha256: '#be123c',
  sha1: '#9f1239',
  md5: '#e11d48',
  hash: '#be123c',
  mutex: '#0f766e',
  registry: '#b45309'
};

const REL_COLORS: Record<string, string> = {
  indicates: '#0ea5e9',
  uses: '#f97316',
  'attributed-to': '#a78bfa',
  'related-to': '#94a3b8',
  mitigates: '#22c55e',
  targets: '#ef4444'
};

const KIND_COLORS: Record<string, string> = {
  'threat-actor': '#f97316',
  'intrusion-set': '#fb7185',
  malware: '#be123c',
  campaign: '#eab308',
  identity: '#38bdf8',
  'attack-pattern': '#a78bfa',
  tool: '#64748b',
  vulnerability: '#ef4444'
};

export function threatIndicatorTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? '#38bdf8';
}

export function threatRelationshipColor(type: string): string {
  return REL_COLORS[type] ?? '#60a5fa';
}

export function threatObjectKindColor(kind: string): string {
  return KIND_COLORS[kind] ?? '#94a3b8';
}

export function renderThreatIndicatorTypes(canvas: HTMLCanvasElement, types: ThreatStat[], selected: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!types.length) return;
  const pad = 24;
  const max = Math.max(...types.map((t) => t.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / types.length));
  types.forEach((type, i) => {
    const y = pad + i * rowH;
    if (type.name === selected) {
      ctx.fillStyle = 'rgba(12, 74, 110, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${type.name} (${type.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 140) * type.count) / max;
    ctx.fillStyle = threatIndicatorTypeColor(type.name);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}

export function renderThreatRelationships(canvas: HTMLCanvasElement, types: ThreatStat[], selected: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!types.length) return;
  const pad = 24;
  const max = Math.max(...types.map((t) => t.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / types.length));
  types.forEach((type, i) => {
    const y = pad + i * rowH;
    if (type.name === selected) {
      ctx.fillStyle = 'rgba(12, 74, 110, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${type.name} (${type.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 160) * type.count) / max;
    ctx.fillStyle = threatRelationshipColor(type.name);
    ctx.fillRect(pad + 150, y, Math.max(4, w), 12);
  });
}
