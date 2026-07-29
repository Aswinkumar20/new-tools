import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { SLUG_LONG_LENGTH_THRESHOLD } from '../constants/slug-generator.constants';
import type {
  SlugGenerationOptions,
  SlugSuggestionContext,
} from '../types/slug-generator.types';

/**
 * URL-friendly slug from a headline.
 * Preserves legacy regex order: separator substitution, strip non-word (except hyphen),
 * collapse repeated hyphens, trim leading/trailing hyphens, optional digit removal.
 */
export function generateSlug(options: SlugGenerationOptions): string {
  const { text, separator, removeNumbers } = options;

  let slug = text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, separator)
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, separator)
    .replace(/^-+|-+$/g, '');

  if (removeNumbers) {
    slug = slug.replace(/[0-9]/g, '');
  }

  return slug;
}

/** Heuristic: input already looks like a path slug (lowercase tokens + separators). */
export function inputLooksLikeSlug(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    return false;
  }
  return /^[a-z0-9]+(?:[-_+][a-z0-9]+)+$/.test(trimmed);
}

export function inputLooksLikeUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim());
}

export function resolveSlugSuggestion(
  context: SlugSuggestionContext
): TuToolSuggestion | null {
  const {
    hasInput,
    hasSlug,
    slugLength,
    separator,
    removeNumbers,
    inputLooksLikeUrl: looksUrl,
    inputLooksLikeSlug: looksSlug,
  } = context;

  if (!hasInput) {
    return {
      id: 'slug-get-started',
      title: 'Turn a headline into a URL slug?',
      reason:
        'Paste a title or product name. Hyphen is the usual SEO separator; open Options to strip numbers.',
      actionLabel: 'Open Keyword Density',
      path: '/text-utilities/keyword-density',
    };
  }

  if (looksUrl) {
    return {
      id: 'slug-looks-url',
      title: 'Full URL detected',
      reason:
        'This tool slugifies the whole string, including protocol noise. Paste only the page title, or use Find and Replace to isolate the path segment first.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (hasInput && !hasSlug) {
    return {
      id: 'slug-empty-result',
      title: 'Nothing left to slugify',
      reason:
        'After cleanup, no word characters remained. Add letters or numbers, or turn off Remove numbers if digits were the only content.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace',
    };
  }

  if (looksSlug && hasSlug) {
    return {
      id: 'slug-already-slug',
      title: 'Input already looks like a slug',
      reason:
        'Tokens are already lowercase with separators. Adjust the separator chips if you need underscores or plus signs instead.',
      actionLabel: 'Open Text Case Convertor',
      path: '/text-utilities/text-case-convertor',
    };
  }

  if (hasSlug && slugLength >= SLUG_LONG_LENGTH_THRESHOLD) {
    return {
      id: 'slug-too-long',
      title: 'Slug is quite long for a URL',
      reason:
        'Search engines favor shorter paths. Shorten the headline, or pull a focused phrase with Keyword Density first.',
      actionLabel: 'Open Keyword Density',
      path: '/text-utilities/keyword-density',
    };
  }

  if (hasSlug) {
    const sepHint =
      separator === '-'
        ? 'Hyphen is SEO-friendly for most CMS paths.'
        : `Using “${separator}” as the separator — switch to Hyphen if your CMS prefers dashes.`;
    const numbersHint = removeNumbers
      ? ' Numbers were stripped.'
      : '';
    return {
      id: 'slug-ready',
      title: 'Slug ready to copy',
      reason: `${sepHint}${numbersHint} Preview uses example.com — paste into your CMS or download as TXT.`,
      actionLabel: 'Open Text Case Convertor',
      path: '/text-utilities/text-case-convertor',
    };
  }

  return {
    id: 'slug-typing',
    title: 'Keep typing',
    reason:
      'The slug updates live. History in the sidebar stores unique results for quick re-copy.',
    actionLabel: 'Open Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
  };
}
