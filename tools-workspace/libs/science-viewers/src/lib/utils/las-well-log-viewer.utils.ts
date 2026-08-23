import {
  LAS_MAX_FILE_BYTES,
  LAS_SAMPLE,
  LAS_SUPPORTED_EXTENSIONS
} from '../constants/las-well-log-viewer.constants';
import type {
  LasLoadedFile,
  LasMetadataRow,
  LasSuggestion,
  ParsedLas
} from '../types/las-well-log-viewer.types';
import type { WellLogCurve } from '../types/well-log.types';
import { parseLasText } from './las-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { bytesToText } from './sequence.utils';
import { curveHistogram } from './well-log-render.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatLasFileSize,
  readFileBytes as readLasFileBytes
} from './science-file.utils';

export { parseLasText } from './las-parse.utils';
export {
  curveColor,
  curveHistogram,
  isDepthCurve,
  renderWellCrossplot,
  renderWellLogTracks
} from './well-log-render.utils';

export function isSupportedLasFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (LAS_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateLasFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > LAS_MAX_FILE_BYTES) return `File is too large (max ${formatScienceFileSize(LAS_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidLasFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed .gz is not supported — decompress first' });
      continue;
    }
    if (!isSupportedLasFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use CWLS .las well log)' });
      continue;
    }
    const sizeError = validateLasFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleLasFile(): File {
  return new File([LAS_SAMPLE], 'sample-well.las', { type: 'text/plain', lastModified: 0 });
}

export function createLasFileRecord(file: File, bytes: Uint8Array): LasLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ParsedLas | null = null;
  let softFail = false;
  try {
    parsed = parseLasText(text);
    warnings.push(...parsed.warnings);
    if (!parsed.depth.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse LAS');
  }
  return { id, name: file.name, size: file.size, extension, text, parsed, warnings, softFail };
}

export function canExportLas(file: LasLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildLasMetadataRows(parsed: ParsedLas): LasMetadataRow[] {
  const wellName = parsed.well.find((r) => r.mnemonic.toUpperCase() === 'WELL')?.value || '—';
  const company = parsed.well.find((r) => r.mnemonic.toUpperCase() === 'COMP')?.value || '—';
  return [
    { key: 'Version', value: parsed.version },
    { key: 'Well', value: wellName },
    { key: 'Company', value: company },
    { key: 'Depth', value: `${parsed.startDepth ?? '—'}–${parsed.stopDepth ?? '—'} ${parsed.depthUnit}` },
    { key: 'Step', value: parsed.step == null ? '—' : String(parsed.step) },
    { key: 'Samples', value: String(parsed.depth.length) },
    { key: 'Curves', value: String(parsed.curves.length) },
    { key: 'Null', value: String(parsed.nullValue) }
  ];
}

export function buildCurveMetadata(curve: WellLogCurve): LasMetadataRow[] {
  return [
    { key: 'Mnemonic', value: curve.mnemonic },
    { key: 'Unit', value: curve.unit || '—' },
    { key: 'Min', value: curve.min.toFixed(3) },
    { key: 'Max', value: curve.max.toFixed(3) },
    { key: 'Mean', value: curve.mean.toFixed(3) },
    { key: 'Nulls', value: String(curve.nullCount) },
    { key: 'Description', value: curve.description || '—' }
  ];
}

export function filterLasCurves(curves: WellLogCurve[], query: string): WellLogCurve[] {
  const q = query.trim().toLowerCase();
  if (!q) return curves;
  return curves.filter(
    (c) =>
      c.mnemonic.toLowerCase().includes(q) ||
      c.unit.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
  );
}

export function exportLasSummaryJson(file: LasLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed LAS');
  return JSON.stringify(
    {
      file: file.name,
      version: parsed.version,
      well: Object.fromEntries(parsed.well.map((r) => [r.mnemonic, r.value])),
      startDepth: parsed.startDepth,
      stopDepth: parsed.stopDepth,
      step: parsed.step,
      samples: parsed.depth.length,
      curves: parsed.curves.map((c) => ({
        mnemonic: c.mnemonic,
        unit: c.unit,
        min: c.min,
        max: c.max,
        mean: Number(c.mean.toFixed(4)),
        nullCount: c.nullCount
      }))
    },
    null,
    2
  );
}

export function exportLasCurvesCsv(parsed: ParsedLas, mnemonics: string[]): string {
  const selected = parsed.curves.filter((c) => mnemonics.includes(c.mnemonic));
  const header = ['DEPT', ...selected.map((c) => c.mnemonic)].join(',');
  const lines = [header];
  for (let i = 0; i < parsed.depth.length; i++) {
    lines.push(
      [parsed.depth[i], ...selected.map((c) => (Number.isFinite(c.values[i]) ? c.values[i] : ''))].join(',')
    );
  }
  return lines.join('\n');
}

export function exportLasSubset(parsed: ParsedLas, mnemonics: string[], depthMin: number, depthMax: number): string {
  const selected = parsed.curves.filter((c) => mnemonics.includes(c.mnemonic));
  const rows: string[] = [];
  for (let i = 0; i < parsed.depth.length; i++) {
    const d = parsed.depth[i];
    if (d < depthMin || d > depthMax) continue;
    rows.push(
      [d.toFixed(4), ...selected.map((c) => (Number.isFinite(c.values[i]) ? c.values[i].toFixed(4) : String(parsed.nullValue)))].join('  ')
    );
  }
  const curveHeader = selected.map((c) => `${c.mnemonic}.${c.unit || ''} : ${c.description || c.mnemonic}`).join('\n');
  return `~VERSION INFORMATION
VERS.                          ${parsed.version} : CWLS LOG ASCII STANDARD
WRAP.                          NO  : ONE LINE PER DEPTH STEP
~WELL INFORMATION
STRT.${parsed.depthUnit || 'M'}    ${depthMin} : START DEPTH
STOP.${parsed.depthUnit || 'M'}    ${depthMax} : STOP DEPTH
NULL.                       ${parsed.nullValue} : NULL VALUE
~CURVE INFORMATION
DEPT.${parsed.depthUnit || 'M'} : DEPTH
${curveHeader}
~A
${rows.join('\n')}
`;
}

export function lasHistogram(curve: WellLogCurve) {
  return curveHistogram(curve);
}

export function resolveLasSuggestion(opts: { hasFiles: boolean; hasError: boolean }): LasSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample LAS well',
      reason: 'Load the synthetic SAMPLE-1 log to verify depth tracks, crossplot, and curve stats.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-las',
      title: 'Upload a LAS well log',
      reason: 'CWLS LAS files stay in your browser — inspect tracks, crossplots, and export locally.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
