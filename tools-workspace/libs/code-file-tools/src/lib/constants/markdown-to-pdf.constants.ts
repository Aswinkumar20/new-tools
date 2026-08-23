import type { CftRelatedToolLink } from '../shared/cft-tool-suggestion.model';
import type { MarkdownPdfOptions } from '../types/markdown-to-pdf.types';

export const MARKDOWN_TO_PDF_FILENAME = 'markdown-document.pdf';

export const MARKDOWN_TO_PDF_SAMPLE = `# Document Title

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

export const MARKDOWN_TO_PDF_DEFAULT_OPTIONS: MarkdownPdfOptions = {
  pageSize: 'a4',
  orientation: 'portrait',
  margin: 20,
  fontSize: 12,
  includeHeader: true,
  includeFooter: true
};

export const MARKDOWN_TO_PDF_RELATED_TOOLS: ReadonlyArray<CftRelatedToolLink> = [
  {
    label: 'Markdown to HTML',
    path: '/data-converters/markdown-to-html',
    description: 'Convert Markdown to HTML without PDF export'
  },
  {
    label: 'Markdown Previewer',
    path: '/file-viewers/markdown-previewer',
    description: 'Live-preview Markdown documents'
  },
  {
    label: 'HTML to PDF',
    path: '/pdf-tools/html-to-pdf',
    description: 'Export styled HTML with richer PDF rendering'
  },
  {
    label: 'Tables to PDF',
    path: '/pdf-tools/tables-to-pdf',
    description: 'Build printable tables directly'
  },
  {
    label: 'HTML Table Exporter',
    path: '/code-file-tools/html-table-exporter',
    description: 'Export Markdown tables to CSV/JSON first'
  }
];
