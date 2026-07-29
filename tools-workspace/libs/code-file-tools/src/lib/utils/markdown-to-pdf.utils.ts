import type { CftToolSuggestion } from '../shared/cft-tool-suggestion.model';
import {
  MARKDOWN_TO_PDF_CDN,
  MARKDOWN_TO_PDF_FILENAME
} from '../constants/markdown-to-pdf.constants';
import type { MarkdownPdfOptions } from '../types/markdown-to-pdf.types';
import { looksLikeHtmlSource } from './minifier-common.utils';

/** Regex Markdown → HTML converter (legacy behavior preserved). */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  html = html.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');

  html = html.replace(/^---$/gim, '<hr />');
  html = html.replace(/^\*\*\*$/gim, '<hr />');

  html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gim, '<li>$1</li>');
  html = html.replace(/^\+ (.+)$/gim, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gim, '<li>$2</li>');

  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    const items = match.trim();
    if (items.match(/^\d+\./)) {
      return '<ol>' + items.replace(/^\d+\. /gm, '') + '</ol>';
    }
    return '<ul>' + items + '</ul>';
  });

  html = html.replace(/\|(.+)\|/g, (match, content) => {
    const cells = content
      .split('|')
      .map((cell: string) => cell.trim())
      .filter((cell: string) => cell);
    if (cells.length === 0) return '';

    if (cells.every((cell: string) => /^:?-+:?$/.test(cell))) {
      return '';
    }

    const isHeader = html.indexOf(match) < html.indexOf('|') || html.split('|').length === 2;
    const tag = isHeader ? 'th' : 'td';
    return '<tr>' + cells.map((cell: string) => `<${tag}>${cell}</${tag}>`).join('') + '</tr>';
  });

  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');

  html = html
    .split('\n')
    .map((line) => {
      line = line.trim();
      if (!line) return '';
      if (line.match(/^<(h[1-6]|ul|ol|li|blockquote|pre|code|table|tr|td|th)/)) {
        return line;
      }
      return '<p>' + line + '</p>';
    })
    .join('\n');

  return html;
}

export function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  const blockElements = div.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, table'
  );
  blockElements.forEach((el) => {
    const text = el.textContent || '';
    el.textContent = '\n' + text + '\n';
  });

  return div.textContent || div.innerText || '';
}

export async function loadMarkdownToPdfJsPdf(): Promise<void> {
  if ((window as Window & { jspdf?: unknown }).jspdf) {
    return;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MARKDOWN_TO_PDF_CDN;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load jsPDF library'));
    document.head.appendChild(script);
  });
}

interface JsPdfLike {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  setFontSize(size: number): void;
  setTextColor(r: number, g: number, b: number): void;
  text(
    text: string | string[],
    x: number,
    y: number,
    options?: { align?: string }
  ): void;
  splitTextToSize(text: string, maxWidth: number): string[];
  addPage(): void;
  getNumberOfPages(): number;
  setPage(page: number): void;
  save(filename: string): void;
}

export async function generateMarkdownPdf(
  html: string,
  options: MarkdownPdfOptions
): Promise<void> {
  await loadMarkdownToPdfJsPdf();

  const jspdfLib = (window as Window & { jspdf?: { jsPDF: new (opts: Record<string, unknown>) => JsPdfLike } })
    .jspdf;
  if (!jspdfLib?.jsPDF) {
    throw new Error('jsPDF library not loaded');
  }

  const { jsPDF } = jspdfLib;
  const doc = new jsPDF({
    orientation: options.orientation,
    unit: 'mm',
    format: options.pageSize
  });

  const margin = options.margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;

  let y = margin + (options.includeHeader ? 20 : 0);

  if (options.includeHeader) {
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text('Markdown to PDF', margin, margin + 10);
    y = margin + 20;
  }

  const text = htmlToPlainText(html);
  const lines = doc.splitTextToSize(text, contentWidth);

  doc.setFontSize(options.fontSize);
  doc.setTextColor(0, 0, 0);

  lines.forEach((line: string) => {
    if (y + 10 > pageHeight - margin - (options.includeFooter ? 20 : 0)) {
      doc.addPage();
      y = margin + (options.includeHeader ? 20 : 0);
    }
    doc.text(line, margin, y);
    y += 7;
  });

  if (options.includeFooter) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, {
        align: 'center'
      });
    }
  }

  doc.save(MARKDOWN_TO_PDF_FILENAME);
}

export function looksLikeMarkdownSource(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^#{1,6}\s/m.test(trimmed) ||
    /^\s*[-*+]\s+\S/m.test(trimmed) ||
    /```[\s\S]*?```/.test(trimmed) ||
    /\[[^\]]+\]\([^)]+\)/.test(trimmed) ||
    /^\|.+\|/m.test(trimmed)
  );
}

export function looksLikeHtmlOnlyDocument(text: string): boolean {
  const trimmed = text.trim();
  if (!looksLikeHtmlSource(trimmed)) {
    return false;
  }
  return !looksLikeMarkdownSource(trimmed);
}

export function resolveMarkdownToPdfSuggestion(
  input: string,
  hasHtmlOutput: boolean
): CftToolSuggestion | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      id: 'empty-md',
      title: 'Paste Markdown to export as PDF',
      reason:
        'Drop a Markdown document here, or load the sample. For live preview without PDF, try Markdown Previewer.',
      actionLabel: 'Open Markdown Previewer',
      path: '/file-viewers/markdown-previewer'
    };
  }

  if (looksLikeHtmlOnlyDocument(trimmed)) {
    return {
      id: 'html-input',
      title: 'Input looks like HTML, not Markdown',
      reason:
        'HTML markup was detected without Markdown syntax. HTML to PDF renders styled documents more accurately.',
      actionLabel: 'Open HTML to PDF',
      path: '/pdf-tools/html-to-pdf'
    };
  }

  if (hasHtmlOutput) {
    return {
      id: 'html-ready',
      title: 'Preview ready — next steps',
      reason:
        'Copy the HTML preview, refine it in Markdown to HTML, or use HTML to PDF for canvas-based rendering.',
      actionLabel: 'Open Markdown to HTML',
      path: '/data-converters/markdown-to-html'
    };
  }

  return {
    id: 'pair-preview',
    title: 'Preview Markdown while you write',
    reason:
      'Markdown Previewer offers a focused reading view. Come back here when you are ready to export PDF.',
    actionLabel: 'Open Markdown Previewer',
    path: '/file-viewers/markdown-previewer'
  };
}
