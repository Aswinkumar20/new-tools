import type {
  MarkdownToHtmlHtmlOptions,
  MarkdownToHtmlMarkdownOptions
} from '../types/markdown-to-html.types';
import { buildLineNumberList, formatCsvJsonBytes } from '../utils/csv-to-json-json-to-csv.utils';
import type { DcToolSuggestion } from '../shared/dc-tool-suggestion.model';
import type {
  MarkdownToHtmlConversionMode,
  MarkdownToHtmlMetricsSummary
} from '../types/markdown-to-html.types';

export { blurActiveElement } from '../utils/csv-to-json-json-to-csv.utils';

export function computeMarkdownToHtmlMetrics(
  value: string,
  selection: string
): MarkdownToHtmlMetricsSummary {
  return {
    characters: value.length,
    lines: value.split(/\r?\n/).length,
    sizeLabel: formatCsvJsonBytes(new Blob([value]).size),
    selection
  };
}

export function buildMarkdownToHtmlLineNumbers(source: string): number[] {
  return buildLineNumberList(source);
}

export function isSupportedMarkdownToHtmlFile(fileName: string): boolean {
  const name = fileName.toLowerCase();
  return (
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    name.endsWith('.html') ||
    name.endsWith('.htm')
  );
}

export function isMarkdownFileName(fileName: string): boolean {
  const name = fileName.toLowerCase();
  return name.endsWith('.md') || name.endsWith('.markdown');
}

export function isHtmlFileName(fileName: string): boolean {
  const name = fileName.toLowerCase();
  return name.endsWith('.html') || name.endsWith('.htm');
}

export function looksLikeHtmlDocument(source: string): boolean {
  const trimmed = source.trim();
  return /^<!DOCTYPE\s+html/i.test(trimmed) || /^<[a-z][\s\S]*>/i.test(trimmed);
}

