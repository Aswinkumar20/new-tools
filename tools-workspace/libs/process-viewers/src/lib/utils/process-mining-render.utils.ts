import type {
  ProcessMiningActivity,
  ProcessMiningDfgEdge,
  ProcessMiningVariant
} from '../types/process-mining-viewer.types';

export function processMiningFrequencyColor(pct: number): string {
  if (pct >= 80) return '#f43f5e';
  if (pct >= 50) return '#f59e0b';
  if (pct >= 20) return '#22c55e';
  return '#64748b';
}

export function processMiningVariantColor(index: number): string {
  const colors = ['#a78bfa', '#22c55e', '#f59e0b', '#38bdf8', '#fb7185'];
  return colors[index % colors.length];
}

export function renderProcessMiningVariants(
  canvas: HTMLCanvasElement,
  variants: ProcessMiningVariant[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!variants.length) return;
  const pad = 24;
  const max = Math.max(...variants.map((v) => v.cases), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / variants.length));
  variants.forEach((v, i) => {
    const y = pad + i * rowH;
    if (v.id === selectedId) {
      ctx.fillStyle = 'rgba(109, 40, 217, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${v.name} · ${v.cases} (${v.pct}%)`, pad, y + 14);
    ctx.fillStyle = processMiningVariantColor(i);
    ctx.fillRect(pad + 220, y, Math.max(4, ((canvas.width - pad * 2 - 230) * v.cases) / max), 12);
  });
}

export function renderProcessMiningActivities(
  canvas: HTMLCanvasElement,
  activities: ProcessMiningActivity[],
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
      ctx.fillStyle = 'rgba(109, 40, 217, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${a.name} (${a.frequency}, ${a.pct}%)`, pad, y + 14);
    ctx.fillStyle = processMiningFrequencyColor(a.pct);
    ctx.fillRect(pad + 210, y, Math.max(4, ((canvas.width - pad * 2 - 220) * a.frequency) / max), 12);
  });
}

export function renderProcessMiningDfg(
  canvas: HTMLCanvasElement,
  activities: ProcessMiningActivity[],
  edges: ProcessMiningDfgEdge[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!activities.length) return;
  const pad = 36;
  const cols = Math.max(1, Math.min(4, activities.length));
  const rows = Math.ceil(activities.length / cols);
  const cellW = (canvas.width - pad * 2) / cols;
  const cellH = (canvas.height - pad * 2) / rows;
  const laid = activities.map((a, i) => ({
    ...a,
    x: pad + cellW * ((i % cols) + 0.5),
    y: pad + cellH * (Math.floor(i / cols) + 0.5)
  }));
  const byName = new Map(laid.map((n) => [n.name, n]));
  ctx.lineWidth = 1.5;
  for (const e of edges) {
    const a = byName.get(e.sourceName);
    const b = byName.get(e.targetName);
    if (!a || !b) continue;
    ctx.strokeStyle = e.id === selectedId ? '#c4b5fd' : 'rgba(148, 163, 184, 0.55)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const n of laid) {
    const related = edges.some((e) => e.id === selectedId && (e.sourceName === n.name || e.targetName === n.name));
    if (related) {
      ctx.fillStyle = 'rgba(109, 40, 217, 0.45)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = processMiningFrequencyColor(n.pct);
    ctx.beginPath();
    ctx.arc(n.x, n.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.name.slice(0, 22), n.x - 18, n.y + 26);
  }
}
