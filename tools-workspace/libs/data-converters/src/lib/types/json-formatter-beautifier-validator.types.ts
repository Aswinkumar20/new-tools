export type JsonFormatterResultTab = 'formatted' | 'tree' | 'validation';
export type JsonFormatterIndentStyle = 'spaces' | 'tabs';
export type JsonFormatterFormatMode = 'beautify' | 'minify';

export interface JsonFormatterHistoryEntry {
  label: string;
  timestamp: string;
}

export interface JsonFormatterValidationResult {
  status: 'success' | 'error';
  message: string;
  line?: number;
  column?: number;
  excerpt?: string;
}

export interface JsonFormatterInputMetrics {
  characters: number;
  lines: number;
  sizeLabel: string;
}

export interface JsonTreeNode {
  id: string;
  level: number;
  key?: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  preview: string;
  metadata?: string;
  expanded: boolean;
  children?: JsonTreeNode[];
}

export interface JsonFormatterResultTabOption {
  id: JsonFormatterResultTab;
  label: string;
  description: string;
}

export type JsonSafeParseResult =
  | { success: true; value: unknown }
  | { success: false; error: JsonFormatterValidationResult };
