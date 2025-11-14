import { Injectable } from '@angular/core';
import { LogEntry, LogLevel, LogFilter, LogStats } from './log-entry.model';

@Injectable({
  providedIn: 'root'
})
export class LogViewerService {
  
  private readonly logLevelPatterns = [
    { level: LogLevel.FATAL, pattern: /\b(FATAL|FATALITY|CRITICAL)\b/i },
    { level: LogLevel.ERROR, pattern: /\b(ERROR|ERR|EXCEPTION|FAILED|FAILURE)\b/i },
    { level: LogLevel.WARN, pattern: /\b(WARN|WARNING|WRN)\b/i },
    { level: LogLevel.INFO, pattern: /\b(INFO|INFORMATION)\b/i },
    { level: LogLevel.DEBUG, pattern: /\b(DEBUG|DBG)\b/i },
    { level: LogLevel.TRACE, pattern: /\b(TRACE|TRC)\b/i }
  ];

  private readonly timestampPatterns = [
    // ISO 8601
    /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/,
    // Common log formats
    /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,
    /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/,
    /(\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\])/
  ];

  parseLogs(logs: string[]): LogEntry[] {
    const entries: LogEntry[] = [];
    let currentMultiLine: LogEntry | null = null;

    for (let i = 0; i < logs.length; i++) {
      const line = logs[i];
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        if (currentMultiLine) {
          currentMultiLine.raw += '\n' + line;
          currentMultiLine.message += '\n' + line;
        }
        continue;
      }

      // Check if this is a continuation of a multi-line entry (stack trace, etc.)
      const isMultiLineContinuation = currentMultiLine && (
        trimmedLine.startsWith(' ') ||
        trimmedLine.startsWith('\t') ||
        trimmedLine.startsWith('at ') ||
        trimmedLine.startsWith('Caused by:') ||
        trimmedLine.startsWith('Exception in') ||
        trimmedLine.match(/^\s*(at|\.\.\.)\s+\d+/)
      );

      if (isMultiLineContinuation && currentMultiLine) {
        currentMultiLine.raw += '\n' + line;
        currentMultiLine.message += '\n' + line;
        continue;
      }

      // Close previous multi-line entry
      if (currentMultiLine) {
        currentMultiLine = null;
      }

      // Parse new log entry
      const entry = this.parseLogLine(line, i + 1);
      
      // Check if this might start a multi-line entry
      if (this.isLikelyMultiLineStart(entry)) {
        entry.isMultiLine = true;
        entry.expanded = false;
        currentMultiLine = entry;
      }

      entries.push(entry);
    }

    return entries;
  }

  private parseLogLine(line: string, lineNumber: number): LogEntry {
    const entry: LogEntry = {
      id: `log-${lineNumber}-${Date.now()}`,
      raw: line,
      level: this.detectLogLevel(line),
      message: line,
      lineNumber: lineNumber,
      isMultiLine: false,
      expanded: false
    };

    // Extract timestamp
    const timestamp = this.extractTimestamp(line);
    if (timestamp) {
      entry.timestamp = timestamp;
      // Remove timestamp from message for cleaner display
      entry.message = line.replace(/^[^\]]*\]\s*/, '').replace(/^\d{4}[-\/]\d{2}[-\/]\d{2}[T\s]\d{2}:\d{2}:\d{2}[^\s]*\s*/, '');
    }

    return entry;
  }

  private detectLogLevel(line: string): LogLevel {
    for (const { level, pattern } of this.logLevelPatterns) {
      if (pattern.test(line)) {
        return level;
      }
    }
    return LogLevel.UNKNOWN;
  }

  private extractTimestamp(line: string): Date | undefined {
    for (const pattern of this.timestampPatterns) {
      const match = line.match(pattern);
      if (match) {
        const dateStr = match[2] || match[1];
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
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

  filterLogs(entries: LogEntry[], filter: LogFilter): LogEntry[] {
    let filtered = [...entries];

    // Filter by levels
    if (filter.levels.length > 0 && filter.levels.length < Object.keys(LogLevel).length) {
      filtered = filtered.filter(entry => filter.levels.includes(entry.level));
    }

    // Filter by date range
    if (filter.dateFrom) {
      filtered = filtered.filter(entry => {
        if (!entry.timestamp) return true;
        return entry.timestamp >= filter.dateFrom!;
      });
    }

    if (filter.dateTo) {
      filtered = filtered.filter(entry => {
        if (!entry.timestamp) return true;
        return entry.timestamp <= filter.dateTo!;
      });
    }

    // Filter by search text
    if (filter.searchText.trim()) {
      const searchLower = filter.searchText.toLowerCase();
      
      if (filter.regexEnabled) {
        try {
          const regex = new RegExp(filter.searchText, 'i');
          filtered = filtered.filter(entry => regex.test(entry.raw));
        } catch (error) {
          // Invalid regex, fall back to simple search
          filtered = filtered.filter(entry => 
            entry.raw.toLowerCase().includes(searchLower)
          );
        }
      } else {
        filtered = filtered.filter(entry => 
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

    // Count by level
    for (const entry of entries) {
      stats.byLevel[entry.level]++;
    }

    // Group by time (hourly buckets for entries with timestamps)
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
}

