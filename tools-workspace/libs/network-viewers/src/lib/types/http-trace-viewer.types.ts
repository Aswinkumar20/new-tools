export type HttpTraceViewMode = 'requests' | 'responses' | 'conversation' | 'table';
export type HttpTraceExportFormat = 'original' | 'summary-json' | 'requests-csv' | 'conversation-txt' | 'png';
export type HttpTraceSourceKind = 'har' | 'trace' | 'json';

export interface HttpTraceRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface HttpTraceHeader {
  name: string;
  value: string;
}

export interface HttpTraceExchange {
  id: string;
  index: number;
  method: string;
  url: string;
  host: string;
  path: string;
  status: number;
  statusText: string;
  httpVersion: string;
  requestHeaders: HttpTraceHeader[];
  responseHeaders: HttpTraceHeader[];
  requestBody: string;
  responseBody: string;
  mimeType: string;
  durationMs: number;
  startMs: number;
}

export interface HttpTraceDataset {
  name: string;
  sourceKind: HttpTraceSourceKind;
  exchanges: HttpTraceExchange[];
  totalDurationMs: number;
  warnings: string[];
}

export interface HttpTraceLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: HttpTraceDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface HttpTraceMetadataRow {
  key: string;
  value: string;
}

export interface HttpTraceSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
