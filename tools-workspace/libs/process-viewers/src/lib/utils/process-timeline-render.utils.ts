import type { ProcessTimelineItem, ProcessTimelineLane } from '../types/process-timeline-viewer.types';

export function processTimelineColor(index: number): string {
  const colors = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee'];
  return colors[index % colors.length];
}

function activityColor(activity: string): string {
  const key = activity.toLowerCase();
  if (/receive|start|open/i.test(key)) return '#22c55e';
  if (/ship|pay|complete|end/i.test(key)) return '#f43f5e';
  if (/pack|approve/i.test(key)) return '#fbbf24';
  if (/pick|review/i.test(key)) return '#60a5fa';
  return '#38bdf8';
}

export function renderTimelineGantt(
  canvas: HTMLCanvasElement,
  lanes: ProcessTimelineLane[],
  items: ProcessTimelineItem[],
  range: { startMs: number; endMs: number },
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!lanes.length || !items.length) return;
  const labelW = 72;
  const pad = 16;
  const span = Math.max(1, (range.endMs || 1) - (range.startMs || 0));
  const rowH = Math.min(36, Math.max(22, (canvas.height - pad * 2) / lanes.length));
  lanes.forEach((lane, i) => {
    const y = pad + i * rowH;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(lane.name.slice(0, 10), 8, y + 14);
    lane.items.forEach((item) => {
      const x = labelW + ((item.startMs - range.startMs) / span) * (canvas.width - labelW - pad);
      const w = Math.max(6, ((item.endMs - item.startMs) / span) * (canvas.width - labelW - pad));
      ctx.fillStyle = item.id === selectedId ? '#93c5fd' : activityColor(item.activity);
      ctx.fillRect(x, y + 4, w, Math.max(10, rowH - 10));
    });
  });
}

export function renderTimelineLanes(
  canvas: HTMLCanvasElement,
  lanes: ProcessTimelineLane[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!lanes.length) return;
  const pad = 24;
  const max = Math.max(...lanes.map((l) => l.events), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / lanes.length));
  lanes.forEach((lane, i) => {
    const y = pad + i * rowH;
    if (lane.id === selectedId) {
      ctx.fillStyle = 'rgba(30, 58, 138, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${lane.name} · ${lane.events} events`, pad, y + 14);
    ctx.fillStyle = processTimelineColor(i);
    ctx.fillRect(pad + 200, y, Math.max(4, ((canvas.width - pad * 2 - 210) * lane.events) / max), 12);
  });
}

export function renderTimelineEvents(
  canvas: HTMLCanvasElement,
  items: ProcessTimelineItem[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) return;
  const visible = items.slice(0, 40);
  const pad = 24;
  const rowH = Math.min(34, Math.max(22, (canvas.height - pad * 2) / visible.length));
  visible.forEach((it, i) => {
    const y = pad + i * rowH;
    if (it.id === selectedId) {
      ctx.fillStyle = 'rgba(30, 58, 138, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${it.caseId} · ${it.activity} (${it.resource})`, pad, y + 12);
  });
}
