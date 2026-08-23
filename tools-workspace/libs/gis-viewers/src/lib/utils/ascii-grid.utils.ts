/**
 * ESRI / ArcInfo ASCII Grid (.asc) parser — pure TypeScript.
 */

export interface AsciiGridHeader {
  ncols: number;
  nrows: number;
  /** Lower-left corner X (cell corner). */
  xllcorner: number | null;
  /** Lower-left corner Y (cell corner). */
  yllcorner: number | null;
  /** Lower-left center X when xllcenter is used. */
  xllcenter: number | null;
  yllcenter: number | null;
  cellsize: number;
  nodata: number | null;
}

export interface AsciiGridResult {
  header: AsciiGridHeader;
  /** Row-major values, length ncols * nrows (north row first). */
  values: Float64Array;
  bounds: { west: number; south: number; east: number; north: number } | null;
  warnings: string[];
}

const HEADER_KEYS = new Set([
  'ncols',
  'nrows',
  'xllcorner',
  'yllcorner',
  'xllcenter',
  'yllcenter',
  'cellsize',
  'nodata_value',
  'nodata'
]);

export function parseAsciiGrid(text: string): AsciiGridResult {
  if (!text || !text.trim()) {
    throw new Error('ASCII Grid is empty');
  }

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const header: AsciiGridHeader = {
    ncols: 0,
    nrows: 0,
    xllcorner: null,
    yllcorner: null,
    xllcenter: null,
    yllcenter: null,
    cellsize: 0,
    nodata: null
  };

  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) {
      continue;
    }
    const parts = raw.split(/[ \t]+/);
    const key = parts[0].toLowerCase();
    if (!HEADER_KEYS.has(key) || parts.length < 2) {
      dataStart = i;
      break;
    }
    const num = Number(parts[1]);
    if (!Number.isFinite(num) && key !== 'nodata_value' && key !== 'nodata') {
      throw new Error(`Invalid ASCII Grid header value for ${parts[0]}`);
    }
    switch (key) {
      case 'ncols':
        header.ncols = Math.floor(num);
        break;
      case 'nrows':
        header.nrows = Math.floor(num);
        break;
      case 'xllcorner':
        header.xllcorner = num;
        break;
      case 'yllcorner':
        header.yllcorner = num;
        break;
      case 'xllcenter':
        header.xllcenter = num;
        break;
      case 'yllcenter':
        header.yllcenter = num;
        break;
      case 'cellsize':
        header.cellsize = num;
        break;
      case 'nodata_value':
      case 'nodata':
        header.nodata = Number.isFinite(num) ? num : null;
        break;
      default:
        break;
    }
    dataStart = i + 1;
  }

  if (header.ncols <= 0 || header.nrows <= 0) {
    throw new Error('ASCII Grid requires positive ncols and nrows');
  }
  if (!(header.cellsize > 0)) {
    throw new Error('ASCII Grid requires positive cellsize');
  }

  const expected = header.ncols * header.nrows;
  const values = new Float64Array(expected);
  let idx = 0;
  for (let i = dataStart; i < lines.length && idx < expected; i++) {
    const raw = lines[i].trim();
    if (!raw) {
      continue;
    }
    const parts = raw.split(/[ \t]+/);
    for (const p of parts) {
      if (!p) continue;
      const v = Number(p);
      if (!Number.isFinite(v)) {
        throw new Error(`Non-numeric cell value at index ${idx}`);
      }
      values[idx++] = v;
      if (idx >= expected) break;
    }
  }

  const warnings: string[] = [];
  if (idx < expected) {
    throw new Error(`Expected ${expected} cell values, found ${idx}`);
  }
  if (idx > expected) {
    warnings.push('Extra cell values after grid were ignored.');
  }

  const half = header.cellsize / 2;
  let west: number | null = null;
  let south: number | null = null;
  if (header.xllcorner != null && header.yllcorner != null) {
    west = header.xllcorner;
    south = header.yllcorner;
  } else if (header.xllcenter != null && header.yllcenter != null) {
    west = header.xllcenter - half;
    south = header.yllcenter - half;
  }

  let bounds: AsciiGridResult['bounds'] = null;
  if (west != null && south != null) {
    bounds = {
      west,
      south,
      east: west + header.ncols * header.cellsize,
      north: south + header.nrows * header.cellsize
    };
  } else {
    warnings.push('No georeferencing (xllcorner/yllcorner or centers) — overlay uses default world view.');
  }

  if (expected > 4_000_000) {
    warnings.push(
      `Large grid (${header.ncols}×${header.nrows}). Preview may downsample for performance.`
    );
  }

  let valid = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (header.nodata != null && v === header.nodata) continue;
    if (Number.isFinite(v)) valid += 1;
  }
  if (valid === 0) {
    warnings.push('No valid samples found (all nodata or empty).');
  }

  return { header, values, bounds, warnings };
}

/** Downsample grid so longest side ≤ maxSide (nearest neighbour). */
export function downsampleAsciiGrid(
  values: Float64Array,
  width: number,
  height: number,
  maxSide: number
): { values: Float64Array; width: number; height: number; downsampled: boolean } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) {
    return { values, width, height, downsampled: false };
  }
  const scale = maxSide / longest;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, Math.floor((y / h) * height));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.floor((x / w) * width));
      out[y * w + x] = values[sy * width + sx];
    }
  }
  return { values: out, width: w, height: h, downsampled: true };
}
