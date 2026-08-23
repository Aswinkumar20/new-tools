import { LAS_CURVE_COLORS } from '../constants/las-well-log-viewer.constants';
import type { WellLogCurve, WellLogHistogramBar, WellLogTrackOptions } from '../types/well-log.types';

export function curveColor(mnemonic: string, index = 0): string {
  const key = mnemonic.replace(/\s+/g, '').toUpperCase();
  if (LAS_CURVE_COLORS[key]) return LAS_CURVE_COLORS[key];
  const palette = ['#22c55e', '#38bdf8', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#fb923c', '#e879f9'];
  return palette[index % palette.length];
}

export function isDepthCurve(mnemonic: string): boolean {
  const m = mnemonic.replace(/\s+/g, '').toUpperCase();
  return m === 'DEPT' || m === 'DEPTH' || m === 'MD' || m === 'TVD';
}

export function summarizeCurve(mnemonic: string, unit: string, description: string, values: number[]): WellLogCurve {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  let nullCount = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      nullCount += 1;
      continue;
    }
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    count += 1;
  }
  const key = mnemonic.replace(/\s+/g, '').toUpperCase();
  return {
    mnemonic,
    unit,
    description,
    values,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    mean: count ? sum / count : 0,
    nullCount,
    logScale: /res|ild|ilm|lls|lld/i.test(key),
    reversed: /nphi|neut|dt\b|ac\b|sonic/i.test(key)
  };
}

export function visibleDepthIndices(depth: number[], depthMin: number, depthMax: number): [number, number] {
  let start = 0;
  let end = depth.length - 1;
  for (let i = 0; i < depth.length; i++) {
    if (depth[i] >= depthMin) {
      start = i;
      break;
    }
  }
  for (let i = depth.length - 1; i >= 0; i--) {
    if (depth[i] <= depthMax) {
      end = i;
      break;
    }
  }
  return [start, Math.max(start, end)];
}

export function renderWellLogTracks(
  canvas: HTMLCanvasElement,
  depth: number[],
  curves: WellLogCurve[],
  options: WellLogTrackOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const bg = options.background ?? '#0f172a';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!depth.length || !curves.length) return;

  const [i0, i1] = visibleDepthIndices(depth, options.depthMin, options.depthMax);
  const d0 = depth[i0];
  const d1 = depth[i1] === d0 ? d0 + 1 : depth[i1];
  const left = 52;
  const top = 36;
  const bottom = 24;
  const trackGap = 8;
  const innerH = canvas.height - top - bottom;
  const trackW = Math.max(40, (canvas.width - left - 12 - trackGap * (curves.length - 1)) / curves.length);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${d0.toFixed(1)}`, 8, top + 8);
  ctx.fillText(`${d1.toFixed(1)}`, 8, canvas.height - bottom);
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(left - 6, top);
  ctx.lineTo(left - 6, top + innerH);
  ctx.stroke();

  const ticks = 5;
  for (let t = 0; t <= ticks; t++) {
    const y = top + (t / ticks) * innerH;
    const depthVal = d0 + ((d1 - d0) * t) / ticks;
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(left - 6, y);
    ctx.lineTo(canvas.width - 8, y);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.fillText(depthVal.toFixed(0), 6, y + 4);
  }

  curves.forEach((curve, ci) => {
    const x0 = left + ci * (trackW + trackGap);
    ctx.fillStyle = curveColor(curve.mnemonic, ci);
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(curve.mnemonic, x0, 14);
    ctx.fillStyle = '#64748b';
    ctx.fillText(curve.unit || '', x0, 28);
    const lo = curve.reversed ? curve.max : curve.min;
    const hi = curve.reversed ? curve.min : curve.max;
    const span = hi - lo || 1;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(lo.toFixed(curve.max - curve.min < 2 ? 2 : 0), x0, top - 2);
    ctx.fillText(hi.toFixed(curve.max - curve.min < 2 ? 2 : 0), x0 + trackW - 28, top - 2);
    ctx.strokeStyle = options.selectedMnemonic === curve.mnemonic ? '#f8fafc' : '#334155';
    ctx.strokeRect(x0, top, trackW, innerH);

    ctx.beginPath();
    let started = false;
    for (let i = i0; i <= i1; i++) {
      const v = curve.values[i];
      if (!Number.isFinite(v)) {
        started = false;
        continue;
      }
      let t = (v - lo) / span;
      if (curve.logScale && v > 0 && lo > 0 && hi > 0) {
        const llo = Math.log10(Math.min(lo, hi));
        const lhi = Math.log10(Math.max(lo, hi));
        t = (Math.log10(v) - llo) / (lhi - llo || 1);
      }
      t = Math.max(0, Math.min(1, t));
      const x = x0 + t * trackW;
      const y = top + ((depth[i] - d0) / (d1 - d0)) * innerH;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = curveColor(curve.mnemonic, ci);
    ctx.lineWidth = options.selectedMnemonic === curve.mnemonic ? 2.4 : 1.6;
    ctx.stroke();
    ctx.lineWidth = 1;
  });
}

export function renderWellCrossplot(
  canvas: HTMLCanvasElement,
  xCurve: WellLogCurve,
  yCurve: WellLogCurve,
  depth: number[],
  options: { depthMin: number; depthMax: number; background?: string }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = options.background ?? '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const pad = 40;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(pad, pad, w, h);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${xCurve.mnemonic} (${xCurve.unit})`, pad, canvas.height - 12);
  ctx.save();
  ctx.translate(14, pad + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${yCurve.mnemonic} (${yCurve.unit})`, 0, 0);
  ctx.restore();

  const xSpan = xCurve.max - xCurve.min || 1;
  const ySpan = yCurve.max - yCurve.min || 1;
  for (let i = 0; i < depth.length; i++) {
    if (depth[i] < options.depthMin || depth[i] > options.depthMax) continue;
    const xv = xCurve.values[i];
    const yv = yCurve.values[i];
    if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
    const t = (depth[i] - options.depthMin) / (options.depthMax - options.depthMin || 1);
    ctx.fillStyle = `hsl(${200 + t * 80}, 70%, 60%)`;
    const x = pad + ((xv - xCurve.min) / xSpan) * w;
    const y = pad + h - ((yv - yCurve.min) / ySpan) * h;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function curveHistogram(curve: WellLogCurve, bins = 24): WellLogHistogramBar[] {
  const counts = new Array(bins).fill(0);
  const span = curve.max - curve.min || 1;
  for (const v of curve.values) {
    if (!Number.isFinite(v)) continue;
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(((v - curve.min) / span) * bins)));
    counts[idx] += 1;
  }
  const max = Math.max(1, ...counts);
  const color = curveColor(curve.mnemonic);
  return counts.map((count, i) => ({
    label: (curve.min + (span * i) / bins).toFixed(span < 5 ? 2 : 0),
    count,
    heightPct: count ? Math.max(4, Math.round((count / max) * 100)) : 0,
    color
  }));
}
