import { ChangeDetectionStrategy, Component, WritableSignal, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

interface PdfOptions {
  pageSize: 'a4' | 'letter' | 'legal';
  orientation: 'portrait' | 'landscape';
  margin: number;
  fontSize: number;
  includeHeader: boolean;
  includeFooter: boolean;
}

const SAMPLE_MARKDOWN = `# Document Title

This is a sample Markdown document that will be converted to PDF.

## Introduction

Markdown is a lightweight markup language that you can use to add formatting elements to plaintext text documents.

### Features

- **Bold text** and *italic text*
- Lists and code blocks
- Links and images
- Tables and more

## Code Example

\`\`\`javascript
function greet(name) {
    console.log('Hello, ' + name + '!');
}

greet('World');
\`\`\`

## Table Example

| Feature | Status |
|---------|--------|
| Markdown | ✅ |
| PDF Export | ✅ |
| Custom Styling | ✅ |

> This is a blockquote example.

## Conclusion

Convert your Markdown documents to PDF with ease!`;

@Component({
  selector: 'lib-markdown-to-pdf',
  standalone: true,
  templateUrl: './markdown-to-pdf.html',
  styleUrls: ['./markdown-to-pdf.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarkdownToPdfComponent {
  readonly markdownInput = signal<string>(SAMPLE_MARKDOWN);
  readonly htmlOutput = signal<string>('');
  readonly errors = signal<string[]>([]);
  readonly isGenerating = signal<boolean>(false);
  readonly pdfOptions = signal<PdfOptions>({
    pageSize: 'a4',
    orientation: 'portrait',
    margin: 20,
    fontSize: 12,
    includeHeader: true,
    includeFooter: true
  });

  readonly hasContent = computed(() => this.markdownInput().trim().length > 0);
  readonly hasHtmlOutput = computed(() => this.htmlOutput().length > 0);
  readonly Number = Number;

  constructor() {
    // Initial conversion
    this.convertMarkdown();
  }

  onInputChange(value: string): void {
    this.markdownInput.set(value);
    this.convertMarkdown();
  }

  convertMarkdown(): void {
    this.errors.set([]);
    const markdown = this.markdownInput().trim();

    if (!markdown) {
      this.htmlOutput.set('');
      return;
    }

    try {
      const html = this.markdownToHtml(markdown);
      this.htmlOutput.set(html);
    } catch (error) {
      this.errors.set([`Conversion failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.htmlOutput.set('');
    }
  }

  private markdownToHtml(markdown: string): string {
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

    // Blockquotes
    html = html.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^---$/gim, '<hr />');
    html = html.replace(/^\*\*\*$/gim, '<hr />');

    // Lists
    html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
    html = html.replace(/^- (.+)$/gim, '<li>$1</li>');
    html = html.replace(/^\+ (.+)$/gim, '<li>$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gim, '<li>$2</li>');

    // Wrap consecutive list items in ul/ol
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      const items = match.trim();
      if (items.match(/^\d+\./)) {
        return '<ol>' + items.replace(/^\d+\. /gm, '') + '</ol>';
      }
      return '<ul>' + items + '</ul>';
    });

    // Tables
    html = html.replace(/\|(.+)\|/g, (match, content) => {
      const cells = content.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell);
      if (cells.length === 0) return '';
      
      // Check if it's a header separator
      if (cells.every((cell: string) => /^:?-+:?$/.test(cell))) {
        return '';
      }
      
      const isHeader = html.indexOf(match) < html.indexOf('|') || html.split('|').length === 2;
      const tag = isHeader ? 'th' : 'td';
      return '<tr>' + cells.map((cell: string) => `<${tag}>${cell}</${tag}>`).join('') + '</tr>';
    });

    // Wrap table rows in table
    html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');

    // Paragraphs (lines that don't start with HTML tags)
    html = html.split('\n').map((line) => {
      line = line.trim();
      if (!line) return '';
      if (line.match(/^<(h[1-6]|ul|ol|li|blockquote|pre|code|table|tr|td|th)/)) {
        return line;
      }
      return '<p>' + line + '</p>';
    }).join('\n');

    return html;
  }

  async generatePdf(): Promise<void> {
    this.errors.set([]);
    this.isGenerating.set(true);

    try {
      const html = this.htmlOutput();
      if (!html) {
        this.errors.set(['No HTML content to convert. Please convert Markdown first.']);
        this.isGenerating.set(false);
        return;
      }

      // Load jsPDF dynamically
      await this.loadJsPdf();

      // Access jsPDF from window
      const jspdfLib = (window as any).jspdf;
      if (!jspdfLib || !jspdfLib.jsPDF) {
        throw new Error('jsPDF library not loaded');
      }

      const { jsPDF } = jspdfLib;
      const options = this.pdfOptions();

      // Create PDF document
      const doc = new jsPDF({
        orientation: options.orientation,
        unit: 'mm',
        format: options.pageSize
      });

      // Set margins
      const margin = options.margin;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2) - (options.includeHeader ? 20 : 0) - (options.includeFooter ? 20 : 0);

      let y = margin + (options.includeHeader ? 20 : 0);

      // Add header if enabled
      if (options.includeHeader) {
        doc.setFontSize(10);
        doc.setTextColor(128, 128, 128);
        doc.text('Markdown to PDF', margin, margin + 10);
        y = margin + 20;
      }

      // Convert HTML to text for PDF (simplified - for full HTML support, use html2pdf.js)
      const text = this.htmlToText(html);
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

      // Add footer if enabled
      if (options.includeFooter) {
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(10);
          doc.setTextColor(128, 128, 128);
          doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
      }

      // Save PDF
      doc.save('markdown-document.pdf');
    } catch (error) {
      this.errors.set([`PDF generation failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
    } finally {
      this.isGenerating.set(false);
    }
  }

  private htmlToText(html: string): string {
    // Create a temporary div to extract text
    const div = document.createElement('div');
    div.innerHTML = html;
    
    // Replace block elements with newlines
    const blockElements = div.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, table');
    blockElements.forEach((el) => {
      const text = el.textContent || '';
      el.textContent = '\n' + text + '\n';
    });

    return div.textContent || div.innerText || '';
  }

  private async loadJsPdf(): Promise<void> {
    if ((window as any).jspdf) {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load jsPDF library'));
      document.head.appendChild(script);
    });
  }

  updateOption<K extends keyof PdfOptions>(key: K, value: PdfOptions[K]): void {
    this.pdfOptions.update((options) => ({
      ...options,
      [key]: value
    }));
  }

  loadSample(): void {
    this.markdownInput.set(SAMPLE_MARKDOWN);
    this.convertMarkdown();
  }

  clear(): void {
    this.markdownInput.set('');
    this.htmlOutput.set('');
    this.errors.set([]);
  }

  copyHtml(): void {
    const html = this.htmlOutput();
    if (html) {
      navigator.clipboard
        .writeText(html)
        .then(() => {
          // Success
        })
        .catch(() => {
          this.errors.set(['Unable to copy HTML to clipboard.']);
        });
    }
  }

  formatBytes(value: number): string {
    if (value === 0) {
      return '0 B';
    }
    const UNITS = ['B', 'KB', 'MB'];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), UNITS.length - 1);
    const scaled = value / Math.pow(1024, exponent);
    return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
  }
}