export function looksLikeMarkdownDocument(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed || looksLikeHtmlDocument(trimmed)) {
    return false;
  }
  return (
    /^#{1,6}\s+/m.test(trimmed) ||
    /^\s*[-*+]\s+/m.test(trimmed) ||
    /\[[^\]]+\]\([^)]+\)/.test(trimmed) ||
    /^```/m.test(trimmed) ||
    /^~~~/m.test(trimmed)
  );
}

export function resolveMarkdownToHtmlSuggestion(options: {
  mode: MarkdownToHtmlConversionMode;
  markdownInput: string;
  htmlInput: string;
  hasOutput: boolean;
  status: 'idle' | 'success' | 'error';
}): DcToolSuggestion | null {
  const source =
    options.mode === 'markdown-to-html' ? options.markdownInput : options.htmlInput;
  const trimmed = source.trim();

  if (!trimmed) {
    return {
      id: 'mth-empty',
      title: 'Start with a sample or upload a file',
      reason: 'Empty input often means the content still lives in another editor or format.',
      actionLabel: 'Open Markdown to PDF',
      path: '/code-file-tools/markdown-to-pdf'
    };
  }

  if (options.mode === 'markdown-to-html' && looksLikeHtmlDocument(trimmed)) {
    return {
      id: 'mth-switch-html',
      title: 'This looks like HTML',
      reason: 'Switch to HTML → Markdown to flatten markup into portable Markdown.',
      actionLabel: 'Use HTML → MD mode',
      path: '/data-converters/markdown-to-html'
    };
  }

  if (options.mode === 'html-to-markdown' && looksLikeMarkdownDocument(trimmed) && !looksLikeHtmlDocument(trimmed)) {
    return {
      id: 'mth-switch-md',
      title: 'This looks like Markdown',
      reason: 'Switch to Markdown → HTML to render headings, lists, and code blocks.',
      actionLabel: 'Use MD → HTML mode',
      path: '/data-converters/markdown-to-html'
    };
  }

  if (options.status === 'success' && options.hasOutput && options.mode === 'markdown-to-html') {
    return {
      id: 'mth-pdf',
      title: 'Export Markdown as PDF?',
      reason: 'Markdown to PDF can turn the same content into a printable document.',
      actionLabel: 'Open Markdown to PDF',
      path: '/code-file-tools/markdown-to-pdf'
    };
  }

  if (options.status === 'success' && options.hasOutput && options.mode === 'html-to-markdown') {
    return {
      id: 'mth-html-table',
      title: 'Need table-focused conversion?',
      reason: 'HTML Table to JSON extracts tabular data when tables matter more than prose.',
      actionLabel: 'Open HTML Table to JSON',
      path: '/data-converters/html-table-to-json'
    };
  }

  return null;
}

export function convertMarkdownToHtml(markdown: string, options: MarkdownToHtmlMarkdownOptions): string {
  let source = markdown.replace(/\r\n?/g, '\n');
  if (options.escapeHtml) {
    source = escapeHtml(source);
  }
  if (options.smartTypography) {
    source = applySmartTypography(source);
  }

  const codeSnippets: string[] = [];
  const fencedPattern = /```([a-z0-9]+)?\n([\s\S]*?)```|~~~([a-z0-9]+)?\n([\s\S]*?)~~~/gi;
  source = source.replace(fencedPattern, (_match, langFenceA, codeA, langFenceB, codeB) => {
    const language = (langFenceA || langFenceB || '').toString().trim();
    const codeContent = codeA ?? codeB ?? '';
    const placeholder = `{{CODE_BLOCK_${codeSnippets.length}}}`;
    codeSnippets.push(renderCodeBlock(codeContent, language));
    return placeholder;
  });

  let html = source;
  html = replaceBlockQuotes(html);
  html = replaceHeadings(html);
  html = replaceHorizontalRules(html);
  html = replaceLists(html);
  html = replaceBoldAndItalic(html);
  html = replaceLinksAndImages(html);
  html = replaceInlineCode(html);

  if (options.wrapParagraphs) {
    html = wrapParagraphs(html);
  }

  if (options.convertLineBreaks) {
    html = html.replace(/\n/g, '<br />');
  }

  for (let index = 0; index < codeSnippets.length; index += 1) {
    const placeholder = `{{CODE_BLOCK_${index}}}`;
    html = html.replace(placeholder, codeSnippets[index]);
  }

  return html.trim();
}

export function convertHtmlToMarkdown(html: string, options: MarkdownToHtmlHtmlOptions): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const buffer: string[] = [];
  renderChildrenToMarkdown(doc.body, buffer, 0, options);
  let markdown = buffer.join('\n');
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  if (options.collapseWhitespace) {
    markdown = markdown.replace(/[ \t]+\n/g, '\n');
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
  }
  return markdown.trim();
}

export function renderChildrenToMarkdown(
  parent: HTMLElement,
  out: string[],
  depth: number,
  options: MarkdownToHtmlHtmlOptions
): void {
  const nodes = Array.from(parent.childNodes);
  for (const node of nodes) {
    renderNodeToMarkdown(node, out, depth, options);
  }
}

export function renderNodeToMarkdown(
  node: Node,
  out: string[],
  depth: number,
  options: MarkdownToHtmlHtmlOptions
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeInlineText(node.textContent ?? '', options.collapseWhitespace);
    if (text.length) {
      out.push(text);
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  renderElementToMarkdown(node as HTMLElement, out, depth, options);
}

export function renderElementToMarkdown(
  element: HTMLElement,
  out: string[],
  depth: number,
  options: MarkdownToHtmlHtmlOptions
): void {
  const tag = element.tagName.toLowerCase();
  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      renderHeadingElement(element, out, options);
      break;
    case 'p':
      renderParagraphElement(element, out, options);
      break;
    case 'ul':
    case 'ol':
      renderListElement(element, out, depth, options);
      break;
    case 'li':
      // Handled by list renderer.
      break;
    case 'blockquote':
      renderBlockQuote(element, out, depth, options);
      break;
    case 'pre':
      renderPreformattedBlock(element, out, options);
      break;
    case 'br':
      out.push('  ');
      break;
    case 'hr':
      out.push('\n---\n');
      break;
    default:
      renderParagraphElement(element, out, options);
      break;
  }
}

export function renderHeadingElement(element: HTMLElement, out: string[], options: MarkdownToHtmlHtmlOptions): void {
  const level = Number(element.tagName.substring(1));
  const content = collectInlineMarkdown(element, options).trim();
  if (!content.length) {
    return;
  }

  if (options.headingStyle === 'setext' && level <= 2) {
    const underline = level === 1 ? '=' : '-';
    out.push(content);
    out.push(underline.repeat(Math.max(content.length, 3)));
    out.push('');
    return;
  }

  const hashes = '#'.repeat(Math.max(level, 1));
  out.push(`${hashes} ${content}`);
  out.push('');
}

export function renderParagraphElement(element: HTMLElement, out: string[], options: MarkdownToHtmlHtmlOptions): void {
  const content = collectInlineMarkdown(element, options).trim();
  if (!content.length) {
    return;
  }
  out.push(content);
  out.push('');
}

export function renderListElement(
  element: HTMLElement,
  out: string[],
  depth: number,
  options: MarkdownToHtmlHtmlOptions
): void {
  const isOrdered = element.tagName.toLowerCase() === 'ol';
  const listItems = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li');
  if (!listItems.length) {
    return;
  }

  let index = 1;
  for (const item of listItems) {
    const marker = isOrdered ? `${index}.` : options.bulletStyle;
    const prefix = `${'  '.repeat(depth)}${marker} `;
    const child = item as HTMLElement;
    const lines: string[] = [];
    renderParagraphElement(child, lines, options);
    const inline = lines.length ? lines[0] : collectInlineMarkdown(child, options).trim();
    out.push(`${prefix}${inline}`);

    const nestedLists = Array.from(child.children).filter((c) => {
      const name = c.tagName.toLowerCase();
      return name === 'ul' || name === 'ol';
    });

    for (const nested of nestedLists) {
      renderListElement(nested as HTMLElement, out, depth + 1, options);
    }

    if (!isOrdered && nestedLists.length === 0) {
      out.push('');
    }
    index += 1;
  }

  if (isOrdered) {
    out.push('');
  }
}

export function renderBlockQuote(
  element: HTMLElement,
  out: string[],
  depth: number,
  options: MarkdownToHtmlHtmlOptions
): void {
  const lines: string[] = [];
  renderChildrenToMarkdown(element, lines, depth, options);
  const content = lines
    .join('\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `> ${line}`);
  out.push(...content);
  out.push('');
}

export function renderPreformattedBlock(element: HTMLElement, out: string[], options: MarkdownToHtmlHtmlOptions): void {
  const codeElement = element.querySelector('code');
  const codeText = codeElement ? codeElement.textContent ?? '' : element.textContent ?? '';
  const fence = options.codeFence;
  const languageClass = codeElement?.className ?? '';
  const language = extractLanguageFromClass(languageClass);
  const header = language ? `${fence}${language}` : fence;
  out.push(header);
  out.push(codeText.replace(/\s+$/u, ''));
  out.push(fence);
  out.push('');
}

export function collectInlineMarkdown(element: HTMLElement, options: MarkdownToHtmlHtmlOptions): string {
  const fragments: string[] = [];
  const nodes = Array.from(element.childNodes);
  for (const node of nodes) {
    fragments.push(renderInlineNode(node, options));
  }
  return fragments.join('').replace(/\s+/g, (match) => (match.includes('\n') ? '\n' : ' '));
}

export function renderInlineNode(node: Node, options: MarkdownToHtmlHtmlOptions): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent ?? '';
    return normalizeInlineText(value, options.collapseWhitespace);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const content = collectInlineMarkdown(element, options);

  switch (tag) {
    case 'strong':
    case 'b':
      return content.length ? `**${content}**` : '';
    case 'em':
    case 'i':
      return content.length ? `*${content}*` : '';
    case 'code':
      return content.length ? `\`${content}\`` : '';
    case 'a':
      return renderLinkInline(element, content, options);
    case 'span':
    case 'div':
      return content;
    case 'img':
      return renderImageInline(element);
    case 'br':
      return '  \n';
    default:
      return content;
  }
}

