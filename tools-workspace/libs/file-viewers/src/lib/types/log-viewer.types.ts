export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  TRACE = 'TRACE',
  FATAL = 'FATAL',
  UNKNOWN = 'UNKNOWN'
}

export interface LogEntry {
  id: string;
  raw: string;
  level: LogLevel;
  timestamp?: Date;
  message: string;
  metadata?: Record<string, unknown>;
  isMultiLine?: boolean;
  expanded?: boolean;
  lineNumber: number;
}

export interface LogFilter {
  searchText: string;
  levels: LogLevel[];
  dateFrom?: Date;
  dateTo?: Date;
  regexEnabled: boolean;
}

export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  byTime: Array<{ time: Date; count: number }>;
}

export interface LogLevelPattern {
  level: LogLevel;
  pattern: RegExp;
}

export type ChartJsConstructor = new (
  ctx: CanvasRenderingContext2D,
  config: unknown
) => {
  destroy(): void;
  update(): void;
  resize?: () => void;
};
