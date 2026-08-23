import type { ProcessMapActivity, ProcessMapFlow, ProcessMapVariant } from '../types/process-map-viewer.types';

export function processMapFrequencyColor(pct: number): string {
  if (pct >= 80) return '#f43f5e';
  if (pct >= 50) return '#f59e0b';
  if (pct >= 20) return '#22c55e';
  return '#64748b';
}

export function processMapVariantColor(index: number): string {
  const colors = ['#22c55e', '#f59e0b', '#38bdf8', '#a78bfa', '#fb7185'];
  return colors[index % colors.length];
}

export function renderProcessMapFrequencies(
  canvas: HTMLCanvasElement,
  activities: ProcessMapActivity[],
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
      ctx.fillStyle = 'rgba(4, 120, 87, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${a.name} (${a.frequency}, ${a.pct}%)`, pad, y + 14);
    ctx.fillStyle = processMapFrequencyColor(a.pct);
    ctx.fillRect(pad + 210, y, Math.max(4, ((canvas.width - pad * 2 - 220) * a.frequency) / max), 12);
  });
}

export function renderProcessMapVariants(
  canvas: HTMLCanvasElement,
  variants: ProcessMapVariant[],
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
      ctx.fillStyle = 'rgba(4, 120, 87, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${v.name} · ${v.cases} (${v.pct}%)`, pad, y + 14);
    ctx.fillStyle = processMapVariantColor(i);
    ctx.fillRect(pad + 210, y, Math.max(4, ((canvas.width - pad * 2 - 220) * v.cases) / max), 12);
  });
}

export function renderProcessMapFlows(
  canvas: HTMLCanvasElement,
  flows: ProcessMapFlow[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!flows.length) return;
  const pad = 24;
  const max = Math.max(...flows.map((f) => f.frequency), 1);
  const rowH = Math.min(40, Math.max(26, (canvas.height - pad * 2) / flows.length));
  flows.forEach((f, i) => {
    const y = pad + i * rowH;
    if (f.id === selectedId) {
      ctx.fillStyle = 'rgba(4, 120, 87, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${f.sourceName} → ${f.targetName} (${f.frequency})`, pad, y + 14);
    ctx.fillStyle = processMapFrequencyColor(f.pct);
    ctx.fillRect(pad + 260, y, Math.max(4, ((canvas.width - pad * 2 - 270) * f.frequency) / max), 10);
  });
}