export function renderLinkInline(element: HTMLElement, content: string, options: MarkdownToHtmlHtmlOptions): string {
  const href = element.getAttribute('href') ?? '';
  if (!options.keepLinks || !href) {
    return content;
  }
  const sanitizedHref = sanitizeUrl(href);
  return `[${content || sanitizedHref}](${sanitizedHref})`;
}

export function renderImageInline(element: HTMLElement): string {
  const src = element.getAttribute('src') ?? '';
  const alt = element.getAttribute('alt') ?? '';
  if (!src.length) {
    return alt;
  }
  const sanitizedSrc = sanitizeUrl(src);
  return `![${alt}](${sanitizedSrc})`;
}

export function replaceBlockQuotes(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let inQuote = false;
  for (const line of lines) {
    const match = line.match(/^>\s?(.*)$/);
    if (match) {
      if (!inQuote) {
        output.push('<blockquote>');
        inQuote = true;
      }
      output.push(match[1].trim());
    } else {
      if (inQuote) {
        output.push('</blockquote>');
        inQuote = false;
      }
      output.push(line);
    }
  }
  if (inQuote) {
    output.push('</blockquote>');
  }
  return output.join('\n');
}

export function replaceHeadings(markdown: string): string {
  let result = markdown;
  for (let level = 6; level >= 1; level -= 1) {
    const pattern = new RegExp(`^${'#'.repeat(level)}\\s+(.*)$`, 'gm');
    result = result.replace(pattern, (_match, heading) => `<h${level}>${heading.trim()}</h${level}>`);
  }
  return result;
}

