export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const context = new AudioContext();
  try {
    return await context.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await context.close();
  }
}

export function computeWaveformPeaks(buffer: AudioBuffer, barCount = 1000): number[] {
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

export function drawWaveformCanvas(
  canvas: HTMLCanvasElement,
  peaks: number[],
  playheadRatio: number | null = null
): void {
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

  for (let i = 0; i < peaks.length; i++) {
    const peak = peaks[i] ?? 0;
    const barHeight = Math.max(1, peak * (height * 0.9));
    ctx.fillStyle = '#007bff';
    ctx.fillRect(i * barWidth, midY - barHeight / 2, Math.max(1, barWidth - 0.5), barHeight);
  }

  if (playheadRatio != null) {
    const x = Math.max(0, Math.min(1, playheadRatio)) * width;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

export function drawSpectrumCanvas(
  canvas: HTMLCanvasElement,
  frequencyData: Uint8Array
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || frequencyData.length === 0) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  const barWidth = width / frequencyData.length;

  for (let i = 0; i < frequencyData.length; i++) {
    const value = frequencyData[i] ?? 0;
    const barHeight = (value / 255) * height;
    const hue = 200 - (value / 255) * 120;
    ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
    ctx.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth - 0.5), barHeight);
  }
}

export interface SpectrogramData {
  columns: Float32Array[];
  minDb: number;
  maxDb: number;
}

export function computeOfflineSpectrogram(
  buffer: AudioBuffer,
  options: { fftSize?: number; hopSize?: number; maxColumns?: number } = {}
): SpectrogramData {
  const fftSize = options.fftSize ?? 1024;
  const hopSize = options.hopSize ?? 256;
  const maxColumns = options.maxColumns ?? 800;
  const channel = buffer.getChannelData(0);
  const columns: Float32Array[] = [];
  let minDb = 0;
  let maxDb = -100;

  const hann = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  for (let start = 0; start + fftSize < channel.length && columns.length < maxColumns; start += hopSize) {
    const windowed = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      windowed[i] = (channel[start + i] ?? 0) * (hann[i] ?? 1);
    }
    const magnitudes = fftMagnitudes(windowed);
    const db = new Float32Array(magnitudes.length);
    for (let i = 0; i < magnitudes.length; i++) {
      const amp = magnitudes[i] ?? 0;
      const value = 20 * Math.log10(amp + 1e-12);
      db[i] = value;
      minDb = Math.min(minDb, value);
      maxDb = Math.max(maxDb, value);
    }
    columns.push(db);
  }

  return { columns, minDb, maxDb: maxDb <= minDb ? minDb + 1 : maxDb };
}

function fftMagnitudes(timeDomain: Float32Array): Float32Array {
  const n = timeDomain.length;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  re.set(timeDomain);
  fftInPlace(re, im);
  const half = Math.floor(n / 2);
  const magnitudes = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    magnitudes[i] = Math.sqrt((re[i] ?? 0) ** 2 + (im[i] ?? 0) ** 2) / n;
  }
  return magnitudes;
}

function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const angle = (-2 * Math.PI) / size;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < half; k++) {
        const even = start + k;
        const odd = start + k + half;
        const tRe = curRe * (re[odd] ?? 0) - curIm * (im[odd] ?? 0);
        const tIm = curRe * (im[odd] ?? 0) + curIm * (re[odd] ?? 0);
        re[odd] = (re[even] ?? 0) - tRe;
        im[odd] = (im[even] ?? 0) - tIm;
        re[even] = (re[even] ?? 0) + tRe;
        im[even] = (im[even] ?? 0) + tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

export function drawSpectrogramCanvas(
  canvas: HTMLCanvasElement,
  data: SpectrogramData,
  zoomStart = 0,
  zoomEnd = 1
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || data.columns.length === 0) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const startCol = Math.floor(zoomStart * data.columns.length);
  const endCol = Math.ceil(zoomEnd * data.columns.length);
  const visible = data.columns.slice(startCol, endCol);
  if (visible.length === 0) {
    return;
  }

  const bins = visible[0]?.length ?? 0;
  const colWidth = width / visible.length;

  for (let x = 0; x < visible.length; x++) {
    const column = visible[x] ?? new Float32Array();
    for (let y = 0; y < bins; y++) {
      const db = column[y] ?? data.minDb;
      const t = (db - data.minDb) / (data.maxDb - data.minDb);
      const clamped = Math.max(0, Math.min(1, t));
      const hue = 240 - clamped * 240;
      ctx.fillStyle = `hsl(${hue}, 85%, ${20 + clamped * 45}%)`;
      const py = height - ((y + 1) / bins) * height;
      const ph = height / bins + 0.5;
      ctx.fillRect(x * colWidth, py, Math.max(1, colWidth), ph);
    }
  }
}

export function isAudioAnalysisFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith('audio/') ||
    name.endsWith('.wav') ||
    name.endsWith('.mp3') ||
    name.endsWith('.ogg') ||
    name.endsWith('.flac') ||
    name.endsWith('.m4a') ||
    name.endsWith('.aac')
  );
}

export function formatAudioDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
