import type { ClimateColormap, ClimateDataset, ClimateStation } from '../types/climate-data-viewer.types';
import {
  drawImageDataToCanvas,
  pixelsToImageData
} from './science-image-render.utils';
import { extractClimateSlice } from './climate-parse.utils';

const SERIES_COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#f472b6', '#a78bfa', '#fb7185'];

export function renderClimateMap(
  canvas: HTMLCanvasElement,
  dataset: ClimateDataset,
  options: {
    timeIndex: number;
    zoom: number;
    invert: boolean;
    colormap: ClimateColormap;
    center: number;
    width: number;
    selectedStationId?: string | null;
  }
): void {
  const slice = extractClimateSlice(dataset, options.timeIndex);
  if (!slice.length || !dataset.nx || !dataset.ny) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No gridded field in this file', canvas.width / 2, canvas.height / 2);
    return;
  }
  const image = pixelsToImageData(slice, dataset.nx, dataset.ny, {
    center: options.center,
    width: options.width,
    invert: options.invert,
    colormap: options.colormap
  });
  drawImageDataToCanvas(canvas, image, { zoom: options.zoom, background: '#0f172a' });

  const ctx = canvas.getContext('2d');
  if (!ctx || !dataset.stations.length) return;
  const drawW = dataset.nx * options.zoom;
  const drawH = dataset.ny * options.zoom;
  const ox = (canvas.width - drawW) / 2;
  const oy = (canvas.height - drawH) / 2;
  const latMin = Math.min(...dataset.lats);
  const latMax = Math.max(...dataset.lats);
  const lonMin = Math.min(...dataset.lons);
  const lonMax = Math.max(...dataset.lons);
  for (const station of dataset.stations) {
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon)) continue;
    const x =
      lonMax === lonMin ? ox + drawW / 2 : ox + ((station.lon - lonMin) / (lonMax - lonMin)) * drawW;
    const y =
      latMax === latMin ? oy + drawH / 2 : oy + (1 - (station.lat - latMin) / (latMax - latMin)) * drawH;
    const selected = station.id === options.selectedStationId;
    ctx.beginPath();
    ctx.arc(x, y, selected ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#fbbf24' : '#e2e8f0';
    ctx.fill();
    ctx.strokeStyle = selected ? '#f59e0b' : '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function renderClimateSeries(
  canvas: HTMLCanvasElement,
  times: string[],
  series: Array<{ label: string; values: number[]; color?: string }>,
  timeIndex: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const padding = { left: 48, right: 16, top: 20, bottom: 36 };
  const w = canvas.width - padding.left - padding.right;
  const h = canvas.height - padding.top - padding.bottom;
  const all = series.flatMap((s) => s.values.filter((v) => Number.isFinite(v)));
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (!Number.isFinite(min) || min === max) {
    min = 0;
    max = 1;
  }
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + h);
  ctx.lineTo(padding.left + w, padding.top + h);
  ctx.stroke();

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
    const color = item.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
    ctx.strokeStyle = color;
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
  ctx.textAlign = 'right';
  ctx.fillText(max.toFixed(1), padding.left - 6, padding.top + 10);
  ctx.fillText(min.toFixed(1), padding.left - 6, padding.top + h);
  ctx.textAlign = 'center';
  if (times.length) {
    ctx.fillText(times[0], padding.left, canvas.height - 10);
    ctx.fillText(times[times.length - 1], padding.left + w, canvas.height - 10);
  }
  series.slice(0, 5).forEach((item, i) => {
    ctx.fillStyle = item.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
    ctx.textAlign = 'left';
    ctx.fillText(item.label, padding.left + 8 + i * 110, padding.top - 6);
  });
}

export function filterClimateStations(stations: ClimateStation[], query: string): ClimateStation[] {
  const q = query.trim().toLowerCase();
  if (!q) return stations;
  return stations.filter((s) => `${s.id} ${s.name}`.toLowerCase().includes(q));
}
