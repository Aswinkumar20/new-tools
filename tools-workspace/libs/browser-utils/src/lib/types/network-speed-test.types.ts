export interface SpeedTestResult {
  url: string;
  bytes: number;
  durationMs: number;
  mbps: number;
  timestamp: number;
  error?: string;
}

export interface SpeedTestFormValues {
  url: string;
  sizeBytes: number;
  runs: number;
}
