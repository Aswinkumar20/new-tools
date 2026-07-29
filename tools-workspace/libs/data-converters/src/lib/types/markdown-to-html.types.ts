export type MarkdownToHtmlConversionMode = 'markdown-to-html' | 'html-to-markdown';
export type MarkdownToHtmlBulletStyle = '-' | '*' | '+';
export type MarkdownToHtmlHeadingStyle = 'atx' | 'setext';
export type MarkdownToHtmlCopyStatus = 'idle' | 'success' | 'error';
export type MarkdownToHtmlConversionState = 'idle' | 'success' | 'error';

export interface MarkdownToHtmlHistoryEntry {
  label: string;
  timestamp: string;
}

export interface MarkdownToHtmlConversionStatus {
  status: MarkdownToHtmlConversionState;
  message: string;
}

export interface MarkdownToHtmlMetricsSummary {
  characters: number;
  lines: number;
  sizeLabel: string;
  selection: string;
}

export interface MarkdownToHtmlMarkdownOptions {
  wrapParagraphs: boolean;
  convertLineBreaks: boolean;
  escapeHtml: boolean;
  smartTypography: boolean;
}

export interface MarkdownToHtmlHtmlOptions {
  bulletStyle: MarkdownToHtmlBulletStyle;
  headingStyle: MarkdownToHtmlHeadingStyle;
  collapseWhitespace: boolean;
  keepLinks: boolean;
  codeFence: string;
}

export interface MarkdownToHtmlModeOption {
  id: MarkdownToHtmlConversionMode;
  label: string;
  description: string;
}

export interface MarkdownToHtmlBulletStyleOption {
  value: MarkdownToHtmlBulletStyle;
  label: string;
}

export interface MarkdownToHtmlHeadingStyleOption {
  value: MarkdownToHtmlHeadingStyle;
  label: string;
}

export interface MarkdownToHtmlCallout {
  title: string;
  detail: string;
}
