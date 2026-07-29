export type JsonLinterDiagnosticLevel = 'error' | 'warning' | 'info';
export type JsonLinterCopyStatus = 'idle' | 'success' | 'error';
export type JsonLinterLintState = 'idle' | 'success' | 'error';
export type JsonLinterPreviewMode = 'formatted' | 'minified';

export interface JsonLinterHistoryEntry {
  label: string;
  timestamp: string;
}

export interface JsonLinterDiagnostic {
  id: string;
  level: JsonLinterDiagnosticLevel;
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
}

export interface JsonLinterConversionStatus {
  status: JsonLinterLintState;
  message: string;
}

export interface JsonLinterMetricsSummary {
  characters: number;
  lines: number;
  sizeLabel: string;
  selection: string;
}

export interface JsonLinterSanitizeOptions {
  allowComments: boolean;
  allowTrailingCommas: boolean;
}

export interface JsonLinterSanitizeResult {
  text: string;
  transformations: string[];
  warnings: string[];
}

export interface JsonLinterHeroHighlight {
  title: string;
  detail: string;
}

export type JsonLinterParseResult =
  | { success: true; value: unknown }
  | { success: false; diagnostic: JsonLinterDiagnostic };
