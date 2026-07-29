export interface DiffStats {
  originalChars: number;
  modifiedChars: number;
  originalLines: number;
  modifiedLines: number;
  changes: number;
  hasContent: boolean;
}

export type TextDiffTheme = 'vs-dark' | 'vs-light' | 'hc-black';

export type TextDiffLanguage =
  | 'typescript'
  | 'javascript'
  | 'json'
  | 'html'
  | 'css'
  | 'markdown'
  | 'python'
  | 'java'
  | 'xml'
  | 'yaml'
  | 'plaintext';

export interface DiffEditorModel {
  code: string;
  language: TextDiffLanguage;
}

export interface TextDifferenceSuggestionContext {
  hasOriginal: boolean;
  hasModified: boolean;
  areIdentical: boolean;
  changeCount: number;
  ignoreTrimWhitespace: boolean;
  charDelta: number;
}
