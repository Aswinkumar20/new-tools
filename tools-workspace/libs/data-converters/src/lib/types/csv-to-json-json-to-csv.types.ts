export type CsvJsonConversionMode = 'csv-to-json' | 'json-to-csv';
export type CsvLineEnding = 'auto' | 'lf' | 'crlf';

export interface CsvJsonHistoryEntry {
  label: string;
  timestamp: string;
}

export interface CsvJsonConversionStatus {
  status: 'success' | 'error' | 'idle';
  message: string;
}

export interface CsvParseResult {
  headers: string[] | null;
  rows: string[][];
}

export interface CsvJsonMetricsSummary {
  rows: number;
  columns: number;
  sizeLabel: string;
  selection: string;
}

export interface CsvParseOptions {
  delimiter: string;
  quote: string;
  hasHeader: boolean;
  trim: boolean;
  skipEmpty: boolean;
  lineEnding: CsvLineEnding;
}

export interface CsvBuildOptions {
  delimiter: string;
  quote: string;
  includeHeader: boolean;
  sortKeys: boolean;
  trimWhitespace: boolean;
}

export interface CsvJsonModeOption {
  id: CsvJsonConversionMode;
  label: string;
  description: string;
}

export interface CsvToJsonSuccess {
  ok: true;
  output: string;
  metrics: CsvJsonMetricsSummary;
  message: string;
}

export interface JsonToCsvSuccess {
  ok: true;
  output: string;
  metrics: CsvJsonMetricsSummary;
  message: string;
}

export interface ConversionFailure {
  ok: false;
  message: string;
}
