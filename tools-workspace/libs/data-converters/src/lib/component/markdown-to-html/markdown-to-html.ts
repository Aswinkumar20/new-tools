import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationComponent } from '@tools-workspace/features-home';

type ConversionMode = 'markdown-to-html' | 'html-to-markdown';

type BulletStyle = '-' | '*' | '+';
type HeadingStyle = 'atx' | 'setext';

type CopyStatus = 'idle' | 'success' | 'error';

type ConversionState = 'idle' | 'success' | 'error';

interface HistoryEntry {
  label: string;
  timestamp: string;
}

interface ConversionStatus {
  status: ConversionState;
  message: string;
}

interface MetricsSummary {
  characters: number;
  lines: number;
  sizeLabel: string;
  selection: string;
}

interface MarkdownOptions {
  wrapParagraphs: boolean;
  convertLineBreaks: boolean;
  escapeHtml: boolean;
  smartTypography: boolean;
}

interface HtmlOptions {
  bulletStyle: BulletStyle;
  headingStyle: HeadingStyle;
  collapseWhitespace: boolean;
  keepLinks: boolean;
  codeFence: string;
}

const SAMPLE_MARKDOWN = `# Welcome to the toolkit

Convert Markdown into HTML with **minimal effort**.

## Highlights

- Supports headings, emphasis, lists, links, and code blocks.
- Toggles control how paragraphs, smart quotes, and line breaks are handled.
- Drag & drop \`.md\` files or paste directly into the editor.

> “Typography is the craft of endowing human language with a durable visual form.” — Robert Bringhurst


documentation_link: [Explore components](https://example.com/docs)


table_example:
| Feature | Status |
| ------- | ------ |
| Markdown → HTML | ✅ |
| HTML → Markdown | ✅ |


delimited_code:

author: [Ada Lovelace](https://en.wikipedia.org/wiki/Ada_Lovelace)


description:
- Convert markdown to HTML
- Convert HTML back to markdown

~~~ts
const greet = (name: string) => {
  console.log(` + '`Hello ${name}!`' + `);
};
~~~`;

const SAMPLE_HTML = `<article>
  <h1>Release Notes</h1>
  <p>Our converter now supports <strong>Markdown</strong> and <em>HTML</em> in both directions.</p>
  <h2>Highlights</h2>
  <ul>
    <li>Drag and drop <code>.md</code> or <code>.html</code> files.</li>
    <li>Toggle smart typography, whitespace trimming, and link handling.</li>
    <li>Copy or download the converted result instantly.</li>
  </ul>
  <blockquote>
    <p>The web is for everyone, and the precise format shouldn’t be a barrier.</p>
  </blockquote>
  <p>
    View the <a href="https://example.com/changelog">full changelog</a> or explore the
    <a href="https://example.com/tutorials">tutorial series</a> for power users.
  </p>
  <pre><code class="language-js">function sum(a, b) {
  return a + b;
}
</code></pre>
</article>`;

@Component({
  selector: 'lib-markdown-to-html',
  standalone: true,
  templateUrl: './markdown-to-html.html',
  styleUrls: ['./markdown-to-html.scss'],
  imports: [CommonModule, NgIf, NgFor, FormsModule, NavigationComponent]
})
export class MarkdownToHtmlComponent implements AfterViewInit {
  @ViewChild('markdownTextarea') markdownTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('htmlTextarea') htmlTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('resultsTextarea') resultsTextarea!: ElementRef<HTMLTextAreaElement>;
  readonly modes: Array<{ id: ConversionMode; label: string; description: string }> = [
    {
      id: 'markdown-to-html',
      label: 'Markdown → HTML',
      description: 'Render Markdown into semantic HTML with optional paragraph wrapping.'
    },
    {
      id: 'html-to-markdown',
      label: 'HTML → Markdown',
      description: 'Flatten HTML into portable Markdown with configurable heading and list styles.'
    }
  ];

  readonly usageSteps = [
    'Decide whether you are converting Markdown to HTML or HTML to Markdown.',
    'Paste your content or drop a file into the editor area.',
    'Adjust formatting toggles (paragraph wrapping, heading style, bullet symbols, and more).',
    'Convert, then copy or download the cleaned result for documentation or automation.'
  ];

  readonly callouts = [
    {
      title: 'Live preview',
      detail: 'Instantly render Markdown to HTML with code blocks and typographic enhancements.'
    },
    {
      title: 'Smart reverse',
      detail: 'Tame HTML into Markdown with custom heading and list conventions.'
    },
    {
      title: 'Shareable output',
      detail: 'Copy to clipboard or download the result for your CMS or knowledge base.'
    }
  ];

