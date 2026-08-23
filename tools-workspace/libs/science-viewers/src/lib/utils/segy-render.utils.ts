import type { ParsedSegy, SegyColormap, SegyHistogramBar } from '../types/seg-y-viewer.types';

export function seismicRgb(t: number): [number, number, number] {
  const x = Math.max(-1, Math.min(1, t));
  if (x < 0) {
    const a = -x;
    return [Math.round(255 * (1 - a)), Math.round(255 * (1 - a)), 255];
  }
  return [255, Math.round(255 * (1 - x)), Math.round(255 * (1 - x))];
}

function viridisRgb(t: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  return [
    Math.round(255 * (0.267 + c * (0.993 - 0.267))),
    Math.round(255 * (0.004 + c * (0.906 - 0.004))),
    Math.round(255 * (0.329 + c * (0.143 - 0.329)))
  ];
}

export function applyAgc(values: Float32Array, traces: number, samples: number, window: number): Float32Array {
  const win = Math.max(3, Math.floor(window) | 1);
  const half = Math.floor(win / 2);
  const out = new Float32Array(values.length);
  for (let t = 0; t < traces; t++) {
    const base = t * samples;
    for (let s = 0; s < samples; s++) {
      const a0 = Math.max(0, s - half);
      const a1 = Math.min(samples - 1, s + half);
      let sum = 0;
      let n = 0;
      for (let i = a0; i <= a1; i++) {
        const v = values[base + i];
        sum += v * v;
        n += 1;
      }
      const rms = Math.sqrt(sum / Math.max(1, n)) || 1e-6;
      out[base + s] = values[base + s] / rms;
    }
  }
  return out;
}

export function amplitudeHistogram(values: Float32Array, bins = 24): SegyHistogramBar[] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) return [];
  const span = max - min || 1;
  const counts = new Array(bins).fill(0);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    counts[Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / span) * bins)))] += 1;
  }
  const peak = Math.max(1, ...counts);
  return counts.map((count, i) => {
    const t = i / (bins - 1 || 1);
    const [r, g, b] = seismicRgb(t * 2 - 1);
    return {
      label: (min + (span * i) / bins).toFixed(Math.abs(max - min) < 2 ? 2 : 0),
      count,
      heightPct: count ? Math.max(4, Math.round((count / peak) * 100)) : 0,
      color: `rgb(${r},${g},${b})`
    };
  });
}

export function renderSegySection(
  canvas: HTMLCanvasElement,
  parsed: ParsedSegy,
  options: {
    traceMin: number;
    traceMax: number;
    sampleMin: number;
    sampleMax: number;
    gain: number;
    agcWindow: number;
    invert: boolean;
    colormap: SegyColormap;
    selectedTrace: number | null;
    background?: string;
  }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = options.background ?? '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const t0 = Math.max(0, Math.min(parsed.previewTraces - 1, Math.floor(options.traceMin)));
  const t1 = Math.max(t0, Math.min(parsed.previewTraces - 1, Math.floor(options.traceMax)));
  const s0 = Math.max(0, Math.min(parsed.previewSamples - 1, Math.floor(options.sampleMin)));
  const s1 = Math.max(s0, Math.min(parsed.previewSamples - 1, Math.floor(options.sampleMax)));
  const nT = t1 - t0 + 1;
  const nS = s1 - s0 + 1;
  if (nT < 1 || nS < 1) return;

  let amps = parsed.amplitudes;
  if (options.agcWindow > 1) amps = applyAgc(parsed.amplitudes, parsed.previewTraces, parsed.previewSamples, options.agcWindow);

  const clip = Math.max(1e-9, (parsed.rmsAmp || Math.max(Math.abs(parsed.minAmp), Math.abs(parsed.maxAmp), 1e-6)) / Math.max(0.05, options.gain));
  const padL = 48;
  const padT = 28;
  const padB = 28;
  const padR = 12;
  const w = canvas.width - padL - padR;
  const h = canvas.height - padT - padB;
  const img = ctx.createImageData(nT, nS);

  for (let t = 0; t < nT; t++) {
    for (let s = 0; s < nS; s++) {
      let v = amps[(t0 + t) * parsed.previewSamples + (s0 + s)];
      if (options.invert) v = -v;
      let n = v / clip;
      n = Math.max(-1, Math.min(1, n));
      let r = 0;
      let g = 0;
      let b = 0;
      if (options.colormap === 'seismic') [r, g, b] = seismicRgb(n);
      else if (options.colormap === 'viridis') [r, g, b] = viridisRgb((n + 1) / 2);
      else {
        const byte = Math.round(((n + 1) / 2) * 255);
        r = g = b = byte;
      }
      const o = (s * nT + t) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }

  const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!off) return;
  off.width = nT;
  off.height = nS;
  off.getContext('2d')?.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = nT > w || nS > h;
  ctx.drawImage(off, padL, padT, w, h);

  if (options.selectedTrace != null && options.selectedTrace >= t0 && options.selectedTrace <= t1) {
    const x = padL + ((options.selectedTrace - t0 + 0.5) / nT) * w;
    ctx.strokeStyle = '#f8fafc';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`Trace ${t0 + 1}`, padL, 16);
  ctx.fillText(`Trace ${t1 + 1}`, padL + w - 52, 16);
  const t0ms = ((s0 * parsed.dtUs) / 1000).toFixed(0);
  const t1ms = ((s1 * parsed.dtUs) / 1000).toFixed(0);
  ctx.fillText(`${t0ms} ms`, 8, padT + 8);
  ctx.fillText(`${t1ms} ms`, 8, padT + h);
}

