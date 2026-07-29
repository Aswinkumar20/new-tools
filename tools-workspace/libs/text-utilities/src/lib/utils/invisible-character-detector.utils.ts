import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import {
  annotateInvisibleChars,
  detectInvisibleChars,
  type InvisibleCharHit
} from '../shared/text-transform.utils';
import type {
  InvisibleCharacterDetectionResult,
  InvisibleCharacterSuggestionContext,
  InvisibleHitSummary
} from '../types/invisible-character-detector.types';

export function summarizeInvisibleHits(hits: InvisibleCharHit[]): InvisibleHitSummary {
  let hasZeroWidth = false;
  let hasBom = false;
  let hasNbspOrSoftHyphen = false;

  for (const hit of hits) {
    const codePoint = hit.codePoint;
    if (codePoint === 0xfeff) {
      hasBom = true;
    }
    if (codePoint === 0xa0 || codePoint === 0xad) {
      hasNbspOrSoftHyphen = true;
    }
    if (
      (codePoint >= 0x200b && codePoint <= 0x200f) ||
      codePoint === 0x2060 ||
      codePoint === 0xfeff
    ) {
      hasZeroWidth = true;
    }
  }

  return {
    hitCount: hits.length,
    hasZeroWidth,
    hasBom,
    hasNbspOrSoftHyphen
  };
}

export function detectAndAnnotateInvisibleChars(inputText: string): InvisibleCharacterDetectionResult {
  if (!inputText) {
    return { hits: [], output: '' };
  }

  const hits = detectInvisibleChars(inputText);
  return {
    hits,
    output: hits.length ? annotateInvisibleChars(inputText, hits) : ''
  };
}

export function formatInvisibleCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function resolveInvisibleCharacterSuggestion(
  context: InvisibleCharacterSuggestionContext
): TuToolSuggestion | null {
  const { hasInput, hitCount, hasZeroWidth, hasBom, hasNbspOrSoftHyphen } = context;

  if (!hasInput) {
    return {
      id: 'icd-get-started',
      title: 'Scan for hidden characters?',
      reason:
        'Paste text that looks “off” — zero-width spaces, BOMs, soft hyphens, and control characters are highlighted as [NAME].',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace'
    };
  }

  if (hitCount === 0) {
    return {
      id: 'icd-clean',
      title: 'No invisible characters found',
      reason:
        'This sample looks clean for known hidden characters. Normalize whitespace or inspect ASCII codes if something still feels wrong.',
      actionLabel: 'Open Text to ASCII',
      path: '/text-utilities/text-to-ascii'
    };
  }

  if (hasBom) {
    return {
      id: 'icd-bom',
      title: 'BOM / zero-width no-break space detected',
      reason:
        'A byte-order mark (U+FEFF) often sneaks in from copy-paste or file encoding. Remove it with Find and Replace, then re-scan.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace'
    };
  }

  if (hasZeroWidth) {
    return {
      id: 'icd-zero-width',
      title: 'Zero-width characters detected',
      reason:
        'Zero-width spaces and direction marks break searches and diffs. Strip them, then trim leftover spacing.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace'
    };
  }

  if (hasNbspOrSoftHyphen) {
    return {
      id: 'icd-nbsp',
      title: 'Non-breaking spaces or soft hyphens found',
      reason:
        'These look like normal spaces or empty gaps but change wrapping and matching. Clean with Trim / Normalize Whitespace next.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace'
    };
  }

  return {
    id: 'icd-found',
    title: `${hitCount} invisible character${hitCount === 1 ? '' : 's'} found`,
    reason:
      'Review the sidebar list for positions and Unicode names. Copy the annotated output or remove matches with Find and Replace.',
    actionLabel: 'Open Unicode Escape / Unescape',
    path: '/text-utilities/unicode-escape-unescape'
  };
}
