import { CLIMATE_JSON_SAMPLE } from '../constants/climate-sample.data';
import { CLIMATE_MAX_FILE_BYTES, CLIMATE_SUPPORTED_EXTENSIONS } from '../constants/climate-data-viewer.constants';
import type {
  ClimateDataset,
  ClimateHistogramBar,
  ClimateLoadedFile,
  ClimateMetadataRow,
  ClimateStation,
  ClimateSuggestion
} from '../types/climate-data-viewer.types';
import {
  climateSpatialMeanSeries,
  extractClimateSlice,
  parseClimateBytes
} from './climate-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { computeVolumeHistogram } from './volume-slice.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatClimateFileSize,
  readFileBytes as readClimateFileBytes
} from './science-file.utils';

export {
  climateFromGrib,
  climateFromNetcdf,
  climateGridIndex,
  climateSpatialMeanSeries,
  extractClimateSlice,
  parseClimateBytes,
  parseClimateText
} from './climate-parse.utils';

export { filterClimateStations, renderClimateMap, renderClimateSeries } from './climate-render.utils';

export function isSupportedClimateFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (CLIMATE_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateClimateFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > CLIMATE_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(CLIMATE_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidClimateFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const file of Array.from(files)) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'Duplicate file in this selection' });
      continue;
    }
    seen.add(key);
    if (/\.gz$/i.test(file.name)) {
      rejected.push({ name: file.name, reason: 'Compressed climate files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedClimateFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .nc, .grib/.grib2, .json, .csv, or .clim)' });
      continue;
    }
    const sizeError = validateClimateFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleClimateFile(): File {
  return new File([CLIMATE_JSON_SAMPLE], 'sample-ethiopia-tas.json', {
    type: 'application/json',
    lastModified: 0
  });
}

export function createClimateFileRecord(file: File, bytes: Uint8Array): ClimateLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  const warnings: string[] = [];
  let parsed: ClimateDataset | null = null;
  let softFail = false;
  try {
    parsed = parseClimateBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nt || (!parsed.nx && !parsed.stations.length)) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse climate data');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportClimate(file: ClimateLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function defaultClimateWindow(dataset: ClimateDataset): { center: number; width: number } {
  if (!Number.isFinite(dataset.dataMin) || dataset.dataMin === dataset.dataMax) return { center: 0, width: 1 };
  return { center: (dataset.dataMin + dataset.dataMax) / 2, width: dataset.dataMax - dataset.dataMin };
}

export function buildClimateMetadataRows(dataset: ClimateDataset): ClimateMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Variable', value: `${dataset.longName || dataset.variable}${dataset.unit ? ` (${dataset.unit})` : ''}` },
    { key: 'Grid', value: dataset.nx && dataset.ny ? `${dataset.nx} × ${dataset.ny}` : '—' },
    { key: 'Times', value: String(dataset.nt) },
    { key: 'Stations', value: String(dataset.stations.length) },
    { key: 'Range', value: `${dataset.dataMin.toFixed(2)} – ${dataset.dataMax.toFixed(2)} ${dataset.unit}`.trim() }
  ];
}

export function buildClimateHistogram(dataset: ClimateDataset, timeIndex: number): ClimateHistogramBar[] {
  const slice = extractClimateSlice(dataset, timeIndex);
  const data = slice.length ? slice : Float32Array.from(dataset.stations.flatMap((s) => s.values));
  if (!data.length) return [];
  const hist = computeVolumeHistogram(data, 12);
  const maxCount = Math.max(...hist.counts, 1);
  return hist.counts.map((count, i) => ({
    label: hist.binEdges[i].toFixed(1),
    count,
    heightPct: Math.round((count / maxCount) * 100)
  }));
}

export function exportClimateSummaryJson(file: ClimateLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed climate data');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      variable: parsed.variable,
      unit: parsed.unit,
      times: parsed.times,
      grid: parsed.nx && parsed.ny ? `${parsed.nx}×${parsed.ny}×${parsed.nt}` : null,
      stations: parsed.stations.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon })),
      dataMin: parsed.dataMin,
      dataMax: parsed.dataMax
    },
    null,
    2
  );
}

export function exportClimateGridCsv(dataset: ClimateDataset, timeIndex?: number): string {
  const lines = ['time,lat,lon,value'];
  if (!dataset.nx || !dataset.ny) return lines.join('\n');
  const times = timeIndex == null ? dataset.times.map((_, i) => i) : [Math.max(0, Math.min(dataset.nt - 1, timeIndex))];
  for (const t of times) {
    for (let j = 0; j < dataset.ny; j++) {
      for (let i = 0; i < dataset.nx; i++) {
        const value = dataset.grid[t * dataset.ny * dataset.nx + j * dataset.nx + i];
        if (!Number.isFinite(value)) continue;
        lines.push(`${dataset.times[t]},${dataset.lats[j]},${dataset.lons[i]},${value}`);
      }
    }
  }
  return lines.join('\n');
}

export function exportClimateSeriesCsv(dataset: ClimateDataset): string {
  const mean = climateSpatialMeanSeries(dataset);
  const header = ['time', ...(dataset.nx ? ['spatial_mean'] : []), ...dataset.stations.map((s) => s.id)];
  const lines = [header.join(',')];
  dataset.times.forEach((time, t) => {
    const row = [time];
    if (dataset.nx) row.push(Number.isFinite(mean[t]) ? String(mean[t]) : '');
    for (const station of dataset.stations) {
      const v = station.values[t];
      row.push(Number.isFinite(v) ? String(v) : '');
    }
    lines.push(row.join(','));
  });
  return lines.join('\n');
}

export function resolveClimateSuggestion(state: { hasFiles: boolean; hasError: boolean }): ClimateSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the Ethiopia TAS sample',
      reason: 'Load a local monthly temperature grid with stations to explore maps and time series.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a climate dataset',
      reason: 'Drop NetCDF, GRIB, JSON, or CSV — or load the sample Horn of Africa temperature field.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  return null;
}

export function climateTableRows(
  dataset: ClimateDataset,
  timeIndex: number,
  limit = 400
): Array<{ time: string; lat: string; lon: string; value: string }> {
  const t = Math.max(0, Math.min(dataset.nt - 1, timeIndex));
  const rows: Array<{ time: string; lat: string; lon: string; value: string }> = [];
  if (dataset.nx && dataset.ny) {
    for (let j = 0; j < dataset.ny && rows.length < limit; j++) {
      for (let i = 0; i < dataset.nx && rows.length < limit; i++) {
        const value = dataset.grid[t * dataset.ny * dataset.nx + j * dataset.nx + i];
        rows.push({
          time: dataset.times[t],
          lat: Number.isFinite(dataset.lats[j]) ? dataset.lats[j].toFixed(2) : String(j),
          lon: Number.isFinite(dataset.lons[i]) ? dataset.lons[i].toFixed(2) : String(i),
          value: Number.isFinite(value) ? value.toFixed(3) : '—'
        });
      }
    }
  }
  return rows;
}

export function climateStationValue(station: ClimateStation, timeIndex: number): string {
  const v = station.values[timeIndex];
  return Number.isFinite(v) ? v.toFixed(2) : '—';
}
