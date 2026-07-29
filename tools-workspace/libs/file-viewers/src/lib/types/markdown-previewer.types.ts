export interface MarkedOptions {
  breaks?: boolean;
  gfm?: boolean;
  headerIds?: boolean;
  mangle?: boolean;
  pedantic?: boolean;
  sanitize?: boolean;
  silent?: boolean;
  smartLists?: boolean;
  smartypants?: boolean;
  xhtml?: boolean;
}

export interface MarkedLibrary {
  parse(markdown: string, options?: MarkedOptions): string;
  setOptions(options: MarkedOptions): void;
}

export interface DomPurifyLibrary {
  sanitize(dirty: string, config?: Record<string, unknown>): string;
}

export interface MarkdownFile {
  name: string;
  file: File;
  url: string;
  size: number;
  content: string;
  htmlContent: string;
  lines: number;
  lastModified: Date;
}

export type MarkdownRenderMode = 'preview' | 'source' | 'split';

export interface MarkdownValidationResult {
  validFiles: File[];
  errors: string[];
}

export interface DomPurifyConfig {
  ALLOWED_TAGS: string[];
  ALLOWED_ATTR: string[];
}
