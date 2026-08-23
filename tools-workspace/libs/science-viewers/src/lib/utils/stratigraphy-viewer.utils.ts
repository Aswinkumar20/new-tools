import { STRAT_MAX_FILE_BYTES, STRAT_SUPPORTED_EXTENSIONS } from '../constants/stratigraphy-viewer.constants';
import { STRATIGRAPHY_SAMPLE } from '../constants/stratigraphy-sample.data';
import type {
  ParsedStratigraphy,
  StratigraphyLoadedFile,
  StratigraphyMetadataRow,
  StratigraphySuggestion,
  StratigraphyUnit
} from '../types/stratigraphy-viewer.types';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { bytesToText } from './sequence.utils';
import { parseStratigraphyText } from './stratigraphy-parse.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatStratFileSize,
  readFileBytes as readStratFileBytes
} from './science-file.utils';

export { parseStratigraphyText } from './stratigraphy-parse.utils';
export { renderStratColumn, renderStratCorrelation } from './stratigraphy-render.utils';

export function isSupportedStratFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (STRAT_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateStratFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > STRAT_MAX_FILE_BYTES) return `File is too large (max ${formatScienceFileSize(STRAT_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidStratFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed stratigraphy files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedStratFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .csv, or .str)' });
      continue;
    }
    const sizeError = validateStratFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleStratFile(): File {
  return new File([STRATIGRAPHY_SAMPLE], 'sample-basin-strat.json', { type: 'application/json', lastModified: 0 });
}

export function createStratFileRecord(file: File, bytes: Uint8Array): StratigraphyLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ParsedStratigraphy | null = null;
  let softFail = false;
  try {
    parsed = parseStratigraphyText(text);
    warnings.push(...parsed.warnings);
    if (!parsed.columns.some((c) => c.units.length)) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse stratigraphy');
  }
  return { id, name: file.name, size: file.size, extension, text, parsed, warnings, softFail };
}

export function canExportStrat(file: StratigraphyLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function allStratUnits(parsed: ParsedStratigraphy): StratigraphyUnit[] {
  return parsed.columns.flatMap((c) => c.units);
}

export function buildStratMetadataRows(parsed: ParsedStratigraphy): StratigraphyMetadataRow[] {
  return [
    { key: 'Name', value: parsed.name },
    { key: 'Region', value: parsed.region || '—' },
    { key: 'Source', value: parsed.sourceKind.toUpperCase() },
    { key: 'Columns', value: String(parsed.columns.length) },
    { key: 'Units', value: String(allStratUnits(parsed).length) },
    { key: 'Age range', value: `${parsed.ageMin}–${parsed.ageMax} ${parsed.timeUnit}` },
    { key: 'Markers', value: String(parsed.markers.length) }
  ];
}

export function buildUnitMetadata(unit: StratigraphyUnit): StratigraphyMetadataRow[] {
  return [
    { key: 'Name', value: unit.name },
    { key: 'Lithology', value: unit.lithology || '—' },
    { key: 'Era', value: unit.era || '—' },
    { key: 'Period', value: unit.period || '—' },
    { key: 'Age top', value: String(unit.ageTop) },
    { key: 'Age base', value: String(unit.ageBase) },
    { key: 'Thickness', value: String(unit.thickness) },
    { key: 'Unconformity', value: unit.unconformity ? 'yes' : 'no' },
    { key: 'Description', value: unit.description || '—' }
  ];
}

export function filterStratUnits(units: StratigraphyUnit[], query: string): StratigraphyUnit[] {
  const q = query.trim().toLowerCase();
  if (!q) return units;
  return units.filter(
    (u) =>
      u.name.toLowerCase().includes(q) ||
      u.lithology.toLowerCase().includes(q) ||
      u.period.toLowerCase().includes(q) ||
      u.era.toLowerCase().includes(q)
  );
}

export function exportStratSummaryJson(file: StratigraphyLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed stratigraphy');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      region: parsed.region,
      timeUnit: parsed.timeUnit,
      ageMin: parsed.ageMin,
      ageMax: parsed.ageMax,
      columns: parsed.columns.map((c) => ({
        id: c.id,
        name: c.name,
        units: c.units.map((u) => ({
          name: u.name,
          lithology: u.lithology,
          period: u.period,
          ageTop: u.ageTop,
          ageBase: u.ageBase,
          thickness: u.thickness
        }))
      })),
      markers: parsed.markers
    },
    null,
    2
  );
}

export function exportStratUnitsCsv(parsed: ParsedStratigraphy): string {
  const lines = ['column,id,name,lithology,era,period,ageTop,ageBase,thickness,unconformity'];
  for (const col of parsed.columns) {
    for (const u of col.units) {
      lines.push(
        [col.name, u.id, u.name, u.lithology, u.era, u.period, u.ageTop, u.ageBase, u.thickness, u.unconformity ? 'yes' : 'no']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      );
    }
  }
  return lines.join('\n');
}

export function exportStratChronoCsv(parsed: ParsedStratigraphy): string {
  const lines = ['name,kind,age'];
  for (const m of parsed.markers) lines.push([m.name, m.kind, m.age].join(','));
  for (const u of allStratUnits(parsed)) {
    lines.push([`${u.name} top`, 'unit-top', u.ageTop].join(','));
    lines.push([`${u.name} base`, 'unit-base', u.ageBase].join(','));
  }
  return lines.join('\n');
}

export function resolveStratSuggestion(opts: { hasFiles: boolean; hasError: boolean }): StratigraphySuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample stratigraphy',
      reason: 'Load the Western Basin composite to verify column, chrono, and correlation views.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-strat',
      title: 'Upload a stratigraphic column',
      reason: 'JSON, CSV, and .str columns stay in your browser.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
