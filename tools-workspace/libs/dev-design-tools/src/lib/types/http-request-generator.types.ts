export type HttpRequestCodeFormat = 'fetch' | 'axios' | 'curl' | 'python' | 'node' | 'php';

export interface HttpRequestCodeFormatOption {
  value: HttpRequestCodeFormat;
  label: string;
}

export interface HttpRequestHeaderPair {
  key: string;
  value: string;
}

export interface HttpRequestGeneratorInput {
  url: string;
  method: string;
  headers: ReadonlyArray<HttpRequestHeaderPair>;
  body: string;
  codeFormat: string;
}

export interface HttpRequestHistoryEntry {
  timestamp: number;
  url: string;
  method: string;
  codeFormat: string;
}
