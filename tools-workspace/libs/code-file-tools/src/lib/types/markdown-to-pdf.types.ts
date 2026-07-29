export type MarkdownPdfPageSize = 'a4' | 'letter' | 'legal';
export type MarkdownPdfOrientation = 'portrait' | 'landscape';

export interface MarkdownPdfOptions {
  pageSize: MarkdownPdfPageSize;
  orientation: MarkdownPdfOrientation;
  margin: number;
  fontSize: number;
  includeHeader: boolean;
  includeFooter: boolean;
}
