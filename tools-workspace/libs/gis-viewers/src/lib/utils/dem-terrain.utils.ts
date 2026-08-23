import type {
  DemColormap,
  DemDisplayMode,
  DemElevationStats
} from '../types/dem-viewer.types';
import type { GeotiffBounds } from '../types/geotiff-viewer.types';
import { canvasToDataUrl } from './geotiff-raster.utils';

export const DEFAULT_AZIMUTH = 315;
export const DEFAULT_ALTITUDE = 45;
export const DEFAULT_Z_FACTOR = 1;
export const MAX_CONTOUR_LEVELS = 80;

/** Compute min/max/mean/range, ignoring nodata and non-finite values. */
export function computeElevationStats(
  values: ArrayLike<number>,
  nodata: number | null = null
): DemElevationStats {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let validCount = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      continue;
    }
    if (nodata != null && v === nodata) {
      continue;
    }
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    validCount += 1;
  }
  if (validCount === 0) {
    return { min: 0, max: 0, mean: 0, range: 0, validCount: 0 };
  }
  return {
    min,
    max,
    mean: sum / validCount,
    range: max - min,
    validCount
  };
}

/** Linear interpolate RGB stops; t in [0, 1]. */
function lerpRgb(
  stops: Array<[number, number, number, number]>,
  t: number
): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (x >= a[0] && x <= b[0]) {
      const u = (x - a[0]) / (b[0] - a[0] || 1);
      return [
        Math.round(a[1] + (b[1] - a[1]) * u),
        Math.round(a[2] + (b[2] - a[2]) * u),
        Math.round(a[3] + (b[3] - a[3]) * u)
      ];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

const COLORMAPS: Record<DemColormap, Array<[number, number, number, number]>> = {
  grayscale: [
    [0, 0, 0, 0],
    [1, 255, 255, 255]
  ],
  terrain: [
    [0, 0, 97, 71],
    [0.15, 16, 133, 58],
    [0.35, 120, 168, 70],
    [0.55, 210, 190, 100],
    [0.75, 180, 130, 80],
    [0.9, 160, 160, 160],
    [1, 245, 245, 245]
  ],
  viridis: [
    [0, 68, 1, 84],
    [0.25, 59, 82, 139],
    [0.5, 33, 145, 140],
    [0.75, 94, 201, 98],
    [1, 253, 231, 37]
  ],
  hypsometric: [
    [0, 0, 70, 150],
    [0.2, 40, 160, 80],
    [0.4, 180, 200, 80],
    [0.6, 200, 140, 60],
    [0.8, 160, 90, 50],
    [1, 255, 255, 255]
  ]
};

export function colormapRgb(
  colormap: DemColormap,
  t: number
): [number, number, number] {
  return lerpRgb(COLORMAPS[colormap] || COLORMAPS.terrain, t);
}

export function legendGradientCss(colormap: DemColormap): string {
  const stops = COLORMAPS[colormap] || COLORMAPS.terrain;
  const parts = stops.map(([p, r, g, b]) => `rgb(${r},${g},${b}) ${(p * 100).toFixed(0)}%`);
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

/**
 * Horn algorithm hillshade. Returns Float64Array of shade values in [0, 1].
 * cellSize is approximate ground units per pixel (same X/Y for preview).
 */
export function computeHillshade(
  elevation: ArrayLike<number>,
  width: number,
  height: number,
  options: {
    azimuth?: number;
    altitude?: number;
    zFactor?: number;
    cellSize?: number;
    nodata?: number | null;
  } = {}
): Float64Array {
  const azimuthDeg = options.azimuth ?? DEFAULT_AZIMUTH;
  const altitudeDeg = options.altitude ?? DEFAULT_ALTITUDE;
  const zFactor = options.zFactor ?? DEFAULT_Z_FACTOR;
  const cellSize = options.cellSize ?? 1;
  const nodata = options.nodata ?? null;

  const azimuth = ((360 - azimuthDeg + 90) % 360) * (Math.PI / 180);
  const zenith = (90 - altitudeDeg) * (Math.PI / 180);
  const cosZenith = Math.cos(zenith);
  const sinZenith = Math.sin(zenith);

  const out = new Float64Array(width * height);
  const get = (x: number, y: number): number | null => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return null;
    }
    const v = elevation[y * width + x];
    if (!Number.isFinite(v) || (nodata != null && v === nodata)) {
      return null;
    }
    return v;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const center = get(x, y);
      if (center == null) {
        out[y * width + x] = 0;
        continue;
      }
      const z1 = get(x - 1, y - 1) ?? center;
      const z2 = get(x, y - 1) ?? center;
      const z3 = get(x + 1, y - 1) ?? center;
      const z4 = get(x - 1, y) ?? center;
      const z6 = get(x + 1, y) ?? center;
      const z7 = get(x - 1, y + 1) ?? center;
      const z8 = get(x, y + 1) ?? center;
      const z9 = get(x + 1, y + 1) ?? center;

      const dzdx = ((z3 + 2 * z6 + z9) - (z1 + 2 * z4 + z7)) / (8 * cellSize);
      const dzdy = ((z7 + 2 * z8 + z9) - (z1 + 2 * z2 + z3)) / (8 * cellSize);
      const sx = dzdx * zFactor;
      const sy = dzdy * zFactor;
      const slope = Math.atan(Math.sqrt(sx * sx + sy * sy));
      let aspect = Math.atan2(sy, -sx);
      if (sx === 0 && sy === 0) {
        aspect = 0;
      }
      let shade =
        cosZenith * Math.cos(slope) +
        sinZenith * Math.sin(slope) * Math.cos(azimuth - aspect);
      shade = Math.max(0, Math.min(1, shade));
      out[y * width + x] = shade;
    }
  }
  return out;
}

