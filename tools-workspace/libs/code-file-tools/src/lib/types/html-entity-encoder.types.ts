export type HtmlEntityMode = 'encode' | 'decode';
export type HtmlEntityEncodingFormat = 'named' | 'numeric' | 'hex' | 'all';

export interface HtmlEntityHistoryEntry {
  timestamp: number;
  input: string;
  output: string;
  mode: HtmlEntityMode;
}
