import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';

/** Common English stop words excluded when the stop-words filter is enabled */
export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at', 'by', 'for', 'with',
  'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'as',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me',
  'him', 'her', 'us', 'them', 'my', 'your', 'his', 'their', 'our', 'mine', 'yours', 'hers',
  'theirs', 'what', 'which', 'who', 'whom', 'whose', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'any',
]);

export const READING_WPM = 200;
export const SPEAKING_WPM = 130;

export const WCC_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const WCC_USE_WORKER_THRESHOLD = 2000;
export const WCC_FREQUENCY_DISPLAY_LIMIT = 100;
export const WCC_TAG_CLOUD_LIMIT = 30;
export const WCC_PDF_FREQUENCY_LIMIT = 300;
export const WCC_PHRASE_DISPLAY_LIMIT = 50;
export const WCC_MAX_HISTORY_ENTRIES = 30;
export const WCC_MAX_STORED_ENTRY_LENGTH = 100000;

/** Flesch scores at or below this are treated as difficult for suggestions. */
export const WCC_DIFFICULT_READABILITY_THRESHOLD = 50;

/** Word counts at or above this suggest a long-form draft. */
export const WCC_LONG_FORM_WORD_THRESHOLD = 500;

export const WCC_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Readability Analyzer',
    path: '/text-utilities/readability-analyzer',
    description: 'Focused Flesch scores and reading level for the same draft',
  },
  {
    label: 'Keyword Density',
    path: '/text-utilities/keyword-density',
    description: 'Deeper keyword density analysis for SEO-oriented copy',
  },
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Clean spacing that can skew word and sentence counts',
  },
  {
    label: 'Remove Duplicate Lines',
    path: '/text-utilities/remove-duplicate-lines',
    description: 'Deduplicate lists before counting unique terms',
  },
];