export function buildElevationCanvas(
  elevation: ArrayLike<number>,
  width: number,
  height: number,
  options: {
    colormap: DemColormap;
    displayMode: DemDisplayMode;
    stats: DemElevationStats;
    nodata?: number | null;
    hillshade?: ArrayLike<number> | null;
  }
): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    throw new Error('Canvas is only available in the browser');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D canvas context');
  }
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const nodata = options.nodata ?? null;
  const range = options.stats.range || 1;
  const min = options.stats.min;
  const shade = options.hillshade;

  for (let i = 0; i < width * height; i++) {
    const v = elevation[i];
    const o = i * 4;
    if (!Number.isFinite(v) || (nodata != null && v === nodata)) {
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 0;
      continue;
    }
    const t = (v - min) / range;
    const [cr, cg, cb] = colormapRgb(options.colormap, t);
    const s = shade ? shade[i] : 1;

    if (options.displayMode === 'elevation') {
      data[o] = cr;
      data[o + 1] = cg;
      data[o + 2] = cb;
    } else if (options.displayMode === 'hillshade') {
      const g = Math.round(s * 255);
      data[o] = g;
      data[o + 1] = g;
      data[o + 2] = g;
    } else {
      // shaded-relief: color × hillshade
      data[o] = Math.round(cr * s);
      data[o + 1] = Math.round(cg * s);
      data[o + 2] = Math.round(cb * s);
    }
    data[o + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function renderElevationDataUrl(
  elevation: ArrayLike<number>,
  width: number,
  height: number,
  options: {
    colormap: DemColormap;
    displayMode: DemDisplayMode;
    stats: DemElevationStats;
    nodata?: number | null;
    azimuth?: number;
    altitude?: number;
    zFactor?: number;
  }
): { dataUrl: string; canvas: HTMLCanvasElement; hillshade: Float64Array | null } {
  let hillshade: Float64Array | null = null;
  if (options.displayMode !== 'elevation') {
    hillshade = computeHillshade(elevation, width, height, {
      azimuth: options.azimuth,
      altitude: options.altitude,
      zFactor: options.zFactor,
      nodata: options.nodata
    });
  }
  const canvas = buildElevationCanvas(elevation, width, height, {
    colormap: options.colormap,
    displayMode: options.displayMode,
    stats: options.stats,
    nodata: options.nodata,
    hillshade
  });
  return { dataUrl: canvasToDataUrl(canvas), canvas, hillshade };
}

/**
 * Marching-squares contour extraction → GeoJSON LineStrings.
 * Caps level count at maxLevels.
 */
export function extractContours(
  elevation: ArrayLike<number>,
  width: number,
  height: number,
  options: {
    interval: number;
    nodata?: number | null;
    bounds?: GeotiffBounds | null;
    maxLevels?: number;
    stats?: DemElevationStats | null;
  }
): GeoJSON.FeatureCollection {
  const nodata = options.nodata ?? null;
  const maxLevels = options.maxLevels ?? MAX_CONTOUR_LEVELS;
  const stats = options.stats ?? computeElevationStats(elevation, nodata);
  const interval = Math.max(1e-9, options.interval);
  if (stats.validCount === 0 || stats.range <= 0) {
    return { type: 'FeatureCollection', features: [] };
  }

  let start = Math.ceil(stats.min / interval) * interval;
  if (start < stats.min) {
    start += interval;
  }
  const levels: number[] = [];
  for (let level = start; level <= stats.max && levels.length < maxLevels; level += interval) {
    levels.push(Number(level.toPrecision(12)));
  }

  const bounds = options.bounds;
  const pixelToLng = (x: number): number => {
    if (!bounds) return x;
    return bounds.west + (x / Math.max(1, width - 1)) * (bounds.east - bounds.west);
  };
  const pixelToLat = (y: number): number => {
    if (!bounds) return y;
    return bounds.north - (y / Math.max(1, height - 1)) * (bounds.north - bounds.south);
  };

  const features: GeoJSON.Feature[] = [];
  const getVal = (x: number, y: number): number => {
    const v = elevation[y * width + x];
    if (!Number.isFinite(v) || (nodata != null && v === nodata)) {
      return NaN;
    }
    return v;
  };

  for (const level of levels) {
    const segments: Array<[[number, number], [number, number]]> = [];
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const tl = getVal(x, y);
        const tr = getVal(x + 1, y);
        const br = getVal(x + 1, y + 1);
        const bl = getVal(x, y + 1);
        if ([tl, tr, br, bl].some((v) => !Number.isFinite(v))) {
          continue;
        }
        let code = 0;
        if (tl >= level) code |= 1;
        if (tr >= level) code |= 2;
        if (br >= level) code |= 4;
        if (bl >= level) code |= 8;
        if (code === 0 || code === 15) {
          continue;
        }
        const lerp = (a: number, b: number, va: number, vb: number): number => {
          if (Math.abs(vb - va) < 1e-12) return (a + b) / 2;
          return a + ((level - va) / (vb - va)) * (b - a);
        };
        const top: [number, number] = [lerp(x, x + 1, tl, tr), y];
        const right: [number, number] = [x + 1, lerp(y, y + 1, tr, br)];
        const bottom: [number, number] = [lerp(x, x + 1, bl, br), y + 1];
        const left: [number, number] = [x, lerp(y, y + 1, tl, bl)];

        const push = (a: [number, number], b: [number, number]) => {
          segments.push([a, b]);
        };
        switch (code) {
          case 1:
          case 14:
            push(left, top);
            break;
          case 2:
          case 13:
            push(top, right);
            break;
          case 3:
          case 12:
            push(left, right);
            break;
          case 4:
          case 11:
            push(right, bottom);
            break;
          case 5:
            push(left, top);
            push(right, bottom);
            break;
          case 6:
          case 9:
            push(top, bottom);
            break;
          case 7:
          case 8:
            push(left, bottom);
            break;
          case 10:
            push(top, right);
            push(left, bottom);
            break;
          default:
            break;
        }
      }
    }

    // Convert segments to LineString features (each segment = short line for simplicity).
    for (const [a, b] of segments) {
      features.push({
        type: 'Feature',
        properties: { elevation: level },
        geometry: {
          type: 'LineString',
          coordinates: [
            [pixelToLng(a[0]), pixelToLat(a[1])],
            [pixelToLng(b[0]), pixelToLat(b[1])]
          ]
        }
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

export function suggestContourInterval(stats: DemElevationStats, maxLevels = MAX_CONTOUR_LEVELS): number {
  if (stats.range <= 0) {
    return 1;
  }
  const raw = stats.range / Math.max(1, maxLevels - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let nice = 1;
  if (norm > 5) nice = 10;
  else if (norm > 2) nice = 5;
  else if (norm > 1) nice = 2;
  return nice * mag;
}

/** Bilinear sample elevation at lat/lng given WGS84-like bounds. */
export function sampleElevationAtLatLng(
  elevation: ArrayLike<number>,
  width: number,
  height: number,
  bounds: GeotiffBounds | null,
  lat: number,
  lng: number,
  nodata: number | null = null
): number | null {
  if (!bounds || width < 2 || height < 2) {
    return null;
  }
  const { west, south, east, north } = bounds;
  if (lng < west || lng > east || lat < south || lat > north) {
    return null;
  }
  const fx = ((lng - west) / (east - west)) * (width - 1);
  const fy = ((north - lat) / (north - south)) * (height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const get = (x: number, y: number): number | null => {
    const v = elevation[y * width + x];
    if (!Number.isFinite(v) || (nodata != null && v === nodata)) {
      return null;
    }
    return v;
  };

  const v00 = get(x0, y0);
  const v10 = get(x1, y0);
  const v01 = get(x0, y1);
  const v11 = get(x1, y1);
  if (v00 == null || v10 == null || v01 == null || v11 == null) {
    return v00 ?? v10 ?? v01 ?? v11;
  }
  const a = v00 * (1 - tx) + v10 * tx;
  const b = v01 * (1 - tx) + v11 * tx;
  return a * (1 - ty) + b * ty;
}

export function drawContoursOnCanvas(
  canvas: HTMLCanvasElement,
  contours: GeoJSON.FeatureCollection,
  bounds: GeotiffBounds | null,
  strokeStyle = 'rgba(30, 30, 30, 0.65)'
): void {
  if (!bounds) {
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  const { width, height } = canvas;
  const { west, south, east, north } = bounds;
  const toX = (lng: number) => ((lng - west) / (east - west)) * (width - 1);
  const toY = (lat: number) => ((north - lat) / (north - south)) * (height - 1);

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;
  for (const feature of contours.features) {
    if (feature.geometry?.type !== 'LineString') {
      continue;
    }
    const coords = feature.geometry.coordinates as number[][];
    if (coords.length < 2) {
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(toX(coords[0][0]), toY(coords[0][1]));
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(toX(coords[i][0]), toY(coords[i][1]));
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function copyElevationBand(band: ArrayLike<number>): Float64Array {
  const out = new Float64Array(band.length);
  for (let i = 0; i < band.length; i++) {
    out[i] = band[i];
  }
  return out;
}