export function renderSegyWiggle(
  canvas: HTMLCanvasElement,
  parsed: ParsedSegy,
  options: {
    centerTrace: number;
    sampleMin: number;
    sampleMax: number;
    gain: number;
    invert: boolean;
    neighbors?: number;
    background?: string;
  }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = options.background ?? '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const neighbors = options.neighbors ?? 4;
  const tCenter = Math.max(0, Math.min(parsed.previewTraces - 1, options.centerTrace));
  const t0 = Math.max(0, tCenter - neighbors);
  const t1 = Math.min(parsed.previewTraces - 1, tCenter + neighbors);
  const s0 = Math.max(0, Math.min(parsed.previewSamples - 1, Math.floor(options.sampleMin)));
  const s1 = Math.max(s0 + 1, Math.min(parsed.previewSamples - 1, Math.floor(options.sampleMax)));
  const nS = s1 - s0 + 1;
  const padL = 48;
  const padT = 28;
  const padB = 24;
  const padR = 16;
  const w = canvas.width - padL - padR;
  const h = canvas.height - padT - padB;
  const nT = t1 - t0 + 1;
  const slot = w / nT;
  const clip = Math.max(1e-9, (parsed.rmsAmp || 1) / Math.max(0.05, options.gain));

  ctx.strokeStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + h);
  ctx.stroke();

  for (let t = t0; t <= t1; t++) {
    const cx = padL + (t - t0 + 0.5) * slot;
    ctx.strokeStyle = t === tCenter ? '#38bdf8' : '#334155';
    ctx.beginPath();
    ctx.moveTo(cx, padT);
    ctx.lineTo(cx, padT + h);
    ctx.stroke();

    ctx.beginPath();
    let started = false;
    const fillPts: Array<{ x: number; y: number }> = [];
    for (let s = 0; s < nS; s++) {
      let v = parsed.amplitudes[t * parsed.previewSamples + (s0 + s)];
      if (options.invert) v = -v;
      const n = Math.max(-1, Math.min(1, v / clip));
      const x = cx + n * slot * 0.42;
      const y = padT + (s / (nS - 1 || 1)) * h;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
      fillPts.push({ x, y });
    }
    ctx.strokeStyle = t === tCenter ? '#e2e8f0' : '#94a3b8';
    ctx.lineWidth = t === tCenter ? 1.8 : 1.1;
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = t === tCenter ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148, 163, 184, 0.22)';
    ctx.beginPath();
    let filling = false;
    for (let i = 0; i < fillPts.length; i++) {
      const p = fillPts[i];
      if (p.x >= cx) {
        if (!filling) {
          ctx.moveTo(cx, p.y);
          filling = true;
        }
        ctx.lineTo(p.x, p.y);
      } else if (filling) {
        ctx.lineTo(cx, p.y);
        ctx.closePath();
        filling = false;
      }
    }
    if (filling) {
      ctx.lineTo(cx, fillPts[fillPts.length - 1].y);
      ctx.closePath();
    }
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(String(t + 1), cx - 8, 16);
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${((s0 * parsed.dtUs) / 1000).toFixed(0)} ms`, 6, padT + 8);
  ctx.fillText(`${((s1 * parsed.dtUs) / 1000).toFixed(0)} ms`, 6, padT + h);
}
