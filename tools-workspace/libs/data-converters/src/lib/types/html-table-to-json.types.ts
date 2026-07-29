export type HtmlTableSelectionMode = 'auto' | 'body' | 'custom';

export interface HtmlTableHistoryEntry {
  label: string;
  timestamp: string;
}

export interface HtmlTableConversionStatus {
  status: 'idle' | 'success' | 'error';
  message: string;
}

export interface HtmlTableMetricsSummary {
  rows: number;
  columns: number;
  sizeLabel: string;
}

export interface HtmlTableParseOptions {
  selector?: string;
  headerRows: number;
  trimCells: boolean;
  compactArrays: boolean;
  includeEmptyCells: boolean;
  dateDetection: boolean;
  numberDetection: boolean;
  selectionMode: HtmlTableSelectionMode;
}

export interface HtmlTableExtraction {
  headers: string[];
  rows: string[][];
}

export interface HtmlTableSelectionModeOption {
  id: HtmlTableSelectionMode;
  label: string;
  description: string;
}

export interface HtmlTableConvertSuccess {
  ok: true;
  output: string;
  metrics: HtmlTableMetricsSummary;
  message: string;
}

export interface HtmlTableConvertFailure {
  ok: false;
  message: string;
}
