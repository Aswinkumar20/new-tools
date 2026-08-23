import type { EventLogActivity, EventLogCase, EventLogEvent } from '../types/event-log-viewer.types';

export function eventLogFrequencyColor(pct: number): string {
  if (pct >= 80) return '#22d3ee';
  if (pct >= 50) return '#38bdf8';
  if (pct >= 20) return '#34d399';
  return '#64748b';
}

export function eventLogCaseColor(index: number): string {
  const colors = ['#22d3ee', '#38bdf8', '#a78bfa', '#34d399', '#fbbf24'];
  return colors[index % colors.length];
}

export function renderEventLogCases(canvas: HTMLCanvasElement, cases: EventLogCase[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!cases.length) return;
  const pad = 24;
  const max = Math.max(...cases.map((c) => c.events), 1);
  const rowH = Math.min(40, Math.max(26, (canvas.height - pad * 2) / cases.length));
  cases.forEach((c, i) => {
    const y = pad + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(21, 94, 117, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.caseId} · ${c.events} events`, pad, y + 14);
    ctx.fillStyle = eventLogCaseColor(i);
    ctx.fillRect(pad + 180, y, Math.max(4, ((canvas.width - pad * 2 - 190) * c.events) / max), 10);
  });
}

export function renderEventLogActivities(
  canvas: HTMLCanvasElement,
  activities: EventLogActivity[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!activities.length) return;
  const pad = 24;
  const max = Math.max(...activities.map((a) => a.frequency), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / activities.length));
  activities.forEach((a, i) => {
    const y = pad + i * rowH;
    if (a.id === selectedId) {
      ctx.fillStyle = 'rgba(21, 94, 117, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${a.name} (${a.frequency} · ${a.pct}% cases)`, pad, y + 14);
    ctx.fillStyle = eventLogFrequencyColor(a.pct);
    ctx.fillRect(pad + 250, y, Math.max(4, ((canvas.width - pad * 2 - 260) * a.frequency) / max), 12);
  });
}

export function renderEventLogEvents(canvas: HTMLCanvasElement, events: EventLogEvent[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!events.length) return;
  const visible = events.slice(0, 40);
  const pad = 24;
  const rowH = Math.min(34, Math.max(22, (canvas.height - pad * 2) / visible.length));
  visible.forEach((e, i) => {
    const y = pad + i * rowH;
    if (e.id === selectedId) {
      ctx.fillStyle = 'rgba(21, 94, 117, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.caseId} · ${e.activity}${e.resource ? ` (${e.resource})` : ''}`, pad, y + 12);
  });
}
