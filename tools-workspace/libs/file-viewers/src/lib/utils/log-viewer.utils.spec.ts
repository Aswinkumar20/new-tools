import {
  formatLogLevelPercentage,
  getLogLevelClass,
  getLogLevelColor,
  isValidLogFile,
  previewLogMessage,
  resolveLogSuggestion
} from './log-viewer.utils';
import { LogLevel } from '../types/log-viewer.types';

describe('log-viewer.utils', () => {
  it('validates log files and formats helpers', () => {
    expect(isValidLogFile({ name: 'app.log', type: '' })).toBe(true);
    expect(isValidLogFile({ name: 'notes.txt', type: 'text/plain' })).toBe(true);
    expect(isValidLogFile({ name: 'photo.png', type: 'image/png' })).toBe(false);
    expect(getLogLevelClass(LogLevel.ERROR)).toBe('log-level-error');
    expect(getLogLevelColor(LogLevel.WARN)).toBe('#ff9800');
    expect(previewLogMessage('short')).toBe('short');
    expect(previewLogMessage('x'.repeat(250)).endsWith('...')).toBe(true);
    expect(
      formatLogLevelPercentage(
        {
          total: 10,
          byLevel: {
            [LogLevel.DEBUG]: 0,
            [LogLevel.INFO]: 5,
            [LogLevel.WARN]: 0,
            [LogLevel.ERROR]: 5,
            [LogLevel.TRACE]: 0,
            [LogLevel.FATAL]: 0,
            [LogLevel.UNKNOWN]: 0
          },
          byTime: []
        },
        LogLevel.ERROR
      )
    ).toBe('50.0%');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveLogSuggestion({
        hasLogs: false,
        hasError: false,
        errorCount: 0,
        regexEnabled: false,
        searchText: ''
      })?.id
    ).toBe('lv-text');

    expect(
      resolveLogSuggestion({
        hasLogs: true,
        hasError: true,
        errorCount: 0,
        regexEnabled: false,
        searchText: ''
      })?.id
    ).toBe('lv-meta');

    expect(
      resolveLogSuggestion({
        hasLogs: true,
        hasError: false,
        errorCount: 0,
        regexEnabled: true,
        searchText: 'ERROR.*'
      })?.id
    ).toBe('lv-regex');

    expect(
      resolveLogSuggestion({
        hasLogs: true,
        hasError: false,
        errorCount: 3,
        regexEnabled: false,
        searchText: ''
      })?.id
    ).toBe('lv-diff');
  });
});
