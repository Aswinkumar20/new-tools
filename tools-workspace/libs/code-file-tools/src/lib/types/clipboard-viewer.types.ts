export type ClipboardContentType = 'text' | 'url' | 'code' | 'html' | 'image' | 'empty';

export interface ClipboardContentMetadata {
  lines: number;
  words: number;
  characters: number;
  isUrl: boolean;
  isCode: boolean;
  isHtml: boolean;
}

export interface ClipboardContent {
  text: string;
  timestamp: number;
  length: number;
  type: ClipboardContentType;
  preview: string;
  metadata: ClipboardContentMetadata;
}

export interface ClipboardViewerSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  showMetadata: boolean;
  wordWrap: boolean;
  fontSize: number;
}
