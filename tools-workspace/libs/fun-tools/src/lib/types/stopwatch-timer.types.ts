export interface LapTime {
  lapNumber: number;
  /** Split duration in milliseconds */
  lapTime: number;
  /** Cumulative elapsed time in milliseconds */
  totalTime: number;
  timestamp: number;
}

export interface StopwatchLapStats {
  count: number;
  fastest: number;
  slowest: number;
  average: number;
}
