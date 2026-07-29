export type ClipboardEntryType = 'text' | 'url' | 'code' | 'other';

export interface ClipboardEntry {
  id: string;
  text: string;
  timestamp: number;
  preview: string;
  length: number;
  type: ClipboardEntryType;
}

export interface ClipboardHistorySettings {
  autoMonitor: boolean;
  maxEntries: number;
  excludeDuplicates: boolean;
  minLength: number;
  maxLength: number;
}
