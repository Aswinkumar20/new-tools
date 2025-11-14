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
  metadata?: Record<string, any>;
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

