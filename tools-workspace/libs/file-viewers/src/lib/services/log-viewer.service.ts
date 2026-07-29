import { Injectable } from '@angular/core';
import {
  LOG_LEVEL_PATTERNS,
  LOG_TIMESTAMP_PATTERNS
} from '../constants/log-viewer.constants';
import {
  LogEntry,
  LogFilter,
  LogLevel,
  LogStats
} from '../types/log-viewer.types';

@Injectable({
  providedIn: 'root'
})
export class LogViewerService {
  parseLogs(logs: string[]): LogEntry[] {
    const entries: LogEntry[] = [];
    let currentMultiLine: LogEntry | null = null;

    for (let i = 0; i < logs.length; i++) {
      const line = logs[i];
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        if (currentMultiLine) {
          currentMultiLine.raw += '\n' + line;
          currentMultiLine.message += '\n' + line;
        }
        continue;
      }

      const isMultiLineContinuation =
        currentMultiLine &&
        (trimmedLine.startsWith(' ') ||
          trimmedLine.startsWith('\t') ||
          trimmedLine.startsWith('at ') ||
          trimmedLine.startsWith('Caused by:') ||
          trimmedLine.startsWith('Exception in') ||
          trimmedLine.match(/^\s*(at|\.\.\.)\s+\d+/));

      if (isMultiLineContinuation && currentMultiLine) {
        currentMultiLine.raw += '\n' + line;
        currentMultiLine.message += '\n' + line;
        continue;
      }

      if (currentMultiLine) {
        currentMultiLine = null;
      }

      const entry = this.parseLogLine(line, i + 1);

      if (this.isLikelyMultiLineStart(entry)) {
        entry.isMultiLine = true;
        entry.expanded = false;
        currentMultiLine = entry;
      }

      entries.push(entry);
    }

    return entries;
  }

  filterLogs(entries: LogEntry[], filter: LogFilter): LogEntry[] {
    let filtered = [...entries];

    if (filter.levels.length > 0 && filter.levels.length < Object.keys(LogLevel).length) {
      filtered = filtered.filter((entry) => filter.levels.includes(entry.level));
    }

    if (filter.dateFrom) {
      filtered = filtered.filter((entry) => {
        if (!entry.timestamp) {
          return true;
        }
        return entry.timestamp >= filter.dateFrom!;
      });
    }

    if (filter.dateTo) {
      filtered = filtered.filter((entry) => {
        if (!entry.timestamp) {
          return true;
        }
        return entry.timestamp <= filter.dateTo!;
      });
    }

    if (filter.searchText.trim()) {
      const searchLower = filter.searchText.toLowerCase();

      if (filter.regexEnabled) {
        try {
          const regex = new RegExp(filter.searchText, 'i');
          filtered = filtered.filter((entry) => regex.test(entry.raw));
        } catch {
          filtered = filtered.filter((entry) =>
            entry.raw.toLowerCase().includes(searchLower)
          );
        }
      } else {
        filtered = filtered.filter((entry) =>
          entry.raw.toLowerCase().includes(searchLower)
        );
      }
    }

    return filtered;
  }

  calculateStats(entries: LogEntry[]): LogStats {
    const stats: LogStats = {
      total: entries.length,
      byLevel: {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.ERROR]: 0,
        [LogLevel.TRACE]: 0,
        [LogLevel.FATAL]: 0,
        [LogLevel.UNKNOWN]: 0
      },
      byTime: []
    };

    for (const entry of entries) {
      stats.byLevel[entry.level]++;
    }

    const timeMap = new Map<string, number>();
    for (const entry of entries) {
      if (entry.timestamp) {
        const hourKey = new Date(entry.timestamp).toISOString().slice(0, 13) + ':00:00';
        timeMap.set(hourKey, (timeMap.get(hourKey) || 0) + 1);
      }
    }

    stats.byTime = Array.from(timeMap.entries())
      .map(([time, count]) => ({
        time: new Date(time),
        count
      }))
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    return stats;
  }

  private parseLogLine(line: string, lineNumber: number): LogEntry {
    const entry: LogEntry = {
      id: `log-${lineNumber}-${Date.now()}`,
      raw: line,
      level: this.detectLogLevel(line),
      message: line,
      lineNumber,
      isMultiLine: false,
      expanded: false
    };

    const timestamp = this.extractTimestamp(line);
    if (timestamp) {
      entry.timestamp = timestamp;
      entry.message = line
        .replace(/^[^\]]*\]\s*/, '')
        .replace(/^\d{4}[-\/]\d{2}[-\/]\d{2}[T\s]\d{2}:\d{2}:\d{2}[^\s]*\s*/, '');
    }

    return entry;
  }

  private detectLogLevel(line: string): LogLevel {
    for (const { level, pattern } of LOG_LEVEL_PATTERNS) {
      if (pattern.test(line)) {
        return level;
      }
    }
    return LogLevel.UNKNOWN;
  }

  private extractTimestamp(line: string): Date | undefined {
    for (const pattern of LOG_TIMESTAMP_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const dateStr = match[2] || match[1];
        const date = new Date(dateStr);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }
    return undefined;
  }

  private isLikelyMultiLineStart(entry: LogEntry): boolean {
    const message = entry.message.toLowerCase();
    return (
      entry.level === LogLevel.ERROR ||
      message.includes('exception') ||
      message.includes('stack trace') ||
      message.includes('at ') ||
      message.includes('caused by')
    );
  }
}
