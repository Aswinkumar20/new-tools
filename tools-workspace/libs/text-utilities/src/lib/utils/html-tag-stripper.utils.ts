import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { stripHtmlTags } from '../shared/text-transform.utils';
import type {
  HtmlTagStripOptions,
  HtmlTagStripResult,
  HtmlTagStripSuggestionContext
} from '../types/html-tag-stripper.types';

const HTML_TAG_PATTERN = /<[a-zA-Z!?/][^>]*>/;
const HTML_ENTITY_PATTERN = /&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/;
const SCRIPT_OR_STYLE_PATTERN = /<(script|style)[\s>]/i;

export function stripHtmlTagText(options: HtmlTagStripOptions): HtmlTagStripResult {
  const { inputText, preserveLineBreaks } = options;
  if (!inputText) {
    return { output: '' };
  }
  return { output: stripHtmlTags(inputText, preserveLineBreaks) };
}

export function inputContainsHtmlTags(value: string): boolean {
  return HTML_TAG_PATTERN.test(value);
}

export function inputContainsHtmlEntities(value: string): boolean {
  return HTML_ENTITY_PATTERN.test(value);
}

export function inputContainsScriptOrStyle(value: string): boolean {
  return SCRIPT_OR_STYLE_PATTERN.test(value);
}

export function resolveHtmlTagStripperSuggestion(
  context: HtmlTagStripSuggestionContext
): TuToolSuggestion | null {
  const {
    hasInput,
    hasOutput,
    preserveLineBreaks,
    containsHtmlTags,
    containsHtmlEntities,
    containsScriptOrStyle
  } = context;

  if (!hasInput) {
    return {
      id: 'hts-get-started',
      title: 'Strip HTML to plain text?',
      reason:
        'Paste markup to remove tags and decode entities. Turn on Preserve line breaks to keep paragraph structure from block tags.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace'
    };
  }

  if (!containsHtmlTags && !containsHtmlEntities) {
    return {
      id: 'hts-no-markup',
      title: 'No HTML tags or entities detected',
      reason:
        'This looks like plain text already. Normalize whitespace or find-and-replace if you still need cleanup.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace'
    };
  }

  if (!containsHtmlTags && containsHtmlEntities) {
    return {
      id: 'hts-entities-only',
      title: 'HTML entities detected',
      reason:
        'No tags found, but entities like &amp; or &nbsp; will still be decoded into readable characters.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace'
    };
  }

  if (containsScriptOrStyle && hasOutput) {
    return {
      id: 'hts-script-style',
      title: 'Script and style blocks removed',
      reason:
        '<script> and <style> content is dropped entirely before other tags are stripped — review the plain text next.',
      actionLabel: 'Open Extract Emails & URLs',
      path: '/text-utilities/extract-emails-urls'
    };
  }

  if (containsHtmlTags && !preserveLineBreaks && hasOutput) {
    return {
      id: 'hts-breaks-off',
      title: 'Line breaks are collapsed',
      reason:
        'Preserve line breaks is off, so block tags will not insert newlines. Enable it if you want paragraph structure.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace'
    };
  }

  if (hasOutput) {
    return {
      id: 'hts-stripped',
      title: 'Tags stripped',
      reason:
        'Copy or download the plain text, then trim spacing or extract emails/URLs from the cleaned result.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace'
    };
  }

  return {
    id: 'hts-ready',
    title: 'Ready to strip',
    reason:
      'Markup detected. Output updates live as you type — upload a file when the HTML document is large.',
    actionLabel: 'Open Word & Character Counter',
    path: '/text-utilities/character-counter'
  };
}
