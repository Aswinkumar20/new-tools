import type { WaveformChannel, WaveformCaliper, WaveformViewport } from '../types/waveform.types';

export interface DrawWaveformOptions {
  channels: WaveformChannel[];
  viewport: WaveformViewport;
  grid?: boolean;
  caliper?: WaveformCaliper | null;
  channelHeight?: number;
  background?: string;
  traceColor?: string;
  gridColor?: string;
}

export function drawWaveformCanvas(canvas: HTMLCanvasElement, options: DrawWaveformOptions): void {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return;
  }
  if (!ctx) return;

  const {
    channels,
    viewport,
    grid = true,
    caliper = null,
    channelHeight = 72,
    background = '#0f172a',
    traceColor = '#22c55e',
    gridColor = 'rgba(148, 163, 184, 0.18)'
  } = options;

  const width = canvas.width;
  const height = canvas.height;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  if (!channels.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Load a waveform to preview', 24, 40);
    return;
  }

  const { startSample, windowSamples, gain, pixelsPerSecond } = viewport;
  const sampleRate = pixelsPerSecond > 0 ? pixelsPerSecond : 100;
  const samplesPerPixel = Math.max(1, windowSamples / Math.max(1, width));

  if (grid) {
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const majorX = (pixelsPerSecond / 5) | 0; // ~200ms at default pps
    for (let x = 0; x < width; x += Math.max(20, majorX)) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += channelHeight) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  channels.forEach((channel, index) => {
    const laneTop = index * channelHeight + 8;
    const midY = laneTop + (channelHeight - 16) / 2;

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(channel.label, 8, laneTop + 12);

    ctx.strokeStyle = traceColor;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    let started = false;
    for (let px = 0; px < width; px++) {
      const sampleIndex = startSample + Math.floor(px * samplesPerPixel);
      if (sampleIndex >= channel.samples.length) break;
      const value = channel.samples[sampleIndex];
      const y = midY - value * gain;
      if (!started) {
        ctx.moveTo(px, y);
        started = true;
      } else {
        ctx.lineTo(px, y);
      }
    }
    ctx.stroke();
  });

  if (caliper) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(caliper.x1, caliper.y1);
    ctx.lineTo(caliper.x2, caliper.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fde68a';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(
      `${caliper.deltaTimeMs.toFixed(1)} ms · ${caliper.deltaAmplitude.toFixed(3)} mV`,
      Math.min(caliper.x1, caliper.x2) + 6,
      Math.min(caliper.y1, caliper.y2) - 6
    );
  }
}

export function defaultWindowSamples(totalSamples: number, sampleRateHz: number, widthPx: number): number {
  const showSec = Math.min(10, totalSamples / sampleRateHz);
  return Math.max(64, Math.min(totalSamples, Math.floor(showSec * sampleRateHz)));
}

export function maxStartSample(totalSamples: number, windowSamples: number): number {
  return Math.max(0, totalSamples - windowSamples);
}
