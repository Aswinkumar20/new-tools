import { LogViewerService } from './log-viewer.service';
import { LogLevel } from '../types/log-viewer.types';

describe('LogViewerService', () => {
  const service = new LogViewerService();

  it('parses levels and timestamps', () => {
    const entries = service.parseLogs([
      '2024-01-15T10:00:00Z INFO Started application',
      '2024-01-15T10:00:01Z ERROR Failed to connect',
      '    at Service.connect (app.js:10)',
      '2024-01-15T10:00:02Z WARN Retrying'
    ]);

    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.some((e) => e.level === LogLevel.INFO)).toBe(true);
    expect(entries.some((e) => e.level === LogLevel.ERROR)).toBe(true);
    const errorEntry = entries.find((e) => e.level === LogLevel.ERROR);
    expect(errorEntry?.isMultiLine).toBe(true);
    expect(errorEntry?.raw).toContain('at Service.connect');
  });

  it('filters by level and search', () => {
    const entries = service.parseLogs([
      'INFO hello world',
      'ERROR boom',
      'DEBUG detail'
    ]);

    const errors = service.filterLogs(entries, {
      searchText: '',
      levels: [LogLevel.ERROR],
      regexEnabled: false
    });
    expect(errors.every((e) => e.level === LogLevel.ERROR)).toBe(true);

    const searched = service.filterLogs(entries, {
      searchText: 'hello',
      levels: [],
      regexEnabled: false
    });
    expect(searched).toHaveLength(1);

    const regexed = service.filterLogs(entries, {
      searchText: 'ERR|WARN',
      levels: [],
      regexEnabled: true
    });
    expect(regexed.some((e) => e.level === LogLevel.ERROR)).toBe(true);
  });

  it('calculates stats', () => {
    const entries = service.parseLogs(['INFO a', 'ERROR b', 'ERROR c']);
    const stats = service.calculateStats(entries);
    expect(stats.total).toBe(3);
    expect(stats.byLevel[LogLevel.ERROR]).toBe(2);
    expect(stats.byLevel[LogLevel.INFO]).toBe(1);
  });
});
