export type JsonParserCopyStatus = 'idle' | 'success' | 'error';
export type JsonParserParseState = 'idle' | 'success' | 'error';
export type JsonParserPreviewMode = 'formatted' | 'minified';
export type JsonParserNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonParserHistoryEntry {
  label: string;
  timestamp: string;
}

export interface JsonParserParseStatus {
  status: JsonParserParseState;
  message: string;
}

export interface JsonParserMetricsSummary {
  characters: number;
  lines: number;
  sizeLabel: string;
}

export interface JsonParserTreeNode {
  id: string;
  key?: string;
  type: JsonParserNodeType;
  level: number;
  path: string;
  expanded: boolean;
  preview: string;
  children?: JsonParserTreeNode[];
}

export interface JsonParserDiagnostic {
  id: string;
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
}

export interface JsonParserHeroHighlight {
  title: string;
  detail: string;
}

export interface JsonParserPreviewModeOption {
  id: JsonParserPreviewMode;
  label: string;
}

export type JsonParserParseResult =
  | { success: true; value: unknown }
  | { success: false; diagnostic: JsonParserDiagnostic };
