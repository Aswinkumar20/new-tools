/** Shared 3D volume slice extraction (x fastest, y, z slowest). */

export type VolumePlane = 'axial' | 'coronal' | 'sagittal';

export interface VolumeSliceResult {
  pixels: Float32Array;
  width: number;
  height: number;
  index: number;
}

export function extractVolumeSlice(
  data: Float32Array,
  dims: [number, number, number],
  plane: VolumePlane,
  index: number
): VolumeSliceResult {
  const [nx, ny, nz] = dims;

  if (plane === 'axial') {
    const z = Math.max(0, Math.min(nz - 1, index));
    const pixels = new Float32Array(nx * ny);
    const base = z * nx * ny;
    for (let i = 0; i < nx * ny; i++) {
      pixels[i] = data[base + i];
    }
    return { pixels, width: nx, height: ny, index: z };
  }

  if (plane === 'coronal') {
    const y = Math.max(0, Math.min(ny - 1, index));
    const pixels = new Float32Array(nx * nz);
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        pixels[z * nx + x] = data[z * nx * ny + y * nx + x];
      }
    }
    return { pixels, width: nx, height: nz, index: y };
  }

  const x = Math.max(0, Math.min(nx - 1, index));
  const pixels = new Float32Array(ny * nz);
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      pixels[z * ny + y] = data[z * nx * ny + y * nx + x];
    }
  }
  return { pixels, width: ny, height: nz, index: x };
}

export function maxVolumeSliceIndex(dims: [number, number, number], plane: VolumePlane): number {
  const [nx, ny, nz] = dims;
  if (plane === 'axial') return Math.max(0, nz - 1);
  if (plane === 'coronal') return Math.max(0, ny - 1);
  return Math.max(0, nx - 1);
}

export function minMaxVolume(data: ArrayLike<number>): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) {
    return { min: 0, max: 0 };
  }
  return { min, max };
}

export function computeVolumeHistogram(data: Float32Array, binCount = 32): {
  binEdges: number[];
  counts: number[];
  min: number;
  max: number;
} {
  if (!data.length) {
    return { binEdges: [0, 1], counts: [0], min: 0, max: 0 };
  }
  const { min, max } = minMaxVolume(data);
  if (!Number.isFinite(min) || min === max) {
    return { binEdges: [min, max || min + 1], counts: [data.length], min, max };
  }

  const bins = Math.max(4, binCount);
  const counts = new Array(bins).fill(0);
  const step = (max - min) / bins;
  const binEdges: number[] = [];
  for (let b = 0; b <= bins; b++) {
    binEdges.push(min + b * step);
  }
  for (let i = 0; i < data.length; i++) {
    let idx = Math.floor((data[i] - min) / step);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx] += 1;
  }
  return { binEdges, counts, min, max };
}
