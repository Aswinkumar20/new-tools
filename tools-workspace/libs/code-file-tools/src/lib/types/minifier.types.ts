export interface MinificationResult {
  minified: string;
  originalSize: number;
  minifiedSize: number;
  reduction: number;
  reductionPercentage: number;
}

export interface MinifierHistoryEntry {
  timestamp: number;
  original: string;
  minified: string;
  reduction: number;
}
