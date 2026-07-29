import { HTML_ENTITY_SAMPLE } from '../constants/html-entity-encoder.constants';
import {
  createHtmlEntityHistoryEntry,
  decodeHtmlEntities,
  encodeHtmlEntities,
  looksLikeEncodedHtmlEntities,
  prependHtmlEntityHistory,
  processHtmlEntities,
  resolveHtmlEntitySuggestion
} from './html-entity-encoder.utils';

describe('html-entity-encoder.utils', () => {
  it('encodes named entities and basic markup', () => {
    const encoded = encodeHtmlEntities('A < B & "C"', 'named');
    // Named pass then basic pass double-encodes (preserved legacy behavior).
    expect(encoded).toContain('&amp;lt;');
    expect(encoded).toContain('&amp;amp;');
    expect(encoded).toContain('&amp;quot;');
  });

  it('decodes common entities', () => {
    expect(decodeHtmlEntities('&lt;div&gt;&amp;')).toContain('<');
    expect(decodeHtmlEntities('&#65;')).toBe('A');
    expect(decodeHtmlEntities('&#x41;')).toBe('A');
  });

  it('processes encode/decode modes and history helpers', () => {
    expect(processHtmlEntities('<x>', 'encode', 'named')).toContain('&amp;lt;');
    expect(looksLikeEncodedHtmlEntities('&amp;lt;')).toBe(true);

    const entry = createHtmlEntityHistoryEntry('a', 'b', 'encode', 1);
    expect(prependHtmlEntityHistory([], entry)).toHaveLength(1);
    expect(prependHtmlEntityHistory([entry], entry)).toHaveLength(1);
  });

  it('resolves contextual suggestions', () => {
    expect(resolveHtmlEntitySuggestion('', 'encode', false)?.id).toBe('empty-entity');
    expect(resolveHtmlEntitySuggestion('&lt;hi&gt;', 'encode', true)?.id).toBe('already-encoded');
    expect(resolveHtmlEntitySuggestion(HTML_ENTITY_SAMPLE, 'encode', true)?.path).toBe(
      '/code-file-tools/html-minifier'
    );
  });
});
