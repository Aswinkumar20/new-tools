import { bytesToBlobPart, loadScript } from './mt-script-loader.utils';
import type { LamejsGlobal } from '../types/mt-vendor.types';

export const AUDIO_TRIMMER_WAVEFORM_BARS = 800;
export const AUDIO_TRIMMER_MP3_KBPS = 128;

function createAudioBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    throw new Error('Web Audio API is not available');
  }
  const context = new Ctx();
  const buffer = context.createBuffer(channels, length, sampleRate);
  void context.close();
  return buffer;
}

export interface AudioTrimmerProcessOptions {
  fadeInSeconds: number;
  fadeOutSeconds: number;
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const context = new AudioContext();
  try {
    return await context.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await context.close();
  }
}

/** Peak amplitudes normalized 0–1 for waveform rendering. */
export function computeWaveformPeaks(buffer: AudioBuffer, barCount = AUDIO_TRIMMER_WAVEFORM_BARS): number[] {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / barCount));
  const peaks: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const start = i * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    let max = 0;
    for (let j = start; j < end; j++) {
      max = Math.max(max, Math.abs(channel[j] ?? 0));
    }
    peaks.push(max);
  }

  const peakMax = Math.max(...peaks, 0.001);
  return peaks.map((p) => p / peakMax);
}

export function extractTrimmedBuffer(
  source: AudioBuffer,
  startSeconds: number,
  endSeconds: number,
  options: AudioTrimmerProcessOptions
): AudioBuffer {
  const sampleRate = source.sampleRate;
  const channels = source.numberOfChannels;
  const startSample = Math.floor(startSeconds * sampleRate);
  const endSample = Math.floor(endSeconds * sampleRate);
  const length = Math.max(0, endSample - startSample);

  const dest = createAudioBuffer(channels, length, sampleRate);

  for (let ch = 0; ch < channels; ch++) {
    const src = source.getChannelData(ch);
    const out = dest.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      out[i] = src[startSample + i] ?? 0;
    }
  }

  applyFadeEnvelope(dest, options.fadeInSeconds, options.fadeOutSeconds);
  return dest;
}

export function applyFadeEnvelope(
  buffer: AudioBuffer,
  fadeInSeconds: number,
  fadeOutSeconds: number
): void {
  const sampleRate = buffer.sampleRate;
  const fadeInSamples = Math.floor(Math.max(0, fadeInSeconds) * sampleRate);
  const fadeOutSamples = Math.floor(Math.max(0, fadeOutSeconds) * sampleRate);
  const totalSamples = buffer.length;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);

    if (fadeInSamples > 0) {
      for (let i = 0; i < Math.min(fadeInSamples, totalSamples); i++) {
        data[i] *= i / fadeInSamples;
      }
    }

    if (fadeOutSamples > 0) {
      const fadeStart = Math.max(0, totalSamples - fadeOutSamples);
      for (let i = fadeStart; i < totalSamples; i++) {
        const remaining = totalSamples - i;
        data[i] *= remaining / fadeOutSamples;
      }
    }
  }
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(arrayBuffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  const interleaved = interleaveChannels(buffer);
  const pcm = floatTo16BitPCM(interleaved);
  new Uint8Array(arrayBuffer, headerLength).set(new Uint8Array(pcm.buffer));

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function interleaveChannels(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  if (channels === 1) {
    return buffer.getChannelData(0).slice();
  }

  const length = buffer.length;
  const result = new Float32Array(length * channels);
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      result[i * channels + ch] = buffer.getChannelData(ch)[i] ?? 0;
    }
  }
  return result;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

let lamejsPromise: Promise<LamejsGlobal> | null = null;

export async function loadLamejs(lameScriptUrl: string): Promise<LamejsGlobal> {
  if (window.lamejs) {
    return window.lamejs;
  }

  if (!lamejsPromise) {
    lamejsPromise = loadScript(lameScriptUrl).then(() => {
      if (!window.lamejs) {
        throw new Error('lamejs failed to initialize');
      }
      return window.lamejs;
    });
  }

  return lamejsPromise;
}

