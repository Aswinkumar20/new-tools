import type { BpmnAnalyticsActivity, BpmnAnalyticsStat } from '../types/bpmn-analytics-viewer.types';

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#38bdf8',
  info: '#94a3b8'
};

export function bpmnAnalyticsSeverityColor(severity: string): string {
  return SEV_COLORS[severity] ?? '#c4b5fd';
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = sec / 60;
  if (min < 60) return `${min.toFixed(1)}m`;
  return `${(min / 60).toFixed(1)}h`;
}

export function renderBpmnAnalyticsOverlays(canvas: HTMLCanvasElement, activities: BpmnAnalyticsActivity[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!activities.length) return;
  const pad = 24;
  const max = Math.max(...activities.map((a) => a.bottleneckScore || a.frequency), 1);
  const rowH = Math.min(48, Math.max(30, (canvas.height - pad * 2) / activities.length));
  activities.forEach((a, i) => {
    const y = pad + i * rowH;
    if (a.id === selectedId) {
      ctx.fillStyle = 'rgba(91, 33, 182, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${a.name} (${a.frequency})`, pad, y + 12);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`wait ${formatDurationMs(a.waitMs)} · score ${a.bottleneckScore}`, pad, y + 26);
    const w = ((canvas.width - pad * 2 - 220) * (a.bottleneckScore || a.frequency)) / max;
    ctx.fillStyle = bpmnAnalyticsSeverityColor(a.severity);
    ctx.fillRect(pad + 210, y + 6, Math.max(4, w), 10);
  });
}

export function renderBpmnAnalyticsSeverities(canvas: HTMLCanvasElement, severities: BpmnAnalyticsStat[]): void {
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
    ctx.fillStyle = bpmnAnalyticsSeverityColor(s.name);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}
