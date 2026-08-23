import {
  SEGY_MAX_FILE_BYTES,
  SEGY_SUPPORTED_EXTENSIONS
} from '../constants/seg-y-viewer.constants';
import type {
  ParsedSegy,
  SegyLoadedFile,
  SegyMetadataRow,
  SegySuggestion,
  SegyTraceHeader
} from '../types/seg-y-viewer.types';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { buildSampleSegyBytes } from './segy-build.utils';
import { parseSegyBytes } from './segy-parse.utils';
import { amplitudeHistogram } from './segy-render.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatSegyFileSize,
  readFileBytes as readSegyFileBytes
} from './science-file.utils';

export { buildSampleSegyBytes } from './segy-build.utils';
export { parseSegyBytes } from './segy-parse.utils';
export { amplitudeHistogram, renderSegySection, renderSegyWiggle } from './segy-render.utils';

export function isSupportedSegyFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SEGY_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateSegyFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SEGY_MAX_FILE_BYTES) return `File is too large (max ${formatScienceFileSize(SEGY_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSegyFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed SEG-Y is not supported — decompress first' });
      continue;
    }
    if (!isSupportedSegyFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .sgy or .segy)' });
      continue;
    }
    const sizeError = validateSegyFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleSegyFile(): File {
  return new File([buildSampleSegyBytes() as BlobPart], 'sample-line.sgy', {
    type: 'application/octet-stream',
    lastModified: 0
  });
}

export function createSegyFileRecord(file: File, bytes: Uint8Array): SegyLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: ParsedSegy | null = null;
  let softFail = false;
  try {
    parsed = parseSegyBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.previewTraces) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse SEG-Y');
  }
  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportSegy(file: SegyLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSegyMetadataRows(parsed: ParsedSegy): SegyMetadataRow[] {
  return [
    { key: 'Revision', value: parsed.revision },
    { key: 'Endian', value: parsed.littleEndian ? 'little' : 'big' },
    { key: 'Text header', value: parsed.textEncoding.toUpperCase() },
    { key: 'Format', value: `${parsed.formatCode} (${parsed.sampleFormat})` },
    { key: 'Traces', value: `${parsed.previewTraces} / ${parsed.traceCount}` },
    { key: 'Samples', value: String(parsed.samplesPerTrace) },
    { key: 'dt', value: parsed.dtUs ? `${parsed.dtUs} µs` : '—' },
    { key: 'Length', value: parsed.dtUs ? `${((parsed.samplesPerTrace * parsed.dtUs) / 1000).toFixed(0)} ms` : '—' },
    { key: 'Amp min/max', value: `${parsed.minAmp.toFixed(3)} / ${parsed.maxAmp.toFixed(3)}` },
    { key: 'RMS', value: parsed.rmsAmp.toFixed(4) }
  ];
}

export function buildTraceMetadata(trace: SegyTraceHeader): SegyMetadataRow[] {
  return [
    { key: 'Index', value: String(trace.index + 1) },
    { key: 'Seq', value: String(trace.seqLine) },
    { key: 'CDP', value: String(trace.cdp) },
    { key: 'Inline', value: String(trace.inline) },
    { key: 'Xline', value: String(trace.xline) },
    { key: 'Source XY', value: `${trace.sourceX}, ${trace.sourceY}` },
    { key: 'Group XY', value: `${trace.groupX}, ${trace.groupY}` },
    { key: 'Samples', value: String(trace.samples) },
    { key: 'dt', value: trace.dtUs ? `${trace.dtUs} µs` : '—' }
  ];
}

export function filterSegyTraces(traces: SegyTraceHeader[], query: string): SegyTraceHeader[] {
  const q = query.trim().toLowerCase();
  if (!q) return traces;
  return traces.filter(
    (t) =>
      String(t.index + 1).includes(q) ||
      String(t.cdp).includes(q) ||
      String(t.inline).includes(q) ||
      String(t.seqLine).includes(q)
  );
}

export function exportSegySummaryJson(file: SegyLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed SEG-Y');
  return JSON.stringify(
    {
      file: file.name,
      revision: parsed.revision,
      littleEndian: parsed.littleEndian,
      textEncoding: parsed.textEncoding,
      formatCode: parsed.formatCode,
      sampleFormat: parsed.sampleFormat,
      dtUs: parsed.dtUs,
      samplesPerTrace: parsed.samplesPerTrace,
      traceCount: parsed.traceCount,
      previewTraces: parsed.previewTraces,
      minAmp: parsed.minAmp,
      maxAmp: parsed.maxAmp,
      rmsAmp: parsed.rmsAmp,
      jobId: parsed.jobId
    },
    null,
    2
  );
}

export function exportSegyTracesCsv(traces: SegyTraceHeader[]): string {
  const lines = ['index,seq,cdp,inline,xline,sourceX,sourceY,groupX,groupY,samples,dtUs'];
  for (const t of traces) {
    lines.push(
      [t.index + 1, t.seqLine, t.cdp, t.inline, t.xline, t.sourceX, t.sourceY, t.groupX, t.groupY, t.samples, t.dtUs].join(',')
    );
  }
  return lines.join('\n');
}

export function exportSegyAmplitudesCsv(parsed: ParsedSegy, traceIndices: number[], sampleStride = 1): string {
  const header = ['sample_ms', ...traceIndices.map((i) => `T${i + 1}`)].join(',');
  const lines = [header];
  const stride = Math.max(1, sampleStride);
  for (let s = 0; s < parsed.previewSamples; s += stride) {
    const ms = (s * parsed.dtUs) / 1000;
    const row = [ms.toFixed(2)];
    for (const t of traceIndices) {
      const v = parsed.amplitudes[t * parsed.previewSamples + s];
      row.push(Number.isFinite(v) ? v.toFixed(5) : '');
    }
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

export function segyHistogram(parsed: ParsedSegy) {
  return amplitudeHistogram(parsed.amplitudes);
}

export function resolveSegySuggestion(opts: { hasFiles: boolean; hasError: boolean }): SegySuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample seismic line',
      reason: 'Load the synthetic 2D SEG-Y to verify section, wiggle, gain, and AGC locally.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-segy',
      title: 'Upload a SEG-Y file',
      reason: 'Seismic files stay in your browser — inspect traces and export locally.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
