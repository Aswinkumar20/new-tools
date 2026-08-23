import { API_JSON_SAMPLE } from '../constants/api-request-sample.data';
import { API_REQUEST_MAX_FILE_BYTES, API_REQUEST_SUPPORTED_EXTENSIONS } from '../constants/api-request-viewer.constants';
import type {
  ApiCall,
  ApiRequestDataset,
  ApiRequestLoadedFile,
  ApiRequestMetadataRow,
  ApiRequestSuggestion
} from '../types/api-request-viewer.types';
import { filterApiCalls, parseApiRequestBytes, prettyBody } from './api-request-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatApiRequestFileSize,
  readFileBytes as readApiRequestFileBytes
} from './network-file.utils';

export { filterApiCalls, parseApiRequestBytes, parseApiRequestText, prettyBody } from './api-request-parse.utils';
export { methodColor, renderApiMethodBars, statusColor } from './api-request-render.utils';

export function isSupportedApiRequestFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (API_REQUEST_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateApiRequestFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > API_REQUEST_MAX_FILE_BYTES) {
    return `File is too large (max ${formatNetworkFileSize(API_REQUEST_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidApiRequestFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed API dumps are not supported — decompress first' });
      continue;
    }
    if (!isSupportedApiRequestFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .har, or .http)' });
      continue;
    }
    const sizeError = validateApiRequestFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleApiRequestFile(): File {
  return new File([API_JSON_SAMPLE], 'sample-orders-api.json', { type: 'application/json', lastModified: 0 });
}

export function createApiRequestFileRecord(file: File, bytes: Uint8Array): ApiRequestLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ApiRequestDataset | null = null;
  let softFail = false;
  try {
    parsed = parseApiRequestBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.calls.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse API dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportApiRequest(file: ApiRequestLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildApiRequestMetadataRows(dataset: ApiRequestDataset): ApiRequestMetadataRow[] {
  const methods = new Map<string, number>();
  dataset.calls.forEach((c) => methods.set(c.method, (methods.get(c.method) ?? 0) + 1));
  const errors = dataset.calls.filter((c) => c.status >= 400).length;
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Base URL', value: dataset.baseUrl || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Calls', value: String(dataset.calls.length) },
    { key: 'Methods', value: [...methods.entries()].map(([m, n]) => `${m} ${n}`).join(', ') || '—' },
    { key: 'Errors', value: String(errors) }
  ];
}

export function buildApiCallMetadata(call: ApiCall): ApiRequestMetadataRow[] {
  return [
    { key: 'Name', value: call.name },
    { key: 'Method', value: call.method },
    { key: 'URL', value: call.url },
    { key: 'Status', value: call.status ? `${call.status} ${call.statusText}`.trim() : '—' },
    { key: 'Duration', value: `${Math.round(call.durationMs)} ms` },
    { key: 'Type', value: call.mimeType || '—' },
    { key: 'Query', value: call.query.map((q) => `${q.name}=${q.value}`).join('&') || '—' },
    { key: 'Req headers', value: String(call.requestHeaders.length) },
    { key: 'Res headers', value: String(call.responseHeaders.length) }
  ];
}

export function exportApiSummaryJson(file: ApiRequestLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed API dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      baseUrl: parsed.baseUrl,
      sourceKind: parsed.sourceKind,
      calls: parsed.calls.map((c) => ({
        name: c.name,
        method: c.method,
        url: c.url,
        status: c.status,
        durationMs: c.durationMs
      }))
    },
    null,
    2
  );
}

export function exportApiRequestsCsv(dataset: ApiRequestDataset): string {
  const lines = ['index,name,method,status,url,duration_ms'];
  for (const c of dataset.calls) {
    lines.push([c.index + 1, csv(c.name), c.method, c.status, csv(c.url), c.durationMs].join(','));
  }
  return lines.join('\n');
}

export function exportApiBodiesJson(dataset: ApiRequestDataset): string {
  return JSON.stringify(
    dataset.calls.map((c) => ({
      name: c.name,
      method: c.method,
      url: c.url,
      status: c.status,
      requestBody: prettyBody(c.requestBody) || c.requestBody,
      responseBody: prettyBody(c.responseBody) || c.responseBody
    })),
    null,
    2
  );
}

export function resolveApiRequestSuggestion(state: { hasFiles: boolean; hasError: boolean }): ApiRequestSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the Orders API sample',
      reason: 'Load a local collection with GET/POST/PATCH/DELETE and a 401 error body.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an API dump',
      reason: 'Drop JSON, HAR, or a .http collection — or load the sample Orders API snapshot.',
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