  readonly bulletStyles: Array<{ value: BulletStyle; label: string }> = [
    { value: '-', label: 'Dash (-)' },
    { value: '*', label: 'Asterisk (*)' },
    { value: '+', label: 'Plus (+)' }
  ];

  readonly headingStyles: Array<{ value: HeadingStyle; label: string }> = [
    { value: 'atx', label: 'ATX (# Heading)' },
    { value: 'setext', label: 'Setext (underlined)' }
  ];

  readonly codeFences: string[] = ['```', '~~~'];

  conversionMode: ConversionMode = 'markdown-to-html';

  markdownInput = '';
  htmlInput = '';
  resultOutput = '';

  markdownWrapParagraphs = true;
  markdownConvertLineBreaks = false;
  markdownEscapeHtml = true;
  markdownSmartTypography = false;

  htmlBulletStyle: BulletStyle = '-';
  htmlHeadingStyle: HeadingStyle = 'atx';
  htmlCollapseWhitespace = true;
  htmlKeepLinks = true;
  htmlCodeFence = '```';

  conversionStatus: ConversionStatus = {
    status: 'idle',
    message: 'Load the sample content or paste your own Markdown/HTML to get started.'
  };

  metrics: MetricsSummary = {
    characters: 0,
    lines: 0,
    sizeLabel: '0 B',
    selection: 'Markdown'
  };

  operationHistory: HistoryEntry[] = [];
  copyStatus: CopyStatus = 'idle';
  isDragOver = false;
  editorLines: number[] = [];
  resultLines: number[] = [];

  constructor() {
    this.loadSample();
  }

  ngAfterViewInit(): void {
    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
  }

  get selectionDescription(): string | undefined {
    return this.modes.find((mode) => mode.id === this.conversionMode)?.description;
  }

  onMarkdownInputChange(value: string): void {
    this.markdownInput = value;
    this.updateEditorLineNumbers();
    this.updateMetrics(value, 'Markdown');
    if (this.conversionMode === 'markdown-to-html') {
      this.conversionStatus = {
        status: 'idle',
        message: 'Markdown ready. Configure options and convert when you are satisfied.'
      };
    }
  }

  onHtmlInputChange(value: string): void {
    this.htmlInput = value;
    this.updateEditorLineNumbers();
    this.updateMetrics(value, 'HTML');
    if (this.conversionMode === 'html-to-markdown') {
      this.conversionStatus = {
        status: 'idle',
        message: 'HTML ready. Adjust markdown output settings before converting.'
      };
    }
  }

  onEditorScroll(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = document.querySelector('.editor-line-numbers') as HTMLElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  }

  onResultsScroll(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = document.querySelector('.results-output__line-numbers') as HTMLElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  }

  convert(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (this.conversionMode === 'markdown-to-html') {
      this.convertMarkdownPipeline();
    } else {
      this.convertHtmlPipeline();
    }
  }

  resetWorkspace(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.loadSample();
  }

  trackByHistory = (_index: number, entry: HistoryEntry): string =>
    `${entry.label}-${entry.timestamp}`;

