import { BOREHOLE_MAX_FILE_BYTES, BOREHOLE_SUPPORTED_EXTENSIONS } from '../constants/borehole-viewer.constants';
import { BOREHOLE_SAMPLE } from '../constants/borehole-sample.data';
import type {
  BoreholeLithInterval,
  BoreholeLoadedFile,
  BoreholeMetadataRow,
  BoreholeSuggestion,
  BoreholeSurveyRow,
  ParsedBorehole
} from '../types/borehole-viewer.types';
import { parseBoreholeText } from './borehole-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { bytesToText } from './sequence.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatBoreholeFileSize,
  readFileBytes as readBoreholeFileBytes
} from './science-file.utils';

export { computeTrajectory, parseBoreholeText } from './borehole-parse.utils';
export { renderBorehole3d, renderBoreholePlan, renderBoreholeSection } from './borehole-render.utils';

export function isSupportedBoreholeFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (BOREHOLE_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateBoreholeFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > BOREHOLE_MAX_FILE_BYTES) return `File is too large (max ${formatScienceFileSize(BOREHOLE_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidBoreholeFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed borehole files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedBoreholeFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .csv, .bhl, or .dev)' });
      continue;
    }
    const sizeError = validateBoreholeFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleBoreholeFile(): File {
  return new File([BOREHOLE_SAMPLE], 'sample-eth1.json', { type: 'application/json', lastModified: 0 });
}

export function createBoreholeFileRecord(file: File, bytes: Uint8Array): BoreholeLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ParsedBorehole | null = null;
  let softFail = false;
  try {
    parsed = parseBoreholeText(text);
    warnings.push(...parsed.warnings);
    if (!parsed.survey.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse borehole');
  }
  return { id, name: file.name, size: file.size, extension, text, parsed, warnings, softFail };
}

export function canExportBorehole(file: BoreholeLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildBoreholeMetadataRows(parsed: ParsedBorehole): BoreholeMetadataRow[] {
  return [
    { key: 'Well', value: parsed.well },
    { key: 'Source', value: parsed.sourceKind.toUpperCase() },
    { key: 'KB', value: `${parsed.kb} ${parsed.unit}` },
    { key: 'Stations', value: String(parsed.survey.length) },
    { key: 'TD (MD)', value: `${parsed.td.toFixed(1)} ${parsed.unit}` },
    { key: 'TVD', value: `${parsed.tvd.toFixed(1)} ${parsed.unit}` },
    { key: 'Displacement', value: `${parsed.displacement.toFixed(1)} ${parsed.unit}` },
    { key: 'Max DLS', value: `${parsed.maxDls.toFixed(2)} °/30m` },
    { key: 'Lithology', value: String(parsed.lithology.length) }
  ];
}

export function buildStationMetadata(row: BoreholeSurveyRow): BoreholeMetadataRow[] {
  return [
    { key: 'MD', value: row.md.toFixed(2) },
    { key: 'INC', value: `${row.inc.toFixed(2)}°` },
    { key: 'AZI', value: `${row.azi.toFixed(2)}°` },
    { key: 'TVD', value: row.tvd.toFixed(2) },
    { key: 'North', value: row.north.toFixed(2) },
    { key: 'East', value: row.east.toFixed(2) },
    { key: 'VS', value: row.vs.toFixed(2) },
    { key: 'DLS', value: `${row.dls.toFixed(2)} °/30m` }
  ];
}

export function filterBoreholeStations(rows: BoreholeSurveyRow[], query: string): BoreholeSurveyRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => String(r.index + 1).includes(q) || String(Math.round(r.md)).includes(q));
}

export function filterBoreholeLith(intervals: BoreholeLithInterval[], query: string): BoreholeLithInterval[] {
  const q = query.trim().toLowerCase();
  if (!q) return intervals;
  return intervals.filter(
    (i) => i.name.toLowerCase().includes(q) || i.lithology.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
  );
}

export function exportBoreholeSummaryJson(file: BoreholeLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed borehole');
  return JSON.stringify(
    {
      file: file.name,
      well: parsed.well,
      kb: parsed.kb,
      unit: parsed.unit,
      td: parsed.td,
      tvd: parsed.tvd,
      displacement: parsed.displacement,
      maxDls: parsed.maxDls,
      stations: parsed.survey.length,
      lithology: parsed.lithology.map((l) => ({ name: l.name, topMd: l.topMd, baseMd: l.baseMd, lithology: l.lithology }))
    },
    null,
    2
  );
}

export function exportBoreholeSurveyCsv(parsed: ParsedBorehole): string {
  const lines = ['index,md,inc,azi,tvd,north,east,vs,dls'];
  for (const s of parsed.survey) {
    lines.push([s.index + 1, s.md, s.inc, s.azi, s.tvd.toFixed(3), s.north.toFixed(3), s.east.toFixed(3), s.vs.toFixed(3), s.dls.toFixed(3)].join(','));
  }
  return lines.join('\n');
}

export function exportBoreholeLithCsv(parsed: ParsedBorehole): string {
  const lines = ['id,name,lithology,topMd,baseMd,color'];
  for (const l of parsed.lithology) {
    lines.push([l.id, l.name, l.lithology, l.topMd, l.baseMd, l.color].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n');
}

export function resolveBoreholeSuggestion(opts: { hasFiles: boolean; hasError: boolean }): BoreholeSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample borehole',
      reason: 'Load ETH-1 to verify plan, section, lithology, and dogleg severity locally.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-bhl',
      title: 'Upload a borehole survey',
      reason: 'JSON, CSV, .bhl, and .dev trajectories stay in your browser.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
