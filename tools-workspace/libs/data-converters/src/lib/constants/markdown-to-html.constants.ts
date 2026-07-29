import type { DcRelatedToolLink } from '../shared/dc-tool-suggestion.model';
import type {
  MarkdownToHtmlBulletStyleOption,
  MarkdownToHtmlCallout,
  MarkdownToHtmlHeadingStyleOption,
  MarkdownToHtmlModeOption
} from '../types/markdown-to-html.types';

export const MARKDOWN_TO_HTML_HISTORY_LIMIT = 6;

export const MARKDOWN_TO_HTML_SAMPLE_MARKDOWN = `# Welcome to the toolkit

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

export const MARKDOWN_TO_HTML_SAMPLE_HTML = `<article>
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

export const MARKDOWN_TO_HTML_MODES: ReadonlyArray<MarkdownToHtmlModeOption> = [
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

export const MARKDOWN_TO_HTML_USAGE_STEPS = [
  'Decide whether you are converting Markdown to HTML or HTML to Markdown.',
  'Paste your content or drop a file into the editor area.',
  'Adjust formatting toggles (paragraph wrapping, heading style, bullet symbols, and more).',
  'Convert, then copy or download the cleaned result for documentation or automation.'
] as const;

export const MARKDOWN_TO_HTML_CALLOUTS: ReadonlyArray<MarkdownToHtmlCallout> = [
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

export const MARKDOWN_TO_HTML_BULLET_STYLES: ReadonlyArray<MarkdownToHtmlBulletStyleOption> = [
  { value: '-', label: 'Dash (-)' },
  { value: '*', label: 'Asterisk (*)' },
  { value: '+', label: 'Plus (+)' }
];

export const MARKDOWN_TO_HTML_HEADING_STYLES: ReadonlyArray<MarkdownToHtmlHeadingStyleOption> = [
  { value: 'atx', label: 'ATX (# Heading)' },
  { value: 'setext', label: 'Setext (underlined)' }
];

export const MARKDOWN_TO_HTML_CODE_FENCES = ['```', '~~~'] as const;

export const MARKDOWN_TO_HTML_RELATED_TOOLS: ReadonlyArray<DcRelatedToolLink> = [
  {
    label: 'Markdown to PDF',
    path: '/code-file-tools/markdown-to-pdf',
    description: 'Turn Markdown into a printable PDF'
  },
  {
    label: 'HTML Table to JSON',
    path: '/data-converters/html-table-to-json',
    description: 'Extract HTML tables as JSON rows'
  },
  {
    label: 'HTML Entity Encoder',
    path: '/code-file-tools/html-entity-encoder',
    description: 'Encode or decode HTML entities'
  },
  {
    label: 'HTML Minifier',
    path: '/code-file-tools/html-minifier',
    description: 'Minify HTML output for production'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Format structured data after conversion'
  }
];
