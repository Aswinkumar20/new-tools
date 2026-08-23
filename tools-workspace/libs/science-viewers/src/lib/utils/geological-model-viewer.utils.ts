import { GEO_MODEL_MAX_FILE_BYTES, GEO_MODEL_SUPPORTED_EXTENSIONS } from '../constants/geological-model-viewer.constants';
import { GEO_MODEL_SAMPLE } from '../constants/geological-model-sample.data';
import type {
  GeoModelLayer,
  GeoModelLoadedFile,
  GeoModelMetadataRow,
  GeoModelSuggestion,
  ParsedGeoModel
} from '../types/geological-model-viewer.types';
import { parseGeologicalModelText } from './geological-model-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { bytesToText } from './sequence.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatGeoModelFileSize,
  readFileBytes as readGeoModelFileBytes
} from './science-file.utils';

export { parseGeologicalModelText } from './geological-model-parse.utils';
export { renderGeoModelMap, renderGeoModelSection } from './geological-model-render.utils';

export function isSupportedGeoModelFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (GEO_MODEL_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateGeoModelFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > GEO_MODEL_MAX_FILE_BYTES) return `File is too large (max ${formatScienceFileSize(GEO_MODEL_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidGeoModelFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed models are not supported — decompress first' });
      continue;
    }
    if (!isSupportedGeoModelFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .geojson, .gmod, or .csv)' });
      continue;
    }
    const sizeError = validateGeoModelFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleGeoModelFile(): File {
  return new File([GEO_MODEL_SAMPLE], 'sample-basin.json', { type: 'application/json', lastModified: 0 });
}

export function createGeoModelFileRecord(file: File, bytes: Uint8Array): GeoModelLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ParsedGeoModel | null = null;
  let softFail = false;
  try {
    parsed = parseGeologicalModelText(text);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse geological model');
  }
  return { id, name: file.name, size: file.size, extension, text, parsed, warnings, softFail };
}

export function canExportGeoModel(file: GeoModelLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildGeoModelMetadataRows(parsed: ParsedGeoModel): GeoModelMetadataRow[] {
  return [
    { key: 'Name', value: parsed.name },
    { key: 'Source', value: parsed.sourceKind.toUpperCase() },
    { key: 'CRS', value: parsed.crs || '—' },
    { key: 'Unit', value: parsed.unit || '—' },
    { key: 'Layers', value: String(parsed.layers.length) },
    { key: 'Faults', value: String(parsed.faults.length) },
    { key: 'Wells', value: String(parsed.wells.length) },
    {
      key: 'Extent X',
      value: `${parsed.extent.xmin.toFixed(0)}–${parsed.extent.xmax.toFixed(0)} ${parsed.unit}`
    },
    {
      key: 'Depth',
      value: `${parsed.extent.zmin.toFixed(0)}–${parsed.extent.zmax.toFixed(0)} ${parsed.unit}`
    }
  ];
}

export function buildLayerMetadata(layer: GeoModelLayer): GeoModelMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Lithology', value: layer.lithology || '—' },
    { key: 'Age', value: layer.age || '—' },
    { key: 'Top', value: String(layer.top) },
    { key: 'Base', value: String(layer.base) },
    { key: 'Thickness', value: (layer.base - layer.top).toFixed(1) },
    { key: 'Porosity', value: layer.porosity == null ? '—' : String(layer.porosity) },
    { key: 'Description', value: layer.description || '—' }
  ];
}

export function filterGeoLayers(layers: GeoModelLayer[], query: string): GeoModelLayer[] {
  const q = query.trim().toLowerCase();
  if (!q) return layers;
  return layers.filter(
    (l) =>
      l.name.toLowerCase().includes(q) ||
      l.lithology.toLowerCase().includes(q) ||
      l.age.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
  );
}

export function exportGeoModelSummaryJson(file: GeoModelLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed geological model');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      crs: parsed.crs,
      unit: parsed.unit,
      sourceKind: parsed.sourceKind,
      extent: parsed.extent,
      layers: parsed.layers.map((l) => ({
        id: l.id,
        name: l.name,
        lithology: l.lithology,
        age: l.age,
        top: l.top,
        base: l.base,
        porosity: l.porosity
      })),
      faults: parsed.faults,
      wells: parsed.wells
    },
    null,
    2
  );
}

export function exportGeoLayersCsv(parsed: ParsedGeoModel): string {
  const lines = ['id,name,lithology,age,top,base,thickness,porosity,color'];
  for (const l of parsed.layers) {
    lines.push(
      [l.id, l.name, l.lithology, l.age, l.top, l.base, (l.base - l.top).toFixed(2), l.porosity ?? '', l.color]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
  }
  return lines.join('\n');
}

export function exportGeoSectionCsv(parsed: ParsedGeoModel, steps = 40): string {
  const { xmin, xmax } = parsed.extent;
  const header = ['x', ...parsed.layers.map((l) => `${l.name}_top`), ...parsed.layers.map((l) => `${l.name}_base`)].join(',');
  const lines = [header];
  for (let i = 0; i <= steps; i++) {
    const x = xmin + ((xmax - xmin) * i) / steps;
    const t = (x - xmin) / (xmax - xmin || 1);
    const tops = parsed.layers.map((l) => l.top + l.foldAmplitude * Math.sin(t * Math.PI * 1.6));
    const bases = parsed.layers.map((l) => l.base + l.foldAmplitude * Math.sin(t * Math.PI * 1.6));
    lines.push([x, ...tops, ...bases].map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join(','));
  }
  return lines.join('\n');
}

export function resolveGeoModelSuggestion(opts: { hasFiles: boolean; hasError: boolean }): GeoModelSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample basin model',
      reason: 'Load the synthetic layered basin to verify map, cross-section, and stratigraphic column.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-model',
      title: 'Upload a geological model',
      reason: 'JSON, GeoJSON, .gmod, and CSV models stay in your browser.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
