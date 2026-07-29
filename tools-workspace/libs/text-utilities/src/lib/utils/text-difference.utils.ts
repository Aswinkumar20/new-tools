import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import {
  TEXT_DIFF_MAX_FONT_SIZE,
  TEXT_DIFF_MIN_FONT_SIZE,
} from '../constants/text-difference.constants';
import type {
  DiffStats,
  TextDiffLanguage,
  TextDifferenceSuggestionContext,
} from '../types/text-difference.types';

export function countTextLines(text: string): number {
  if (!text) {
    return 0;
  }
  return text.split('\n').length;
}

export function computeDiffStats(
  original: string,
  modified: string,
  lineChangeCount = 0
): DiffStats {
  return {
    originalChars: original.length,
    modifiedChars: modified.length,
    originalLines: countTextLines(original),
    modifiedLines: countTextLines(modified),
    changes: lineChangeCount,
    hasContent: original.length > 0 || modified.length > 0,
  };
}

export function clampDiffFontSize(fontSize: number): number | null {
  if (fontSize < TEXT_DIFF_MIN_FONT_SIZE || fontSize > TEXT_DIFF_MAX_FONT_SIZE) {
    return null;
  }
  return fontSize;
}

export function normalizeDiffLanguage(language: string): TextDiffLanguage {
  return (language === 'text/plain' ? 'plaintext' : language) as TextDiffLanguage;
}

export function isLikelyDiffTextFile(file: File): boolean {
  const blockedTypes = [
    'image/',
    'video/',
    'audio/',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
  ];
  if (file.type && blockedTypes.some((prefix) => file.type.startsWith(prefix) || file.type === prefix)) {
    return false;
  }
  if (!file.type || file.type.startsWith('text/')) {
    return true;
  }
  const allowed = new Set([
    'application/json',
    'application/xml',
    'application/javascript',
    'application/octet-stream',
  ]);
  if (allowed.has(file.type)) {
    return true;
  }
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  return new Set([
    'txt',
    'text',
    'md',
    'json',
    'xml',
    'html',
    'htm',
    'log',
    'yaml',
    'yml',
    'ts',
    'js',
    'css',
    'py',
    'java',
    'csv',
  ]).has(ext);
}

export function resolveTextDifferenceSuggestion(
  context: TextDifferenceSuggestionContext
): TuToolSuggestion | null {
  const {
    hasOriginal,
    hasModified,
    areIdentical,
    changeCount,
    ignoreTrimWhitespace,
    charDelta,
  } = context;

  if (!hasOriginal && !hasModified) {
    return {
      id: 'td-get-started',
      title: 'Compare two versions of text?',
      reason:
        'Paste or upload original on the left and modified on the right. Diff highlighting updates as you type.',
      actionLabel: 'Open Code Merge',
      path: '/text-utilities/code-merge',
    };
  }

  if (hasOriginal !== hasModified) {
    return {
      id: 'td-one-side-empty',
      title: hasOriginal ? 'Modified side is empty' : 'Original side is empty',
      reason:
        'A useful diff needs content on both sides. Upload or paste into the empty pane, or clear both and start fresh.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (areIdentical) {
    return {
      id: 'td-identical',
      title: 'Both sides are identical',
      reason: ignoreTrimWhitespace
        ? 'No differences with current options. Turn off Ignore trim whitespace if spacing-only changes matter.'
        : 'Texts match exactly. Use Text Similarity for a numeric score, or Code Merge if you still need to combine files.',
      actionLabel: 'Open Text Similarity',
      path: '/text-utilities/text-similarity',
    };
  }

  if (!ignoreTrimWhitespace && changeCount > 0 && Math.abs(charDelta) <= changeCount * 2) {
    return {
      id: 'td-whitespace-hint',
      title: 'Differences may be whitespace',
      reason:
        'Small character deltas with several line changes often come from spaces or line endings. Enable Ignore trim whitespace to focus on real edits.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (changeCount >= 5) {
    return {
      id: 'td-many-changes',
      title: `${changeCount} changed regions`,
      reason:
        'Large diffs are easier to reconcile after sorting or merging. Code Merge helps combine versions; Find and Replace applies bulk fixes.',
      actionLabel: 'Open Code Merge',
      path: '/text-utilities/code-merge',
    };
  }

  if (changeCount > 0) {
    return {
      id: 'td-has-changes',
      title: 'Differences detected',
      reason:
        'Review highlighted lines in Split or Unified view. Swap sides if you want modified as the baseline, then copy or download either pane.',
      actionLabel: 'Open Text Similarity',
      path: '/text-utilities/text-similarity',
    };
  }

  return {
    id: 'td-ready',
    title: 'Ready to compare',
    reason:
      'Pick a language for syntax highlighting, adjust theme/font in Properties, and toggle Split vs Unified on desktop.',
    actionLabel: 'Open JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
  };
}
