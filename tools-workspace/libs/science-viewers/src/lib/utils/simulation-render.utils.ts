import type {
  SimulationColormap,
  SimulationDataset,
  SimulationProbe,
  SimulationSliceAxis
} from '../types/simulation-result-viewer.types';
import { drawImageDataToCanvas, pixelsToImageData } from './science-image-render.utils';
import { extractSimField, extractSimSlice } from './simulation-parse.utils';

const SERIES_COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#f472b6', '#a78bfa'];

export function renderSimulationField(
  canvas: HTMLCanvasElement,
  dataset: SimulationDataset,
  options: {
    timeIndex: number;
    zoom: number;
    invert: boolean;
    colormap: SimulationColormap;
    center: number;
    width: number;
    selectedProbeId?: string | null;
  }
): void {
  const field = extractSimField(dataset, options.timeIndex);
  if (!field.length) return;
  const image = pixelsToImageData(field, dataset.nx, dataset.ny, {
    center: options.center,
    width: options.width,
    invert: options.invert,
    colormap: options.colormap
  });
  drawImageDataToCanvas(canvas, image, { zoom: options.zoom, background: '#0f172a' });
  const ctx = canvas.getContext('2d');
  if (!ctx || !dataset.probes.length) return;
  const drawW = dataset.nx * options.zoom;
  const drawH = dataset.ny * options.zoom;
  const ox = (canvas.width - drawW) / 2;
  const oy = (canvas.height - drawH) / 2;
  for (const probe of dataset.probes) {
    const x = ox + ((probe.i + 0.5) / dataset.nx) * drawW;
    const y = oy + ((probe.j + 0.5) / dataset.ny) * drawH;
    const selected = probe.id === options.selectedProbeId;
    ctx.beginPath();
    ctx.arc(x, y, selected ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#fbbf24' : '#e2e8f0';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
  }
}

export function renderSimulationSlice(
  canvas: HTMLCanvasElement,
  dataset: SimulationDataset,
  timeIndex: number,
  axis: SimulationSliceAxis,
  index: number
): void {
  const values = extractSimSlice(dataset, timeIndex, axis, index);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (values.length < 2) return;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }
  if (!Number.isFinite(min) || min === max) {
    min = 0;
    max = 1;
  }
  const pad = 40;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = pad + (i / (values.length - 1)) * w;
    const y = pad + h - ((values[i] - min) / (max - min)) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${axis === 'j' ? 'Row' : 'Column'} ${index} · t=${dataset.times[timeIndex] ?? timeIndex}`, pad, 22);
  ctx.textAlign = 'right';
  ctx.fillText(max.toFixed(2), pad - 6, pad + 8);
  ctx.fillText(min.toFixed(2), pad - 6, pad + h);
}

export function renderSimulationProbes(
  canvas: HTMLCanvasElement,
  times: number[],
  series: Array<{ label: string; values: number[]; color?: string }>,
  timeIndex: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const padding = { left: 48, right: 16, top: 24, bottom: 32 };
  const w = canvas.width - padding.left - padding.right;
  const h = canvas.height - padding.top - padding.bottom;
  const all = series.flatMap((s) => s.values.filter((v) => Number.isFinite(v)));
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (!Number.isFinite(min) || min === max) {
    min = 0;
    max = 1;
  }
  const n = Math.max(2, times.length);
  if (timeIndex >= 0 && timeIndex < times.length) {
    const tx = padding.left + (timeIndex / (n - 1)) * w;
    ctx.strokeStyle = '#64748b';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tx, padding.top);
    ctx.lineTo(tx, padding.top + h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  series.forEach((item, si) => {
    ctx.strokeStyle = item.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    item.values.forEach((value, i) => {
      if (!Number.isFinite(value)) return;
      const x = padding.left + (i / (n - 1)) * w;
      const y = padding.top + h - ((value - min) / (max - min)) * h;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    });
    if (started) ctx.stroke();
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  series.slice(0, 5).forEach((item, i) => {
    ctx.fillStyle = item.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
    ctx.fillText(item.label, padding.left + 8 + i * 120, padding.top - 8);
  });
}

export function filterSimulationProbes(probes: SimulationProbe[], query: string): SimulationProbe[] {
  const q = query.trim().toLowerCase();
  if (!q) return probes;
  return probes.filter((p) => `${p.id} ${p.name}`.toLowerCase().includes(q));
}
