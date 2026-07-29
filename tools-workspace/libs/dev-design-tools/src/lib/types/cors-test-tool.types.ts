export interface CorsTestResult {
  success: boolean;
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  corsHeaders: Record<string, string>;
  body: string | null;
  error: string | null;
  timestamp: number;
  duration: number;
}

export interface CorsHistoryEntry {
  timestamp: number;
  url: string;
  method: string;
  success: boolean;
  status: number | null;
  corsHeaders: Record<string, string>;
}

export interface CorsHeaderPair {
  key: string;
  value: string;
}

export interface CorsRequestInput {
  url: string;
  method: string;
  headers: ReadonlyArray<CorsHeaderPair>;
  body: string;
}
