export type HarViewMode = 'waterfall' | 'timing' | 'headers' | 'table';
export type HarExportFormat = 'original' | 'summary-json' | 'entries-csv' | 'timings-csv' | 'png';

export interface HarRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface HarHeader {
  name: string;
  value: string;
}

export interface HarTiming {
  blocked: number;
  dns: number;
  connect: number;
  ssl: number;
  send: number;
  wait: number;
  receive: number;
}

export interface HarEntry {
  id: string;
  index: number;
  startedDateTime: string;
  startMs: number;
  time: number;
  method: string;
  url: string;
  host: string;
  path: string;
  status: number;
  statusText: string;
  mimeType: string;
  requestHeaders: HarHeader[];
  responseHeaders: HarHeader[];
  queryString: HarHeader[];
  requestBody: string;
  responseBody: string;
  timings: HarTiming;
  serverIPAddress: string;
  bodySize: number;
  transferSize: number;
}

export interface HarDataset {
  version: string;
  creator: string;
  browser: string;
  pageTitle: string;
  startedDateTime: string;
  entries: HarEntry[];
  totalTimeMs: number;
  totalTransfer: number;
  warnings: string[];
}

export interface HarLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: HarDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface HarMetadataRow {
  key: string;
  value: string;
}

export interface HarSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
