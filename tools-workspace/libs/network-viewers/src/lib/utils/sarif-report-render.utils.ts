import type { SarifLevelStat, SarifLocationStat, SarifRuleStat } from '../types/sarif-report-viewer.types';

const LEVEL_COLORS: Record<string, string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  note: '#38bdf8',
  none: '#94a3b8'
};

export function sarifLevelColor(level: string): string {
  return LEVEL_COLORS[level] ?? '#60a5fa';
}

export function renderSarifRules(canvas: HTMLCanvasElement, rules: SarifRuleStat[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rules.length) return;
  const pad = 24;
  const max = Math.max(...rules.map((r) => r.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / rules.length));
  rules.forEach((rule, i) => {
    const y = pad + i * rowH;
    if (rule.id === selectedId) {
      ctx.fillStyle = 'rgba(37, 99, 235, 0.22)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${rule.id} · ${rule.name} (${rule.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 220) * rule.count) / max;
    ctx.fillStyle = sarifLevelColor(rule.level);
    ctx.fillRect(pad + 210, y, Math.max(4, w), 12);
  });
}

export function renderSarifLocations(canvas: HTMLCanvasElement, locations: SarifLocationStat[], selectedFile: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!locations.length) return;
  const pad = 24;
  const max = Math.max(...locations.map((l) => l.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / locations.length));
  locations.forEach((loc, i) => {
    const y = pad + i * rowH;
    if (loc.file === selectedFile) {
      ctx.fillStyle = 'rgba(37, 99, 235, 0.22)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    const label = loc.file.length > 48 ? `…${loc.file.slice(-47)}` : loc.file;
    ctx.fillText(`${label} (${loc.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 280) * loc.count) / max;
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(pad + 270, y, Math.max(4, w), 12);
  });
}

export function renderSarifLevels(canvas: HTMLCanvasElement, levels: SarifLevelStat[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!levels.length) return;
  const pad = 24;
  const max = Math.max(...levels.map((l) => l.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / levels.length));
  levels.forEach((level, i) => {
    const y = pad + i * rowH;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${level.name} (${level.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 140) * level.count) / max;
    ctx.fillStyle = sarifLevelColor(level.name);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}
