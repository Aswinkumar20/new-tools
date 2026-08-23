import { HAR_JSON_SAMPLE } from '../constants/har-sample.data';
import { HAR_MAX_FILE_BYTES, HAR_SUPPORTED_EXTENSIONS } from '../constants/har-viewer.constants';
import type { HarDataset, HarEntry, HarLoadedFile, HarMetadataRow, HarSuggestion } from '../types/har-viewer.types';
import { parseHarText } from './har-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatHarFileSize,
  readFileBytes as readHarFileBytes
} from './network-file.utils';

export { filterHarEntries, parseHarText } from './har-parse.utils';
export { renderHarTimingBars, renderHarWaterfall, statusColor } from './har-render.utils';

export function isSupportedHarFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (HAR_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateHarFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > HAR_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(HAR_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidHarFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed HAR files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedHarFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .har or HAR JSON)' });
      continue;
    }
    const sizeError = validateHarFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleHarFile(): File {
  return new File([HAR_JSON_SAMPLE], 'sample-storefront.har', { type: 'application/json', lastModified: 0 });
}

export function createHarFileRecord(file: File, bytes: Uint8Array): HarLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: HarDataset | null = null;
  let softFail = false;
  try {
    parsed = parseHarText(text);
    warnings.push(...parsed.warnings);
    if (!parsed.entries.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse HAR');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportHar(file: HarLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildHarMetadataRows(dataset: HarDataset): HarMetadataRow[] {
  const methods = new Map<string, number>();
  dataset.entries.forEach((e) => methods.set(e.method, (methods.get(e.method) ?? 0) + 1));
  return [
    { key: 'Page', value: dataset.pageTitle },
    { key: 'Version', value: dataset.version },
    { key: 'Creator', value: dataset.creator || '—' },
    { key: 'Browser', value: dataset.browser || '—' },
    { key: 'Entries', value: String(dataset.entries.length) },
    { key: 'Methods', value: [...methods.entries()].map(([m, n]) => `${m} ${n}`).join(', ') || '—' },
    { key: 'Span', value: `${Math.round(dataset.totalTimeMs)} ms` },
    { key: 'Transfer', value: formatNetworkFileSize(dataset.totalTransfer) }
  ];
}

export function buildEntryMetadata(entry: HarEntry): HarMetadataRow[] {
  return [
    { key: 'Method', value: entry.method },
    { key: 'URL', value: entry.url },
    { key: 'Status', value: `${entry.status} ${entry.statusText}`.trim() },
    { key: 'Type', value: entry.mimeType || '—' },
    { key: 'Started', value: entry.startedDateTime || '—' },
    { key: 'Time', value: `${Math.round(entry.time)} ms` },
    { key: 'IP', value: entry.serverIPAddress || '—' },
    { key: 'Transfer', value: formatNetworkFileSize(entry.transferSize) }
  ];
}

export function exportHarSummaryJson(file: HarLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed HAR data');
  return JSON.stringify(
    {
      file: file.name,
      pageTitle: parsed.pageTitle,
      version: parsed.version,
      creator: parsed.creator,
      entries: parsed.entries.length,
      totalTimeMs: parsed.totalTimeMs,
      totalTransfer: parsed.totalTransfer,
      requests: parsed.entries.map((e) => ({
        method: e.method,
        url: e.url,
        status: e.status,
        time: e.time,
        mimeType: e.mimeType
      }))
    },
    null,
    2
  );
}

export function exportHarEntriesCsv(dataset: HarDataset): string {
  const lines = ['index,method,status,url,mime,time_ms,transfer,ip'];
  for (const e of dataset.entries) {
    lines.push(
      [e.index + 1, e.method, e.status, csv(e.url), csv(e.mimeType), Math.round(e.time), e.transferSize, csv(e.serverIPAddress)].join(',')
    );
  }
  return lines.join('\n');
}

export function exportHarTimingsCsv(dataset: HarDataset): string {
  const lines = ['index,method,url,blocked,dns,connect,ssl,send,wait,receive,total'];
  for (const e of dataset.entries) {
    const t = e.timings;
    lines.push(
      [e.index + 1, e.method, csv(e.url), t.blocked, t.dns, t.connect, t.ssl, t.send, t.wait, t.receive, Math.round(e.time)].join(',')
    );
  }
  return lines.join('\n');
}

export function resolveHarSuggestion(state: { hasFiles: boolean; hasError: boolean }): HarSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the storefront HAR sample',
      reason: 'Load a local waterfall with HTML, CSS, JS, API, and a 404 to explore timings.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a HAR capture',
      reason: 'Drop a Chrome/Firefox .har export — or load the sample storefront capture.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  return null;
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
