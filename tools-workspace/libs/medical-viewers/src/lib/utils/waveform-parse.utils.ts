import type { ParsedWaveform, WaveformChannel, WaveformMontageMode } from '../types/waveform.types';

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function parseCsvLine(line: string): string[] {
  return line
    .split(',')
    .map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

function toFloatArray(values: number[]): Float32Array {
  return Float32Array.from(values);
}

function inferSampleRateFromExtension(ext: string, fallback: number): number {
  if (ext === '.eeg') return 256;
  if (ext === '.ecg') return 500;
  return fallback;
}

function parseJsonWaveform(text: string, warnings: string[]): ParsedWaveform {
  const raw = JSON.parse(text) as {
    sampleRateHz?: number;
    sampleRate?: number;
    leads?: Record<string, number[]>;
    channels?: Array<{ id?: string; label?: string; name?: string; samples?: number[] }>;
  };

  const sampleRateHz = raw.sampleRateHz ?? raw.sampleRate ?? 500;
  const channels: WaveformChannel[] = [];

  if (raw.channels?.length) {
    for (const ch of raw.channels) {
      const samples = ch.samples ?? [];
      if (!samples.length) continue;
      const id = (ch.id ?? ch.name ?? ch.label ?? `ch${channels.length + 1}`).toString();
      channels.push({
        id,
        label: (ch.label ?? ch.name ?? id).toString(),
        samples: toFloatArray(samples)
      });
    }
  } else if (raw.leads) {
    for (const [id, samples] of Object.entries(raw.leads)) {
      if (!samples?.length) continue;
      channels.push({ id, label: id, samples: toFloatArray(samples) });
    }
  }

  if (!channels.length) {
    throw new Error('JSON waveform has no channels or leads');
  }

  const minLen = Math.min(...channels.map((c) => c.samples.length));
  if (channels.some((c) => c.samples.length !== minLen)) {
    warnings.push('Channel lengths differ — truncated to shortest channel.');
    for (const ch of channels) {
      ch.samples = ch.samples.subarray(0, minLen);
    }
  }

  return {
    sampleRateHz,
    channels,
    durationSec: minLen / sampleRateHz,
    warnings
  };
}

function parseCsvWaveform(text: string, sampleRateHz: number, warnings: string[]): ParsedWaveform {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (lines.length < 2) {
    throw new Error('CSV waveform needs a header row and at least one data row');
  }

  const header = parseCsvLine(lines[0]);
  let dataStart = 0;
  let timeCol = -1;
  const channelCols: Array<{ id: string; index: number }> = [];

  header.forEach((name, index) => {
    const lower = name.toLowerCase();
    if (lower === 'time' || lower === 't' || lower === 'sec' || lower === 'seconds') {
      timeCol = index;
    } else {
      channelCols.push({ id: name, index });
    }
  });

  if (!channelCols.length) {
    throw new Error('CSV header must include at least one channel column');
  }

  const columnValues: number[][] = channelCols.map(() => []);
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length < header.length) continue;
    channelCols.forEach((col, ci) => {
      const v = Number(cells[col.index]);
      columnValues[ci].push(Number.isFinite(v) ? v : 0);
    });
    dataStart += 1;
    void dataStart;
    void timeCol;
  }

  const channels: WaveformChannel[] = channelCols.map((col, ci) => ({
    id: col.id,
    label: col.id,
    samples: toFloatArray(columnValues[ci])
  }));

  const minLen = Math.min(...channels.map((c) => c.samples.length));
  for (const ch of channels) {
    if (ch.samples.length > minLen) {
      ch.samples = ch.samples.subarray(0, minLen);
    }
  }

  if (!sampleRateHz || sampleRateHz <= 0) {
    warnings.push('Sample rate missing — defaulting to 500 Hz.');
    sampleRateHz = 500;
  }

  return {
    sampleRateHz,
    channels,
    durationSec: minLen / sampleRateHz,
    warnings
  };
}

export function parseWaveformBytes(
  bytes: Uint8Array,
  extension: string,
  defaultSampleRate?: number
): ParsedWaveform {
  const warnings: string[] = [];
  const text = decodeUtf8(bytes).trim();
  if (!text) {
    throw new Error('Empty waveform file');
  }

  const ext = extension.toLowerCase();
  const fallbackRate = defaultSampleRate ?? inferSampleRateFromExtension(ext, 500);

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return parseJsonWaveform(text, warnings);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Invalid JSON waveform');
    }
  }

  return parseCsvWaveform(text, fallbackRate, warnings);
}

export function applyMontage(
  waveform: ParsedWaveform,
  mode: WaveformMontageMode,
  visibleChannelIds: string[]
): WaveformChannel[] {
  const visible = waveform.channels.filter((c) => visibleChannelIds.includes(c.id));
  if (!visible.length) return [];

  if (mode === 'referential') {
    return visible;
  }

  if (mode === 'average') {
    const len = visible[0].samples.length;
    const avg = new Float32Array(len);
    for (const ch of visible) {
      for (let i = 0; i < len; i++) {
        avg[i] += ch.samples[i];
      }
    }
    for (let i = 0; i < len; i++) {
      avg[i] /= visible.length;
    }
    return visible.map((ch) => {
      const out = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        out[i] = ch.samples[i] - avg[i];
      }
      return { id: ch.id, label: `${ch.label} − avg`, samples: out };
    });
  }

  // bipolar: adjacent differences
  const bipolar: WaveformChannel[] = [];
  for (let i = 0; i < visible.length - 1; i++) {
    const a = visible[i];
    const b = visible[i + 1];
    const len = Math.min(a.samples.length, b.samples.length);
    const out = new Float32Array(len);
    for (let j = 0; j < len; j++) {
      out[j] = a.samples[j] - b.samples[j];
    }
    bipolar.push({
      id: `${a.id}-${b.id}`,
      label: `${a.label} − ${b.label}`,
      samples: out
    });
  }
  return bipolar.length ? bipolar : visible;
}

export function computeCaliper(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pixelsPerSecond: number,
  gain: number
): { deltaTimeMs: number; deltaAmplitude: number } {
  const deltaTimeMs = (Math.abs(x2 - x1) / Math.max(1e-6, pixelsPerSecond)) * 1000;
  const deltaAmplitude = Math.abs(y2 - y1) / Math.max(1e-6, gain);
  return { deltaTimeMs, deltaAmplitude };
}
