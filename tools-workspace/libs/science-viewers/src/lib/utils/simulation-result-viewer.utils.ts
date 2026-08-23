import { SIMULATION_JSON_SAMPLE } from '../constants/simulation-sample.data';
import { SIM_MAX_FILE_BYTES, SIM_SUPPORTED_EXTENSIONS } from '../constants/simulation-result-viewer.constants';
import type {
  SimulationDataset,
  SimulationHistogramBar,
  SimulationLoadedFile,
  SimulationMetadataRow,
  SimulationSuggestion
} from '../types/simulation-result-viewer.types';
import { extractSimField, parseSimulationBytes } from './simulation-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { computeVolumeHistogram } from './volume-slice.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatSimFileSize,
  readFileBytes as readSimFileBytes
} from './science-file.utils';

export {
  extractSimField,
  extractSimSlice,
  parseSimulationBytes,
  parseSimulationText
} from './simulation-parse.utils';

export {
  filterSimulationProbes,
  renderSimulationField,
  renderSimulationProbes,
  renderSimulationSlice
} from './simulation-render.utils';

export function isSupportedSimFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SIM_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateSimFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SIM_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(SIM_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidSimFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed simulation files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedSimFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .csv, .vtk, or .sim)' });
      continue;
    }
    const sizeError = validateSimFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleSimFile(): File {
  return new File([SIMULATION_JSON_SAMPLE], 'sample-heat-diffusion.json', {
    type: 'application/json',
    lastModified: 0
  });
}

export function createSimFileRecord(file: File, bytes: Uint8Array): SimulationLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  const warnings: string[] = [];
  let parsed: SimulationDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSimulationBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.fields.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse simulation result');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSim(file: SimulationLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function defaultSimWindow(dataset: SimulationDataset): { center: number; width: number } {
  if (!Number.isFinite(dataset.dataMin) || dataset.dataMin === dataset.dataMax) return { center: 0, width: 1 };
  return { center: (dataset.dataMin + dataset.dataMax) / 2, width: dataset.dataMax - dataset.dataMin };
}

export function buildSimMetadataRows(dataset: SimulationDataset): SimulationMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Solver', value: dataset.solver || '—' },
    { key: 'Field', value: `${dataset.fieldName}${dataset.unit ? ` (${dataset.unit})` : ''}` },
    { key: 'Grid', value: `${dataset.nx} × ${dataset.ny}` },
    { key: 'Times', value: String(dataset.nt) },
    { key: 'Probes', value: String(dataset.probes.length) },
    { key: 'Range', value: `${dataset.dataMin.toFixed(3)} – ${dataset.dataMax.toFixed(3)} ${dataset.unit}`.trim() }
  ];
}

export function buildSimHistogram(dataset: SimulationDataset, timeIndex: number): SimulationHistogramBar[] {
  const field = extractSimField(dataset, timeIndex);
  if (!field.length) return [];
  const hist = computeVolumeHistogram(field, 12);
  const maxCount = Math.max(...hist.counts, 1);
  return hist.counts.map((count, i) => ({
    label: hist.binEdges[i].toFixed(1),
    count,
    heightPct: Math.round((count / maxCount) * 100)
  }));
}

export function exportSimSummaryJson(file: SimulationLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed simulation data');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      solver: parsed.solver,
      fieldName: parsed.fieldName,
      unit: parsed.unit,
      grid: `${parsed.nx}×${parsed.ny}`,
      times: parsed.times,
      probes: parsed.probes.map((p) => ({ id: p.id, name: p.name, i: p.i, j: p.j })),
      metrics: parsed.metrics.map((m) => ({ name: m.name, values: m.values })),
      dataMin: parsed.dataMin,
      dataMax: parsed.dataMax
    },
    null,
    2
  );
}

export function exportSimFieldCsv(dataset: SimulationDataset, timeIndex: number): string {
  const t = Math.max(0, Math.min(dataset.nt - 1, timeIndex));
  const field = dataset.fields[t];
  const lines = ['t,i,j,value'];
  if (!field) return lines.join('\n');
  for (let j = 0; j < dataset.ny; j++) {
    for (let i = 0; i < dataset.nx; i++) {
      const value = field[j * dataset.nx + i];
      if (!Number.isFinite(value)) continue;
      lines.push(`${dataset.times[t]},${i},${j},${value}`);
    }
  }
  return lines.join('\n');
}

export function exportSimProbesCsv(dataset: SimulationDataset): string {
  const header = ['time', ...dataset.probes.map((p) => p.id), ...dataset.metrics.map((m) => m.name)];
  const lines = [header.join(',')];
  dataset.times.forEach((time, t) => {
    const row = [String(time)];
    for (const probe of dataset.probes) {
      const v = probe.values[t];
      row.push(Number.isFinite(v) ? String(v) : '');
    }
    for (const metric of dataset.metrics) {
      const v = metric.values[t];
      row.push(Number.isFinite(v) ? String(v) : '');
    }
    lines.push(row.join(','));
  });
  return lines.join('\n');
}

export function resolveSimSuggestion(state: { hasFiles: boolean; hasError: boolean }): SimulationSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the heat-diffusion sample',
      reason: 'Load a local 2D temperature field with probes to explore slices and time series.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a simulation result',
      reason: 'Drop JSON, CSV, VTK ASCII, or .sim — or load the sample heat-diffusion run.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  return null;
}

export function simTableRows(
  dataset: SimulationDataset,
  timeIndex: number,
  limit = 400
): Array<{ t: string; i: number; j: number; value: string }> {
  const t = Math.max(0, Math.min(dataset.nt - 1, timeIndex));
  const field = dataset.fields[t];
  const rows: Array<{ t: string; i: number; j: number; value: string }> = [];
  if (!field) return rows;
  for (let j = 0; j < dataset.ny && rows.length < limit; j++) {
    for (let i = 0; i < dataset.nx && rows.length < limit; i++) {
      const value = field[j * dataset.nx + i];
      rows.push({
        t: String(dataset.times[t]),
        i,
        j,
        value: Number.isFinite(value) ? value.toFixed(3) : '—'
      });
    }
  }
  return rows;
}