export function replaceHorizontalRules(markdown: string): string {
  return markdown.replace(/^(?:-{3,}|\*{3,}|_{3,})$/gm, '<hr />');
}

export function replaceLists(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let currentList: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (currentList) {
      output.push(currentList === 'ul' ? '</ul>' : '</ol>');
      currentList = null;
    }
  };

  for (const rawLine of lines) {
    const unordered = rawLine.match(/^\s*([*+-])\s+(.*)$/);
    const ordered = rawLine.match(/^\s*(\d+)\.\s+(.*)$/);

    if (unordered || ordered) {
      const listType: 'ul' | 'ol' = unordered ? 'ul' : 'ol';
      if (currentList !== listType) {
        closeList();
        output.push(listType === 'ul' ? '<ul>' : '<ol>');
        currentList = listType;
      }
      const content = (unordered ? unordered[2] : ordered![2]).trim();
      output.push(`<li>${content}</li>`);
    } else {
      closeList();
      output.push(rawLine);
    }
  }

  closeList();
  return output.join('\n');
}

export function replaceBoldAndItalic(markdown: string): string {
  let result = markdown;
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  result = result.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/_(.+?)_/g, '<em>$1</em>');
  return result;
}

export function replaceLinksAndImages(markdown: string): string {
  let result = markdown;
  result = result.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_match, alt, url, title) => {
    const escapedAlt = escapeHtml(alt ?? '');
    const escapedUrl = escapeHtml(url ?? '');
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${escapedUrl}" alt="${escapedAlt}"${titleAttr} />`;
  });
  result = result.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_match, text, url, title) => {
    const escapedText = escapeHtml(text ?? '');
    const escapedUrl = escapeHtml(url ?? '');
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<a href="${escapedUrl}"${titleAttr}>${escapedText}</a>`;
  });
  return result;
}

export function replaceInlineCode(markdown: string): string {
  return markdown.replace(/`([^`\n]+)`/g, (_match, code) => `<code>${escapeHtml(code)}</code>`);
}

export function wrapParagraphs(html: string): string {
  const blocks = html.split(/\n{2,}/);
  const rendered: string[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed.length) {
      continue;
    }
    if (/^<\/?(h\d|ul|ol|li|pre|blockquote|table|img|code|hr)/i.test(trimmed)) {
      rendered.push(trimmed);
    } else {
      rendered.push(`<p>${trimmed}</p>`);
    }
  }
  return rendered.join('\n');
}

export function applySmartTypography(input: string): string {
  return input
    .replace(/\.{3}/g, '…')
    .replace(/--/g, '—')
    .replace(/\"([^\"]*)\"/g, '“$1”')
    .replace(/\'([^\']*)\'/g, '‘$1’');
}

export function renderCodeBlock(code: string, language: string): string {
  const escaped = escapeHtml(code.replace(/\n$/, ''));
  const className = language.length ? ` class="language-${language}"` : '';
  return `<pre><code${className}>${escaped}</code></pre>`;
}

export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.length) {
    return '';
  }
  if (/^(javascript:|data:)/i.test(trimmed)) {
    return '#';
  }
  return trimmed;
}

export function normalizeInlineText(value: string, collapse: boolean): string {
  if (!value.length) {
    return '';
  }
  return collapse ? value.replace(/\s+/g, ' ') : value;
}

export function extractLanguageFromClass(className: string): string {
  const match = className.match(/language-([a-z0-9+-]+)/i);
  return match ? match[1] : '';
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
