export type YamlJsonConversionMode = 'yaml-to-json' | 'json-to-yaml';
export type YamlJsonCopyStatus = 'idle' | 'success' | 'error';
export type YamlJsonConversionState = 'idle' | 'success' | 'error';

export interface YamlJsonHistoryEntry {
  label: string;
  timestamp: string;
}

export interface YamlJsonConversionStatus {
  status: YamlJsonConversionState;
  message: string;
}

export interface YamlJsonMetricsSummary {
  lines: number;
  sizeLabel: string;
  selection: string;
}

export interface YamlJsonModeOption {
  id: YamlJsonConversionMode;
  label: string;
  description: string;
}

export interface YamlJsonCallout {
  title: string;
  detail: string;
}

export interface YamlJsonStringifyOptions {
  indent: number;
  quoteStrings: boolean;
}

export interface YamlJsonLine {
  indent: number;
  content: string;
}
