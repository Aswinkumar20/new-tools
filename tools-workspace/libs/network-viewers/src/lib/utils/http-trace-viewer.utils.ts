import { HTTP_TRACE_TEXT_SAMPLE } from '../constants/http-trace-sample.data';
import { HTTP_TRACE_MAX_FILE_BYTES, HTTP_TRACE_SUPPORTED_EXTENSIONS } from '../constants/http-trace-viewer.constants';
import type {
  HttpTraceDataset,
  HttpTraceExchange,
  HttpTraceLoadedFile,
  HttpTraceMetadataRow,
  HttpTraceSuggestion
} from '../types/http-trace-viewer.types';
import {
  filterHttpExchanges,
  formatConversationText,
  parseHttpTraceBytes,
  parseHttpTraceText
} from './http-trace-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatHttpTraceFileSize,
  readFileBytes as readHttpTraceFileBytes
} from './network-file.utils';

export { filterHttpExchanges, formatConversationText, parseHttpTraceBytes, parseHttpTraceText } from './http-trace-parse.utils';
export { methodColor, renderHttpTraceTimeline, statusColor } from './http-trace-render.utils';

export function isSupportedHttpTraceFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (HTTP_TRACE_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateHttpTraceFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > HTTP_TRACE_MAX_FILE_BYTES) {
    return `File is too large (max ${formatNetworkFileSize(HTTP_TRACE_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidHttpTraceFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed HTTP traces are not supported — decompress first' });
      continue;
    }
    if (!isSupportedHttpTraceFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .har, .trace, .http, or JSON)' });
      continue;
    }
    const sizeError = validateHttpTraceFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleHttpTraceFile(): File {
  return new File([HTTP_TRACE_TEXT_SAMPLE], 'sample-checkout.trace', { type: 'text/plain', lastModified: 0 });
}

export function createHttpTraceFileRecord(file: File, bytes: Uint8Array): HttpTraceLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: HttpTraceDataset | null = null;
  let softFail = false;
  try {
    parsed = parseHttpTraceBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.exchanges.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse HTTP trace');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportHttpTrace(file: HttpTraceLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildHttpTraceMetadataRows(dataset: HttpTraceDataset): HttpTraceMetadataRow[] {
  const methods = new Map<string, number>();
  dataset.exchanges.forEach((e) => methods.set(e.method, (methods.get(e.method) ?? 0) + 1));
  const errors = dataset.exchanges.filter((e) => e.status >= 400).length;
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Exchanges', value: String(dataset.exchanges.length) },
    { key: 'Methods', value: [...methods.entries()].map(([m, n]) => `${m} ${n}`).join(', ') || '—' },
    { key: 'Errors', value: String(errors) },
    { key: 'Span', value: `${Math.round(dataset.totalDurationMs)} ms` }
  ];
}

export function buildExchangeMetadata(exchange: HttpTraceExchange): HttpTraceMetadataRow[] {
  return [
    { key: 'Method', value: exchange.method },
    { key: 'URL', value: exchange.url },
    { key: 'Status', value: exchange.status ? `${exchange.status} ${exchange.statusText}`.trim() : '—' },
    { key: 'Host', value: exchange.host || '—' },
    { key: 'Path', value: exchange.path || '—' },
    { key: 'Type', value: exchange.mimeType || '—' },
    { key: 'Duration', value: `${Math.round(exchange.durationMs)} ms` },
    { key: 'Req headers', value: String(exchange.requestHeaders.length) },
    { key: 'Res headers', value: String(exchange.responseHeaders.length) }
  ];
}

export function exportHttpTraceSummaryJson(file: HttpTraceLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed HTTP trace');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      totalDurationMs: parsed.totalDurationMs,
      exchanges: parsed.exchanges.map((e) => ({
        method: e.method,
        url: e.url,
        status: e.status,
        durationMs: e.durationMs,
        mimeType: e.mimeType
      }))
    },
    null,
    2
  );
}

export function exportHttpTraceCsv(dataset: HttpTraceDataset): string {
  const lines = ['index,method,status,host,path,duration_ms,mime,url'];
  for (const e of dataset.exchanges) {
    lines.push(
      [e.index + 1, e.method, e.status, csv(e.host), csv(e.path), e.durationMs, csv(e.mimeType), csv(e.url)].join(',')
    );
  }
  return lines.join('\n');
}

export function resolveHttpTraceSuggestion(state: { hasFiles: boolean; hasError: boolean }): HttpTraceSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the checkout HTTP trace',
      reason: 'Load a local request/response conversation with HTML, JSON, POST, and a 404.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an HTTP trace',
      reason: 'Drop a .har, .trace, or .http file — or load the sample checkout conversation.',
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
