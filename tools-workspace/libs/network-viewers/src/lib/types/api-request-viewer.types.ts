export type ApiRequestViewMode = 'collection' | 'bodies' | 'headers' | 'table';
export type ApiRequestExportFormat = 'original' | 'summary-json' | 'requests-csv' | 'bodies-json' | 'png';
export type ApiRequestSourceKind = 'json' | 'har' | 'http';

export interface ApiRequestRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ApiHeader {
  name: string;
  value: string;
}

export interface ApiCall {
  id: string;
  index: number;
  name: string;
  method: string;
  url: string;
  host: string;
  path: string;
  status: number;
  statusText: string;
  mimeType: string;
  requestHeaders: ApiHeader[];
  responseHeaders: ApiHeader[];
  query: ApiHeader[];
  requestBody: string;
  responseBody: string;
  prettyRequest: string;
  prettyResponse: string;
  durationMs: number;
}

export interface ApiRequestDataset {
  name: string;
  baseUrl: string;
  sourceKind: ApiRequestSourceKind;
  calls: ApiCall[];
  warnings: string[];
}

export interface ApiRequestLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ApiRequestDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface ApiRequestMetadataRow {
  key: string;
  value: string;
}

export interface ApiRequestSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
