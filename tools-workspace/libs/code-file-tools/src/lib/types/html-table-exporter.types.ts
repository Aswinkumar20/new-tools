export type HtmlTableExportFormat = 'csv' | 'json' | 'tsv' | 'xml' | 'markdown';

export interface HtmlTableData {
  headers: string[];
  rows: string[][];
}

export interface HtmlTableExportResult {
  format: HtmlTableExportFormat;
  content: string;
  filename: string;
  mimeType: string;
}

export interface HtmlTableParseOutcome {
  data: HtmlTableData | null;
  error: string | null;
}
