import type { CftToolSuggestion } from '../shared/cft-tool-suggestion.model';
import {
  HTML_ENTITY_HISTORY_LIMIT,
  HTML_ENTITY_NAMED_DECODE_MAP,
  HTML_ENTITY_NAMED_ENCODE_MAP
} from '../constants/html-entity-encoder.constants';
import type {
  HtmlEntityEncodingFormat,
  HtmlEntityHistoryEntry,
  HtmlEntityMode
} from '../types/html-entity-encoder.types';
import { looksLikeHtmlSource } from './minifier-common.utils';

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function encodeHtmlEntities(text: string, mode: HtmlEntityEncodingFormat): string {
  let result = text;

  if (mode === 'named' || mode === 'all') {
    for (const [char, entity] of Object.entries(HTML_ENTITY_NAMED_ENCODE_MAP)) {
      result = result.replace(new RegExp(escapeRegex(char), 'g'), entity);
    }
  }

  if (mode === 'numeric' || mode === 'all') {
    result = result.replace(/[^\x00-\x7F]/g, (char) => {
      const code = char.charCodeAt(0);
      return `&#${code};`;
    });
  }

  if (mode === 'hex' || mode === 'all') {
    result = result.replace(/[^\x00-\x7F]/g, (char) => {
      const code = char.charCodeAt(0);
      return `&#x${code.toString(16)};`;
    });
  }

  // Preserve existing behavior: basic entities always applied when mode is not "all".
  if (mode !== 'all') {
    result = result
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return result;
}

export function decodeHtmlEntities(text: string): string {
  let decoded = text;

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    decoded = textarea.value;
  }

  if (decoded === text) {
    for (const [entity, char] of Object.entries(HTML_ENTITY_NAMED_DECODE_MAP)) {
      decoded = decoded.replace(new RegExp(entity, 'gi'), char);
    }

    decoded = decoded.replace(/&#(\d+);/g, (_match, code) => {
      return String.fromCharCode(Number.parseInt(code, 10));
    });

    decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (_match, code) => {
      return String.fromCharCode(Number.parseInt(code, 16));
    });
  }

  return decoded;
}

export function processHtmlEntities(
  text: string,
  mode: HtmlEntityMode,
  encodingFormat: HtmlEntityEncodingFormat
): string {
  return mode === 'encode'
    ? encodeHtmlEntities(text, encodingFormat)
    : decodeHtmlEntities(text);
}

export function prependHtmlEntityHistory(
  entries: HtmlEntityHistoryEntry[],
  entry: HtmlEntityHistoryEntry,
  limit = HTML_ENTITY_HISTORY_LIMIT
): HtmlEntityHistoryEntry[] {
  const exists = entries.some(
    (item) =>
      item.input === entry.input && item.output === entry.output && item.mode === entry.mode
  );
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function createHtmlEntityHistoryEntry(
  input: string,
  output: string,
  mode: HtmlEntityMode,
  timestamp = Date.now()
): HtmlEntityHistoryEntry {
  return { timestamp, input, output, mode };
}

export function formatHtmlEntityHistoryPreview(input: string, maxLength = 40): string {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.substring(0, maxLength)}…`;
}

export function looksLikeEncodedHtmlEntities(text: string): boolean {
  return /&(?:[a-zA-Z]+|#\d+|#x[0-9A-Fa-f]+);/.test(text);
}

export function resolveHtmlEntitySuggestion(
  input: string,
  mode: HtmlEntityMode,
  hasOutput: boolean
): CftToolSuggestion | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      id: 'empty-entity',
      title: 'Paste text to encode or decode',
      reason:
        'Load the sample or paste markup with special characters. After encoding, HTML Minifier can shrink the result.',
      actionLabel: 'Open HTML Minifier',
      path: '/code-file-tools/html-minifier'
    };
  }

  if (mode === 'encode' && looksLikeEncodedHtmlEntities(trimmed)) {
    return {
      id: 'already-encoded',
      title: 'Input already looks entity-encoded',
      reason:
        'Named or numeric entities were detected. Switch to Decode to recover the original characters.',
      actionLabel: 'Open HTML Minifier',
      path: '/code-file-tools/html-minifier'
    };
  }

  if (looksLikeHtmlSource(trimmed)) {
    return {
      id: 'html-document',
      title: 'Full HTML document detected',
      reason:
        'Entity encoding is useful inside attributes and text nodes. Minify the full document next for transfer size savings.',
      actionLabel: 'Open HTML Minifier',
      path: '/code-file-tools/html-minifier'
    };
  }

  if (hasOutput && mode === 'encode') {
    return {
      id: 'pair-minify',
      title: 'Entities encoded — minify HTML next',
      reason:
        'Safe entities are ready. Run HTML Minifier to remove comments and whitespace from the surrounding markup.',
      actionLabel: 'Open HTML Minifier',
      path: '/code-file-tools/html-minifier'
    };
  }

  return {
    id: 'pair-css',
    title: 'Continue with stylesheet cleanup',
    reason:
      'Encoded text is only part of front-end weight. Minify CSS used alongside this markup.',
    actionLabel: 'Open CSS Minifier',
    path: '/code-file-tools/css-minifier'
  };
}
