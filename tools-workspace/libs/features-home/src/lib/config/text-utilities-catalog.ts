export interface ToolCatalogEntry {
  name: string;
  description: string;
  path: string;
}

/** Legacy description source for SEO generation scripts.
 *  Homepage/navigation use tools-catalog.generated.ts (routed tools only from app.routes.ts). */
export const TEXT_UTILITIES_CATALOG: ToolCatalogEntry[] = [
  {
    name: 'Word & Character Counter',
    description: 'Measure characters, words, reading time, and more in real time.',
    path: 'text-utilities/character-counter',
  },
  {
    name: 'Text Case Converter',
    description: 'Switch text between lowercase, uppercase, sentence case, or custom formats.',
    path: 'text-utilities/text-case-convertor',
  },
  {
    name: 'Text to ASCII Converter',
    description: 'Transform any text into ASCII codes for encoding or debugging.',
    path: 'text-utilities/text-to-ascii',
  },
  {
    name: 'Remove Duplicate Lines',
    description: 'Clean up repeated lines from pasted text while keeping order intact.',
    path: 'text-utilities/remove-duplicate-lines',
  },
  {
    name: 'Reverse Text & Palindrome Checker',
    description: 'Flip strings instantly and verify whether phrases read the same both ways.',
    path: 'text-utilities/text-reversal-and-palindrome-checker',
  },
  {
    name: 'Base64 Encode & Decode',
    description: 'Encode files or strings to Base64 and decode them back effortlessly.',
    path: 'text-utilities/base64-encode-and-decode',
  },
  {
    name: 'Slug Generator',
    description: 'Convert titles into clean, SEO-friendly URL slugs with smart formatting.',
    path: 'text-utilities/slug-generator',
  },
  {
    name: 'Text Difference Checker',
    description: 'Compare two blocks of text and highlight additions, removals, or edits.',
    path: 'text-utilities/text-difference',
  },
  {
    name: 'Code Merge',
    description: 'Merge and reconcile code snippets with a clear diff-aware editor.',
    path: 'text-utilities/code-merge',
  },
  {
    name: 'URL Encode & Decode',
    description: 'Percent-encode or decode URL strings, query values, and Unicode text.',
    path: 'text-utilities/url-encode-and-decode',
  },
  {
    name: 'Unicode Escape & Unescape',
    description: 'Convert text to \\uXXXX escape sequences and back for debugging.',
    path: 'text-utilities/unicode-escape-unescape',
  },
  {
    name: 'HTML Tag Stripper',
    description: 'Remove HTML markup and get clean plain text instantly.',
    path: 'text-utilities/html-tag-stripper',
  },
  {
    name: 'Sort Lines',
    description: 'Sort lines alphabetically, by length, or numerically.',
    path: 'text-utilities/sort-lines',
  },
  {
    name: 'Trim & Normalize Whitespace',
    description: 'Trim lines, collapse spaces, and remove empty lines.',
    path: 'text-utilities/trim-normalize-whitespace',
  },
  {
    name: 'Find & Replace',
    description: 'Search and replace text with plain or regex patterns.',
    path: 'text-utilities/find-and-replace',
  },
  {
    name: 'Line Number Tool',
    description: 'Add or remove line numbers from any text block.',
    path: 'text-utilities/line-number-tool',
  },
  {
    name: 'Split & Join Text',
    description: 'Split by delimiter or join lines with a custom separator.',
    path: 'text-utilities/split-join-text',
  },
  {
    name: 'Regex Tester',
    description: 'Test regular expressions and view matches in real time.',
    path: 'text-utilities/regex-tester',
  },
  {
    name: 'Text Similarity Checker',
    description: 'Compare two strings with Levenshtein distance and similarity score.',
    path: 'text-utilities/text-similarity',
  },
  {
    name: 'Invisible Character Detector',
    description: 'Find zero-width spaces and hidden Unicode characters.',
    path: 'text-utilities/invisible-character-detector',
  },
  {
    name: 'Word Wrap & Unwrap',
    description: 'Wrap text at a column width or unwrap hard line breaks.',
    path: 'text-utilities/word-wrap-unwrap',
  },
  {
    name: 'Extract Emails & URLs',
    description: 'Pull email addresses and links from any text blob.',
    path: 'text-utilities/extract-emails-urls',
  },
  {
    name: 'JSON String Escape & Unescape',
    description: 'Escape or unescape strings for safe JSON embedding.',
    path: 'text-utilities/json-string-escape-unescape',
  },
  {
    name: 'Hex Encode & Decode',
    description: 'Convert text to hexadecimal and decode hex to text.',
    path: 'text-utilities/hex-encode-decode',
  },
  {
    name: 'ROT13 & Caesar Cipher',
    description: 'Apply ROT13 or custom Caesar cipher shifts to text.',
    path: 'text-utilities/rot13-cipher',
  },
  {
    name: 'Binary Text Converter',
    description: 'Convert text to binary and decode binary back to text.',
    path: 'text-utilities/binary-text-converter',
  },
  {
    name: 'Morse Code Converter',
    description: 'Encode text to Morse code and decode it back.',
    path: 'text-utilities/morse-code-converter',
  },
  {
    name: 'Readability Analyzer',
    description: 'Get Flesch Reading Ease and grade-level scores for any text.',
    path: 'text-utilities/readability-analyzer',
  },
  {
    name: 'Keyword Density Checker',
    description: 'Analyze word frequency and keyword density for SEO.',
    path: 'text-utilities/keyword-density',
  },
  {
    name: 'Pako Compress & Decompress',
    description: 'Compress or decompress text with zlib deflate, raw deflate, or gzip.',
    path: 'text-utilities/pako-encode-and-decode',
  },
];
