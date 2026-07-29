import {
  CLIPBOARD_HISTORY_DEFAULT_SETTINGS,
  CLIPBOARD_HISTORY_PREVIEW_MAX_LENGTH
} from '../constants/clipboard-history.constants';
import {
  canAddClipboardText,
  createClipboardEntry,
  detectClipboardEntryType,
  filterClipboardHistory,
  formatClipboardBytes,
  formatClipboardTimestamp,
  getClipboardPreview,
  isClipboardApiSupported,
  looksLikeJsonClip,
  parseClipboardHistory,
  prependClipboardEntry,
  promoteClipboardEntry,
  resolveClipboardHistorySuggestion
} from './clipboard-history.utils';

describe('clipboard-history.utils', () => {
  it('detects support, types, and previews', () => {
    expect(isClipboardApiSupported(false)).toBe(false);
    expect(detectClipboardEntryType('https://example.com/path')).toBe('url');
    expect(detectClipboardEntryType('const x = () => {}')).toBe('code');
    expect(detectClipboardEntryType('hello world')).toBe('text');
    expect(getClipboardPreview('abc')).toBe('abc');
    expect(getClipboardPreview('a'.repeat(CLIPBOARD_HISTORY_PREVIEW_MAX_LENGTH + 5))).toContain(
      '...'
    );
  });

  it('creates, prepends, promotes, and filters entries', () => {
    const entry = createClipboardEntry('hello', { now: 1000, random: 0.123456789 });
    expect(entry.length).toBe(5);
    expect(entry.type).toBe('text');
    expect(entry.timestamp).toBe(1000);

    const next = prependClipboardEntry([], entry, 2);
    expect(next).toHaveLength(1);

    const second = createClipboardEntry('world', { now: 2000, random: 0.987654321 });
    const limited = prependClipboardEntry([entry], second, 1);
    expect(limited).toHaveLength(1);
    expect(limited[0].text).toBe('world');

    const promoted = promoteClipboardEntry([entry, second], entry, 3000);
    expect(promoted[0].id).toBe(entry.id);
    expect(promoted[0].timestamp).toBe(3000);

    expect(filterClipboardHistory([entry, second], 'wor')).toHaveLength(1);
  });

  it('validates add rules and formats helpers', () => {
    const entry = createClipboardEntry('dup');
    expect(
      canAddClipboardText('dup', [entry], {
        minLength: 1,
        maxLength: 100,
        excludeDuplicates: true
      })
    ).toBe(false);
    expect(
      canAddClipboardText('ok', [entry], {
        minLength: 1,
        maxLength: 100,
        excludeDuplicates: true
      })
    ).toBe(true);

    expect(formatClipboardBytes(0)).toBe('0 B');
    expect(formatClipboardTimestamp(Date.now(), Date.now())).toBe('Just now');
    expect(parseClipboardHistory(null)).toEqual([]);
    expect(looksLikeJsonClip('{"a":1}')).toBe(true);
  });

  it('resolves contextual suggestions', () => {
    expect(resolveClipboardHistorySuggestion(false, 0, null)?.path).toBe(
      '/code-file-tools/clipboard-viewer'
    );

    const urlEntry = createClipboardEntry('https://example.com');
    expect(resolveClipboardHistorySuggestion(true, 1, urlEntry)?.path).toBe(
      '/text-utilities/url-encode-and-decode'
    );

    const jsonEntry = createClipboardEntry('{"a":1}');
    expect(resolveClipboardHistorySuggestion(true, 1, jsonEntry)?.path).toBe(
      '/data-converters/json-formatter-beautifier-validator'
    );

    expect(resolveClipboardHistorySuggestion(true, 0, null)?.id).toBe('empty-history');
    expect(resolveClipboardHistorySuggestion(true, 2, null)?.id).toBe('pair-viewer');
  });

  it('exposes default settings shape', () => {
    expect(CLIPBOARD_HISTORY_DEFAULT_SETTINGS.maxEntries).toBe(50);
    expect(CLIPBOARD_HISTORY_DEFAULT_SETTINGS.autoMonitor).toBe(true);
  });
});