  async copyResult(): Promise<void> {
    if (!this.resultOutput.trim()) {
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
      return;
    }

    try {
      const navigatorRef = (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;
      if (!navigatorRef?.clipboard?.writeText) {
        this.copyStatus = 'error';
        setTimeout(() => (this.copyStatus = 'idle'), 1500);
        return;
      }
      await navigatorRef.clipboard.writeText(this.resultOutput);
      this.copyStatus = 'success';
      this.recordHistory('Copied converted output');
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
    } catch (error) {
      console.warn('Unable to copy to clipboard', error);
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
    }
  }

  downloadResult(): void {
    if (!this.resultOutput.trim()) {
      return;
    }

    const isMarkdown = this.conversionMode === 'html-to-markdown';
    const extension = isMarkdown ? 'md' : 'html';
    const mime = isMarkdown ? 'text/markdown' : 'text/html';
    const blob = new Blob([this.resultOutput], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date()
      .toISOString()
      .split(':')
      .join('-')
      .split('.')
      .join('-');

    const link = document.createElement('a');
    link.href = url;
    link.download = `converted-${timestamp}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    this.recordHistory(`Downloaded ${extension.toUpperCase()} result`);
  }

  onSelectionModeChange(mode: ConversionMode): void {
    if (this.conversionMode === mode) {
      return;
    }

    // Remove focus from dropdown to prevent tooltip persistence
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.conversionMode = mode;
    this.resultOutput = '';
    this.updateResultLineNumbers();

    // Reset all options to defaults when switching modes
    if (mode === 'markdown-to-html') {
      this.markdownWrapParagraphs = true;
      this.markdownConvertLineBreaks = false;
      this.markdownEscapeHtml = true;
      this.markdownSmartTypography = false;
      this.updateMetrics(this.markdownInput, 'Markdown');
      this.conversionStatus = {
        status: 'idle',
        message: 'Mode switched to Markdown → HTML. Paste or load Markdown content before converting.'
      };
    } else {
      this.htmlBulletStyle = '-';
      this.htmlHeadingStyle = 'atx';
      this.htmlCollapseWhitespace = true;
      this.htmlKeepLinks = true;
      this.htmlCodeFence = '```';
      this.updateMetrics(this.htmlInput, 'HTML');
      this.conversionStatus = {
        status: 'idle',
        message: 'Mode switched to HTML → Markdown. Paste or load HTML content before converting.'
      };
    }

    this.updateEditorLineNumbers();
  }

  toggleWrapParagraphs(): void {
    this.markdownWrapParagraphs = !this.markdownWrapParagraphs;
  }

  toggleConvertLineBreaks(): void {
    this.markdownConvertLineBreaks = !this.markdownConvertLineBreaks;
  }

  toggleEscapeHtml(): void {
    this.markdownEscapeHtml = !this.markdownEscapeHtml;
  }

  toggleSmartTypography(): void {
    this.markdownSmartTypography = !this.markdownSmartTypography;
  }

  toggleCollapseWhitespace(): void {
    this.htmlCollapseWhitespace = !this.htmlCollapseWhitespace;
  }

  toggleKeepLinks(): void {
    this.htmlKeepLinks = !this.htmlKeepLinks;
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.readFile(file);
    input.value = '';
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    this.readFile(file);
  }

  private convertMarkdownPipeline(): void {
    if (!this.markdownInput.trim()) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste Markdown or load a sample before converting to HTML. The input field is empty.'
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    const options: MarkdownOptions = {
      wrapParagraphs: this.markdownWrapParagraphs,
      convertLineBreaks: this.markdownConvertLineBreaks,
      escapeHtml: this.markdownEscapeHtml,
      smartTypography: this.markdownSmartTypography
    };

    try {
      const html = this.convertMarkdownToHtml(this.markdownInput, options);
      
      if (!html || !html.trim()) {
        this.conversionStatus = {
          status: 'error',
          message: 'Conversion produced empty output. Please check your Markdown content and try again.'
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
        return;
      }

      this.resultOutput = html;
      this.updateResultLineNumbers();
      this.updateMetrics(html, 'HTML');
      this.conversionStatus = {
        status: 'success',
        message: `Markdown rendered to HTML (${this.metrics.lines} lines).`
      };
      this.recordHistory('Converted Markdown to HTML');
    } catch (error) {
      console.error('Markdown conversion failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.conversionStatus = {
        status: 'error',
        message: `Markdown conversion failed: ${errorMessage}. Please check your Markdown syntax and try again.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
    }
  }

  private convertHtmlPipeline(): void {
    if (!this.htmlInput.trim()) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste HTML or load a sample before converting to Markdown. The input field is empty.'
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    const options: HtmlOptions = {
      bulletStyle: this.htmlBulletStyle,
      headingStyle: this.htmlHeadingStyle,
      collapseWhitespace: this.htmlCollapseWhitespace,
      keepLinks: this.htmlKeepLinks,
      codeFence: this.htmlCodeFence
    };

    try {
      // Validate HTML before conversion
      const parser = new DOMParser();
      const doc = parser.parseFromString(this.htmlInput, 'text/html');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        this.conversionStatus = {
          status: 'error',
          message: 'Invalid HTML format. The HTML could not be parsed. Please check your HTML syntax and try again.'
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
        return;
      }

      const markdown = this.convertHtmlToMarkdown(this.htmlInput, options);
      
      if (!markdown || !markdown.trim()) {
        this.conversionStatus = {
          status: 'error',
          message: 'Conversion produced empty output. Please check your HTML content and try again.'
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
        return;
      }

      this.resultOutput = markdown;
      this.updateResultLineNumbers();
      this.updateMetrics(markdown, 'Markdown');
      this.conversionStatus = {
        status: 'success',
        message: `HTML flattened to Markdown (${this.metrics.lines} lines).`
      };
      this.recordHistory('Converted HTML to Markdown');
    } catch (error) {
      console.error('HTML conversion failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.conversionStatus = {
        status: 'error',
        message: `HTML conversion failed: ${errorMessage}. Please ensure your HTML contains valid markup and try again.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
    }
  }

  private convertMarkdownToHtml(markdown: string, options: MarkdownOptions): string {
    let source = markdown.replace(/\r\n?/g, '\n');
    if (options.escapeHtml) {
      source = this.escapeHtml(source);
    }
    if (options.smartTypography) {
      source = this.applySmartTypography(source);
    }

    const codeSnippets: string[] = [];
    const fencedPattern = /```([a-z0-9]+)?\n([\s\S]*?)```|~~~([a-z0-9]+)?\n([\s\S]*?)~~~/gi;
    source = source.replace(fencedPattern, (_match, langFenceA, codeA, langFenceB, codeB) => {
      const language = (langFenceA || langFenceB || '').toString().trim();
      const codeContent = codeA ?? codeB ?? '';
      const placeholder = `{{CODE_BLOCK_${codeSnippets.length}}}`;
      codeSnippets.push(this.renderCodeBlock(codeContent, language));
      return placeholder;
    });

    let html = source;
    html = this.replaceBlockQuotes(html);
    html = this.replaceHeadings(html);
    html = this.replaceHorizontalRules(html);
    html = this.replaceLists(html);
    html = this.replaceBoldAndItalic(html);
    html = this.replaceLinksAndImages(html);
    html = this.replaceInlineCode(html);

    if (options.wrapParagraphs) {
      html = this.wrapParagraphs(html);
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

  private convertHtmlToMarkdown(html: string, options: HtmlOptions): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const buffer: string[] = [];
    this.renderChildrenToMarkdown(doc.body, buffer, 0, options);
    let markdown = buffer.join('\n');
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    if (options.collapseWhitespace) {
      markdown = markdown.replace(/[ \t]+\n/g, '\n');
      markdown = markdown.replace(/\n{3,}/g, '\n\n');
    }
    return markdown.trim();
  }

  private renderChildrenToMarkdown(
    parent: HTMLElement,
    out: string[],
    depth: number,
    options: HtmlOptions
  ): void {
    const nodes = Array.from(parent.childNodes);
    for (const node of nodes) {
      this.renderNodeToMarkdown(node, out, depth, options);
    }
  }

  private renderNodeToMarkdown(
    node: Node,
    out: string[],
    depth: number,
    options: HtmlOptions
  ): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = this.normalizeInlineText(node.textContent ?? '', options.collapseWhitespace);
      if (text.length) {
        out.push(text);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    this.renderElementToMarkdown(node as HTMLElement, out, depth, options);
  }

  private renderElementToMarkdown(
    element: HTMLElement,
    out: string[],
    depth: number,
    options: HtmlOptions
  ): void {
    const tag = element.tagName.toLowerCase();
    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        this.renderHeadingElement(element, out, options);
        break;
      case 'p':
        this.renderParagraphElement(element, out, options);
        break;
      case 'ul':
      case 'ol':
        this.renderListElement(element, out, depth, options);
        break;
      case 'li':
        // Handled by list renderer.
        break;
      case 'blockquote':
        this.renderBlockQuote(element, out, depth, options);
        break;
      case 'pre':
        this.renderPreformattedBlock(element, out, options);
        break;
      case 'br':
        out.push('  ');
        break;
      case 'hr':
        out.push('\n---\n');
        break;
      default:
        this.renderParagraphElement(element, out, options);
        break;
    }
  }

  private renderHeadingElement(element: HTMLElement, out: string[], options: HtmlOptions): void {
    const level = Number(element.tagName.substring(1));
    const content = this.collectInlineMarkdown(element, options).trim();
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

  private renderParagraphElement(element: HTMLElement, out: string[], options: HtmlOptions): void {
    const content = this.collectInlineMarkdown(element, options).trim();
    if (!content.length) {
      return;
    }
    out.push(content);
    out.push('');
  }

  private renderListElement(
    element: HTMLElement,
    out: string[],
    depth: number,
    options: HtmlOptions
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
      this.renderParagraphElement(child, lines, options);
      const inline = lines.length ? lines[0] : this.collectInlineMarkdown(child, options).trim();
      out.push(`${prefix}${inline}`);

      const nestedLists = Array.from(child.children).filter((c) => {
        const name = c.tagName.toLowerCase();
        return name === 'ul' || name === 'ol';
      });

      for (const nested of nestedLists) {
        this.renderListElement(nested as HTMLElement, out, depth + 1, options);
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

  private renderBlockQuote(
    element: HTMLElement,
    out: string[],
    depth: number,
    options: HtmlOptions
  ): void {
    const lines: string[] = [];
    this.renderChildrenToMarkdown(element, lines, depth, options);
    const content = lines
      .join('\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => `> ${line}`);
    out.push(...content);
    out.push('');
  }

  private renderPreformattedBlock(element: HTMLElement, out: string[], options: HtmlOptions): void {
    const codeElement = element.querySelector('code');
    const codeText = codeElement ? codeElement.textContent ?? '' : element.textContent ?? '';
    const fence = options.codeFence;
    const languageClass = codeElement?.className ?? '';
    const language = this.extractLanguageFromClass(languageClass);
    const header = language ? `${fence}${language}` : fence;
    out.push(header);
    out.push(codeText.replace(/\s+$/u, ''));
    out.push(fence);
    out.push('');
  }

  private collectInlineMarkdown(element: HTMLElement, options: HtmlOptions): string {
    const fragments: string[] = [];
    const nodes = Array.from(element.childNodes);
    for (const node of nodes) {
      fragments.push(this.renderInlineNode(node, options));
    }
    return fragments.join('').replace(/\s+/g, (match) => (match.includes('\n') ? '\n' : ' '));
  }

  private renderInlineNode(node: Node, options: HtmlOptions): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? '';
      return this.normalizeInlineText(value, options.collapseWhitespace);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    const content = this.collectInlineMarkdown(element, options);

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
        return this.renderLinkInline(element, content, options);
      case 'span':
      case 'div':
        return content;
      case 'img':
        return this.renderImageInline(element);
      case 'br':
        return '  \n';
      default:
        return content;
    }
  }

  private renderLinkInline(element: HTMLElement, content: string, options: HtmlOptions): string {
    const href = element.getAttribute('href') ?? '';
    if (!options.keepLinks || !href) {
      return content;
    }
    const sanitizedHref = this.sanitizeUrl(href);
    return `[${content || sanitizedHref}](${sanitizedHref})`;
  }

  private renderImageInline(element: HTMLElement): string {
    const src = element.getAttribute('src') ?? '';
    const alt = element.getAttribute('alt') ?? '';
    if (!src.length) {
      return alt;
    }
    const sanitizedSrc = this.sanitizeUrl(src);
    return `![${alt}](${sanitizedSrc})`;
  }

  private replaceBlockQuotes(markdown: string): string {
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

  private replaceHeadings(markdown: string): string {
    let result = markdown;
    for (let level = 6; level >= 1; level -= 1) {
      const pattern = new RegExp(`^${'#'.repeat(level)}\\s+(.*)$`, 'gm');
      result = result.replace(pattern, (_match, heading) => `<h${level}>${heading.trim()}</h${level}>`);
    }
    return result;
  }

  private replaceHorizontalRules(markdown: string): string {
    return markdown.replace(/^(?:-{3,}|\*{3,}|_{3,})$/gm, '<hr />');
  }

  private replaceLists(markdown: string): string {
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

  private replaceBoldAndItalic(markdown: string): string {
    let result = markdown;
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    result = result.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/_(.+?)_/g, '<em>$1</em>');
    return result;
  }

  private replaceLinksAndImages(markdown: string): string {
    let result = markdown;
    result = result.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_match, alt, url, title) => {
      const escapedAlt = this.escapeHtml(alt ?? '');
      const escapedUrl = this.escapeHtml(url ?? '');
      const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : '';
      return `<img src="${escapedUrl}" alt="${escapedAlt}"${titleAttr} />`;
    });
    result = result.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_match, text, url, title) => {
      const escapedText = this.escapeHtml(text ?? '');
      const escapedUrl = this.escapeHtml(url ?? '');
      const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : '';
      return `<a href="${escapedUrl}"${titleAttr}>${escapedText}</a>`;
    });
    return result;
  }

  private replaceInlineCode(markdown: string): string {
    return markdown.replace(/`([^`\n]+)`/g, (_match, code) => `<code>${this.escapeHtml(code)}</code>`);
  }

  private wrapParagraphs(html: string): string {
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

  private applySmartTypography(input: string): string {
    return input
      .replace(/\.{3}/g, '…')
      .replace(/--/g, '—')
      .replace(/\"([^\"]*)\"/g, '“$1”')
      .replace(/\'([^\']*)\'/g, '‘$1’');
  }

  private renderCodeBlock(code: string, language: string): string {
    const escaped = this.escapeHtml(code.replace(/\n$/, ''));
    const className = language.length ? ` class="language-${language}"` : '';
    return `<pre><code${className}>${escaped}</code></pre>`;
  }

  private sanitizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed.length) {
      return '';
    }
    if (/^(javascript:|data:)/i.test(trimmed)) {
      return '#';
    }
    return trimmed;
  }

  private normalizeInlineText(value: string, collapse: boolean): string {
    if (!value.length) {
      return '';
    }
    return collapse ? value.replace(/\s+/g, ' ') : value;
  }

  private extractLanguageFromClass(className: string): string {
    const match = className.match(/language-([a-z0-9+-]+)/i);
    return match ? match[1] : '';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private updateMetrics(value: string, selection: string): void {
    const characters = value.length;
    const lines = value.split(/\r?\n/).length;
    const sizeLabel = this.formatBytes(new Blob([value]).size);
    this.metrics = { characters, lines, sizeLabel, selection };
  }

  private readFile(file: File): void {
    const name = file.name.toLowerCase();
    
    // Validate file type
    if (!name.endsWith('.md') && !name.endsWith('.markdown') && !name.endsWith('.html') && !name.endsWith('.htm')) {
      this.conversionStatus = {
        status: 'error',
        message: `Unsupported file type: ${file.name.split('.').pop() || 'unknown'}. Please upload .md, .markdown, .html, or .htm files.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    file
      .text()
      .then((text) => {
        if (!text || !text.trim()) {
          this.conversionStatus = {
            status: 'error',
            message: `The file ${file.name} appears to be empty. Please upload a file with content.`
          };
          this.resultOutput = '';
          this.updateResultLineNumbers();
          return;
        }

        if (name.endsWith('.md') || name.endsWith('.markdown')) {
          this.conversionMode = 'markdown-to-html';
          this.markdownInput = text;
          this.onMarkdownInputChange(text);
          this.conversionStatus = {
            status: 'idle',
            message: `Loaded Markdown file (${file.name}). Configure HTML options and convert when ready.`
          };
        } else if (name.endsWith('.html') || name.endsWith('.htm')) {
          this.conversionMode = 'html-to-markdown';
          this.htmlInput = text;
          this.onHtmlInputChange(text);
          this.conversionStatus = {
            status: 'idle',
            message: `Loaded HTML file (${file.name}). Configure Markdown options and convert when ready.`
          };
        }
      })
      .catch((error) => {
        console.error('File read error', error);
        this.conversionStatus = {
          status: 'error',
          message: `Could not read the file ${file.name}. Please check file permissions and try again.`
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
      });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  }

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(0, 6);
  }

  private loadSample(): void {
    this.markdownInput = SAMPLE_MARKDOWN;
    this.htmlInput = SAMPLE_HTML;
    this.resultOutput = '';
    this.conversionMode = 'markdown-to-html';
    
    // Reset all options to defaults
    this.markdownWrapParagraphs = true;
    this.markdownConvertLineBreaks = false;
    this.markdownEscapeHtml = true;
    this.markdownSmartTypography = false;
    this.htmlBulletStyle = '-';
    this.htmlHeadingStyle = 'atx';
    this.htmlCollapseWhitespace = true;
    this.htmlKeepLinks = true;
    this.htmlCodeFence = '```';
    
    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
    this.updateMetrics(this.markdownInput, 'Markdown');
    this.conversionStatus = {
      status: 'idle',
      message: 'Sample Markdown loaded. Adjust options and convert when ready.'
    };
    this.operationHistory = [];
    this.copyStatus = 'idle';
  }

  private updateEditorLineNumbers(): void {
    const content = this.conversionMode === 'markdown-to-html' ? this.markdownInput : this.htmlInput;
    const lines = content.split(/\r?\n/).length;
    this.editorLines = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }

  private updateResultLineNumbers(): void {
    const lines = this.resultOutput.split(/\r?\n/).length;
    this.resultLines = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }
}
