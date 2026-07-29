import {
  createEmptyClipboardContent,
  getClipboardFileExtension,
  getClipboardMimeType,
  isClipboardViewerSupported,
  looksLikeJsonClipboard,
  mapClipboardPermissionErrors,
  processClipboardContent,
  resolveClipboardViewerSuggestion,
  shouldTreatClipboardErrorAsEmpty
} from './clipboard-viewer.utils';

describe('clipboard-viewer.utils', () => {
  it('detects support and processes content types', () => {
    expect(isClipboardViewerSupported(false)).toBe(false);

    expect(processClipboardContent('').type).toBe('empty');
    expect(processClipboardContent('https://example.com').type).toBe('url');
    expect(processClipboardContent('<div>hi</div>').type).toBe('html');
    expect(processClipboardContent('const x = 1;').type).toBe('code');
    expect(processClipboardContent('plain text').type).toBe('text');

    const multi = processClipboardContent('one\ntwo three');
    expect(multi.metadata.lines).toBe(2);
    expect(multi.metadata.words).toBe(3);
    expect(multi.metadata.characters).toBe('one\ntwo three'.length);
  });

  it('maps download helpers and permission errors', () => {
    expect(getClipboardFileExtension('html')).toBe('.html');
    expect(getClipboardFileExtension('code')).toBe('.txt');
    expect(getClipboardMimeType('html')).toBe('text/html');
    expect(getClipboardMimeType('text')).toBe('text/plain');

    expect(shouldTreatClipboardErrorAsEmpty('Document is empty')).toBe(true);
    expect(mapClipboardPermissionErrors('permission denied')).toEqual([
      'Clipboard access denied.',
      'Please grant clipboard permissions or click "Read Clipboard" to manually read.'
    ]);
    expect(mapClipboardPermissionErrors('boom')[0]).toContain('Failed to read clipboard');
  });

  it('resolves contextual suggestions', () => {
    expect(resolveClipboardViewerSuggestion(false, null)?.path).toBe(
      '/code-file-tools/clipboard-history'
    );
    expect(resolveClipboardViewerSuggestion(true, null)?.id).toBe('empty-clipboard');
    expect(resolveClipboardViewerSuggestion(true, createEmptyClipboardContent())?.id).toBe(
      'empty-clipboard'
    );

    expect(
      resolveClipboardViewerSuggestion(true, processClipboardContent('https://a.com'))?.path
    ).toBe('/text-utilities/url-encode-and-decode');

    expect(
      resolveClipboardViewerSuggestion(true, processClipboardContent('<p>x</p>'))?.path
    ).toBe('/code-file-tools/html-entity-encoder');

    expect(looksLikeJsonClipboard('{"a":1}')).toBe(true);
    expect(
      resolveClipboardViewerSuggestion(true, processClipboardContent('{"a":1}'))?.path
    ).toBe('/data-converters/json-formatter-beautifier-validator');

    expect(
      resolveClipboardViewerSuggestion(true, processClipboardContent('const x = 1;'))?.path
    ).toBe('/code-file-tools/javascript-minifier');
  });
});