export async function audioBufferToMp3Blob(
  buffer: AudioBuffer,
  lameScriptUrl: string,
  kbps = AUDIO_TRIMMER_MP3_KBPS
): Promise<Blob> {
  const lamejs = await loadLamejs(lameScriptUrl);
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  const blockSize = 1152;
  const mp3Chunks: Int8Array[] = [];

  if (channels === 1) {
    const samples = floatTo16BitPCM(buffer.getChannelData(0));
    for (let i = 0; i < samples.length; i += blockSize) {
      const chunk = samples.subarray(i, i + blockSize);
      const encoded = encoder.encodeBuffer(chunk);
      if (encoded.length > 0) {
        mp3Chunks.push(encoded);
      }
    }
  } else {
    const left = floatTo16BitPCM(buffer.getChannelData(0));
    const right = floatTo16BitPCM(buffer.getChannelData(1));
    for (let i = 0; i < left.length; i += blockSize) {
      const encoded = encoder.encodeBuffer(
        left.subarray(i, i + blockSize),
        right.subarray(i, i + blockSize)
      );
      if (encoded.length > 0) {
        mp3Chunks.push(encoded);
      }
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Chunks.push(flushed);
  }

  return new Blob(mp3Chunks.map(bytesToBlobPart), { type: 'audio/mpeg' });
}

/**
 * Parse hh:mm:ss.ms, mm:ss.ms, or plain seconds.
 * Returns null when the input cannot be parsed.
 */
export function parseTrimTimestampInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  let hours = 0;
  let minutes = 0;
  let secondsPart = '';

  if (parts.length === 3) {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    secondsPart = parts[2] ?? '';
  } else {
    minutes = Number(parts[0]);
    secondsPart = parts[1] ?? '';
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const seconds = Number(secondsPart);
  if (!Number.isFinite(seconds)) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function buildTrimmedFileName(originalName: string, extension: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'trimmed-audio';
  const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;
  return `${base}-trimmed${normalizedExt}`;
}

export function drawWaveformWithSelection(options: {
  canvas: HTMLCanvasElement;
  peaks: number[];
  startRatio: number;
  endRatio: number;
  playheadRatio?: number | null;
}): void {
  const { canvas, peaks, startRatio, endRatio, playheadRatio } = options;
  const ctx = canvas.getContext('2d');
  if (!ctx || peaks.length === 0) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const midY = height / 2;
  ctx.clearRect(0, 0, width, height);

  const barWidth = width / peaks.length;
  const startX = Math.max(0, Math.min(1, startRatio)) * width;
  const endX = Math.max(0, Math.min(1, endRatio)) * width;

  ctx.fillStyle = 'rgba(0, 123, 255, 0.08)';
  ctx.fillRect(startX, 0, Math.max(0, endX - startX), height);

  for (let i = 0; i < peaks.length; i++) {
    const x = i * barWidth;
    const peak = peaks[i] ?? 0;
    const barHeight = Math.max(1, peak * (height * 0.85));
    const inSelection = x >= startX && x <= endX;
    ctx.fillStyle = inSelection ? '#007bff' : 'rgba(100, 116, 139, 0.55)';
    ctx.fillRect(x, midY - barHeight / 2, Math.max(1, barWidth - 0.5), barHeight);
  }

  ctx.fillStyle = 'rgba(0, 123, 255, 0.18)';
  ctx.fillRect(0, 0, startX, height);
  ctx.fillRect(endX, 0, width - endX, height);

  ctx.strokeStyle = '#007bff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, 0);
  ctx.lineTo(startX, height);
  ctx.moveTo(endX, 0);
  ctx.lineTo(endX, height);
  ctx.stroke();

  if (playheadRatio != null && Number.isFinite(playheadRatio)) {
    const playX = Math.max(0, Math.min(1, playheadRatio)) * width;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, height);
    ctx.stroke();
  }
}

export function ratioFromClientX(canvas: HTMLCanvasElement, clientX: number): number {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

export type TrimHandle = 'start' | 'end' | 'playhead';

export function nearestTrimHandle(
  ratio: number,
  startRatio: number,
  endRatio: number,
  threshold = 0.015
): TrimHandle | null {
  if (Math.abs(ratio - startRatio) <= threshold) {
    return 'start';
  }
  if (Math.abs(ratio - endRatio) <= threshold) {
    return 'end';
  }
  return null;
}
