import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import type {
  TextReversalAnalysisResult,
  TextReversalMode,
  TextReversalSuggestionContext,
} from '../types/text-reversal-and-palindrome-checker.types';

/** Lowercase and strip non-word characters (same rules as the original UI). */
export function normalizeForPalindrome(text: string): string {
  return text.toLowerCase().replace(/[\W_]/g, '');
}

export function reverseString(text: string): string {
  return text.split('').reverse().join('');
}

export function analyzeTextReversal(
  text: string,
  mode: TextReversalMode
): TextReversalAnalysisResult {
  const normalized = normalizeForPalindrome(text);
  const normalizedLength = normalized.length;

  if (mode === 'reverse') {
    return {
      resultText: reverseString(text),
      palindromeStatus: null,
      normalizedLength,
    };
  }

  const reversed = reverseString(normalized);
  return {
    resultText: '',
    palindromeStatus: normalizedLength > 0 && normalized === reversed,
    normalizedLength,
  };
}

export function resolveTextReversalSuggestion(
  context: TextReversalSuggestionContext
): TuToolSuggestion | null {
  const {
    mode,
    hasInput,
    hasResult,
    palindromeStatus,
    normalizedLength,
    inputEqualsReversed,
  } = context;

  if (!hasInput) {
    return {
      id: 'trp-get-started',
      title: 'Reverse text or check a palindrome?',
      reason:
        'Paste a phrase to validate (ignores case, spaces, punctuation), or switch to Reverse to flip characters.',
      actionLabel: 'Open ROT13 Cipher',
      path: '/text-utilities/rot13-cipher',
    };
  }

  if (mode === 'palindrome' && normalizedLength === 0) {
    return {
      id: 'trp-no-alphanumeric',
      title: 'No letters or digits to check',
      reason:
        'Palindrome mode ignores spaces and punctuation. Add alphanumeric characters, or use Reverse to flip the raw string.',
      actionLabel: 'Open Text Case Convertor',
      path: '/text-utilities/text-case-convertor',
    };
  }

  if (mode === 'palindrome' && palindromeStatus === true) {
    return {
      id: 'trp-is-palindrome',
      title: 'Palindrome confirmed',
      reason:
        'It reads the same forward and backward after normalization. Try ROT13 or Case Convertor for playful transforms.',
      actionLabel: 'Open ROT13 Cipher',
      path: '/text-utilities/rot13-cipher',
    };
  }

  if (mode === 'palindrome' && palindromeStatus === false) {
    return {
      id: 'trp-not-palindrome',
      title: 'Not a palindrome',
      reason:
        'Use ⇄ Swap to reverse the input for a quick visual check, or switch to Reverse mode to keep the flipped string.',
      actionLabel: 'Open Text Similarity',
      path: '/text-utilities/text-similarity',
    };
  }

  if (mode === 'reverse' && hasResult && inputEqualsReversed) {
    return {
      id: 'trp-self-reverse',
      title: 'Reverse equals the input',
      reason:
        'This string is unchanged when reversed — often a palindrome candidate. Switch to Palindrome mode to confirm.',
      actionLabel: 'Open Text Case Convertor',
      path: '/text-utilities/text-case-convertor',
    };
  }

  if (mode === 'reverse' && hasResult) {
    return {
      id: 'trp-reversed',
      title: 'Text reversed',
      reason:
        'Copy or download the result, use → In to keep editing, or check Text Similarity against another string.',
      actionLabel: 'Open Text Similarity',
      path: '/text-utilities/text-similarity',
    };
  }

  return {
    id: 'trp-ready',
    title: 'Ready to analyse',
    reason:
      'Try a sample from the sidebar, or upload a text file. Undo/redo works while the input editor is focused.',
    actionLabel: 'Open Slug Generator',
    path: '/text-utilities/slug-generator',
  };
}
