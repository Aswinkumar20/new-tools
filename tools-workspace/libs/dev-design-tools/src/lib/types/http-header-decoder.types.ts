export type HeaderCategory = 'general' | 'request' | 'response' | 'entity' | 'cors' | 'custom';

export type HeaderInputMode = 'raw' | 'keyvalue';

export interface DecodedHeader {
  key: string;
  value: string;
  description?: string;
  category: HeaderCategory;
}

export interface HeaderHistoryEntry {
  timestamp: number;
  headers: DecodedHeader[];
  rawInput: string;
}

export interface HeaderParseResult {
  headers: DecodedHeader[];
  warnings: string[];
}
