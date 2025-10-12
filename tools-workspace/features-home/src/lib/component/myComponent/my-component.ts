import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Navigation } from '../navigation/navigation';


@Component({
  selector: 'lib-my-component',
  standalone: true,
  templateUrl: './my-component.html',
  styleUrl: './my-component.scss',
  imports: [CommonModule, FormsModule, Navigation]
})
export class MyComponent {
  title = 'My Component';
  toolCategories = [
    {
      name: 'Text & Utilities',
      description: 'Tools for text manipulation and utilities',
      icon: 'text_fields',
      path: 'text-utilities',
      subCategories: [
        { name: 'Word & Character Counter', path: '/text-utilities/character-counter' },
        { name: 'text-case-convertor', path: 'text-utilities/text-case-convertor' },
        { name: 'text-to-ascii', path: 'text-utilities/text-to-ascii' },
        { name: 'remove-duplicate-lines', path: 'text-utilities/remove-duplicate-lines' },
        { name: 'text-reversal-and-palindrome-checker', path: 'text-utilities/text-reversal-and-palindrome-checker' },
        { name: 'base64-encode-and-decode', path: 'text-utilities/base64-encode-and-decode' },
        { name: 'slug-generator', path: 'text-utilities/slug-generator' },
        { name: 'text-difference', path: 'text-utilities/text-difference' },
        { name: 'code-merge', path: 'text-utilities/code-merge' },
        { name: 'text-file-viewer', path: 'text-utilities/text-file-viewer' }
      ]
    },
    {
      name: 'JSON / Data Converters',
      description: 'Tools to convert, format, and validate JSON and data formats',
      icon: 'data_object',
      path: 'data-converters',
      subCategories: [
        { name: 'json-formatter-beautifier-validator', path: 'data-converters/json-formatter-beautifier-validator' },
        { name: 'csv-to-json-json-to-csv', path: 'data-converters/csv-to-json-json-to-csv' },
        { name: 'yaml-to-json-json-to-yaml', path: 'data-converters/yaml-to-json-json-to-yaml' },
        { name: 'html-table-to-json', path: 'data-converters/html-table-to-json' },
        { name: 'markdown-to-html', path: 'data-converters/markdown-to-html' },
        { name: 'json-linter-viewer', path: 'data-converters/json-linter-viewer' },
        { name: 'excel-to-json', path: 'data-converters/excel-to-json' }
      ]
    },
    {
      name: 'Number & Date Tools',
      description: 'Calculators, converters, and date utilities',
      icon: 'calculate',
      path: 'math-date-utils',
      subCategories: [
        { name: 'unit-converter', path: 'math-date-utils/unit-converter' },
        { name: 'number-to-words', path: 'math-date-utils/number-to-words' },
        { name: 'percentage-calculator', path: 'math-date-utils/percentage-calculator' },
        { name: 'age-calculator', path: 'math-date-utils/age-calculator' },
        { name: 'date-difference-calculator', path: 'math-date-utils/date-difference-calculator' },
        { name: 'simple-compound-interest-calculator', path: 'math-date-utils/simple-compound-interest-calculator' },
        { name: 'bmi-calculator', path: 'math-date-utils/bmi-calculator' },
        { name: 'loan-emi-calculator', path: 'math-date-utils/loan-emi-calculator' },
        { name: 'tip-calculator', path: 'math-date-utils/tip-calculator' },
        { name: 'currency-converter', path: 'math-date-utils/currency-converter' },
        { name: 'fraction-calculator', path: 'math-date-utils/fraction-calculator' },
        { name: 'date-to-day-of-week', path: 'math-date-utils/date-to-day-of-week' },
        { name: 'zodiac-finder', path: 'math-date-utils/zodiac-finder' }
      ]
    },
    {
      name: 'PDF Tools',
      description: 'View, edit, generate, and secure PDFs',
      icon: 'picture_as_pdf',
      path: 'pdf-tools',
      subCategories: [
        { name: 'pdf-viewer', path: 'pdf-tools/pdf-viewer' },
        { name: 'merge-pdfs', path: 'pdf-tools/merge-pdfs' },
        { name: 'split-pdfs', path: 'pdf-tools/split-pdfs' },
        { name: 'delete-pages', path: 'pdf-tools/delete-pages' },
        { name: 'rotate-pages', path: 'pdf-tools/rotate-pages' },
        { name: 'reorder-pages', path: 'pdf-tools/reorder-pages' },
        { name: 'extract-pages', path: 'pdf-tools/extract-pages' },
        { name: 'compress-pdf', path: 'pdf-tools/compress-pdf' },
        { name: 'create-pdf-from-html', path: 'pdf-tools/create-pdf-from-html' },
        { name: 'tables-charts-to-pdf', path: 'pdf-tools/tables-charts-to-pdf' },
        { name: 'resume-invoice-generator', path: 'pdf-tools/resume-invoice-generator' },
        { name: 'text-to-pdf', path: 'pdf-tools/text-to-pdf' },
        { name: 'screenshot-to-pdf', path: 'pdf-tools/screenshot-to-pdf' },
        { name: 'annotate-pdf', path: 'pdf-tools/annotate-pdf' },
        { name: 'highlight-text', path: 'pdf-tools/highlight-text' },
        { name: 'add-signature', path: 'pdf-tools/add-signature' },
        { name: 'fill-pdf-forms', path: 'pdf-tools/fill-pdf-forms' },
        { name: 'pdf-metadata-editor', path: 'pdf-tools/pdf-metadata-editor' },
        { name: 'add-watermark', path: 'pdf-tools/add-watermark' },
        { name: 'pdf-to-base64', path: 'pdf-tools/pdf-to-base64' },
        { name: 'password-protect-pdf', path: 'pdf-tools/password-protect-pdf' },
        { name: 'flatten-pdf-forms', path: 'pdf-tools/flatten-pdf-forms' }
      ]
    },
    {
      name: 'Image & Color Tools',
      description: 'Image manipulation and color utilities',
      icon: 'palette',
      path: 'image-color-tools',
      subCategories: [
        { name: 'image-to-base64', path: 'image-color-tools/image-to-base64' },
        { name: 'image-resizer', path: 'image-color-tools/image-resizer' },
        { name: 'image-compressor', path: 'image-color-tools/image-compressor' },
        { name: 'color-picker', path: 'image-color-tools/color-picker' },
        { name: 'hex-to-rgb', path: 'image-color-tools/hex-to-rgb' },
        { name: 'gradient-generator', path: 'image-color-tools/gradient-generator' },
        { name: 'palette-generator', path: 'image-color-tools/palette-generator' },
        { name: 'image-to-text', path: 'image-color-tools/image-to-text' },
        { name: 'favicon-generator', path: 'image-color-tools/favicon-generator' },
        { name: 'drawing-pad', path: 'image-color-tools/drawing-pad' }
      ]
    },
    {
      name: 'File & Code Tools',
      description: 'Code formatting and file utilities',
      icon: 'code',
      path: 'code-file-tools',
      subCategories: [
        { name: 'html-minifier', path: 'code-file-tools/html-minifier' },
        { name: 'css-minifier', path: 'code-file-tools/css-minifier' },
        { name: 'javascript-minifier', path: 'code-file-tools/javascript-minifier' },
        { name: 'html-entity-encoder', path: 'code-file-tools/html-entity-encoder' },
        { name: 'clipboard-viewer', path: 'code-file-tools/clipboard-viewer' },
        { name: 'clipboard-history', path: 'code-file-tools/clipboard-history' },
        { name: 'file-metadata-viewer', path: 'code-file-tools/file-metadata-viewer' },
        { name: 'markdown-to-pdf', path: 'code-file-tools/markdown-to-pdf' },
        { name: 'html-table-exporter', path: 'code-file-tools/html-table-exporter' }
      ]
    },
    {
      name: 'Design & Web Dev Tools',
      description: 'CSS tools, responsive design helpers, and web dev utilities',
      icon: 'web',
      path: 'dev-design-tools',
      subCategories: [
        { name: 'css-gradient-generator', path: 'dev-design-tools/css-gradient-generator' },
        { name: 'box-shadow-generator', path: 'dev-design-tools/box-shadow-generator' },
        { name: 'border-radius-preview', path: 'dev-design-tools/border-radius-preview' },
        { name: 'pixel-to-rem', path: 'dev-design-tools/pixel-to-rem' },
        { name: 'responsive-breakpoint-tester', path: 'dev-design-tools/responsive-breakpoint-tester' },
        { name: 'viewport-size-detector', path: 'dev-design-tools/viewport-size-detector' },
        { name: 'postman-lite', path: 'dev-design-tools/postman-lite' },
        { name: 'cors-test-tool', path: 'dev-design-tools/cors-test-tool' },
        { name: 'http-header-decoder', path: 'dev-design-tools/http-header-decoder' },
        { name: 'websocket-client', path: 'dev-design-tools/websocket-client' },
        { name: 'http-request-generator', path: 'dev-design-tools/http-request-generator' },
        { name: 'mock-json-generator', path: 'dev-design-tools/mock-json-generator' }
      ]
    },
    {
      name: 'Validation & Testing Tools',
      description: 'Validators and testing utilities',
      icon: 'rule',
      path: 'testing-tools',
      subCategories: [
        { name: 'json-schema-validator', path: 'testing-tools/json-schema-validator' },
        { name: 'password-rule-validator', path: 'testing-tools/password-rule-validator' },
        { name: 'email-url-ip-checker', path: 'testing-tools/email-url-ip-checker' },
        { name: 'user-agent-parser', path: 'testing-tools/user-agent-parser' },
        { name: 'credit-card-validator', path: 'testing-tools/credit-card-validator' },
        { name: 'jwt-decoder', path: 'testing-tools/jwt-decoder' }
      ]
    },
    {
      name: 'Security & Crypto Tools',
      description: 'Hashing, encryption, and secure utilities',
      icon: 'lock',
      path: 'security-tools',
      subCategories: [
        { name: 'hash-generator', path: 'security-tools/hash-generator' },
        { name: 'uuid-generator', path: 'security-tools/uuid-generator' },
        { name: 'password-strength-checker', path: 'security-tools/password-strength-checker' },
        { name: 'random-password-generator', path: 'security-tools/random-password-generator' },
        { name: 'text-encrypt-decrypt', path: 'security-tools/text-encrypt-decrypt' },
        { name: 'secure-clipboard', path: 'security-tools/secure-clipboard' },
        { name: 'private-notes', path: 'security-tools/private-notes' }
      ]
    },
    {
      name: 'Media & Audio Tools',
      description: 'Audio, video, and media utilities',
      icon: 'music_note',
      path: 'media-tools',
      subCategories: [
        { name: 'voice-recorder', path: 'media-tools/voice-recorder' },
        { name: 'audio-player', path: 'media-tools/audio-player' },
        { name: 'audio-trimmer', path: 'media-tools/audio-trimmer' },
        { name: 'video-to-gif', path: 'media-tools/video-to-gif' },
        { name: 'webcam-snapshot', path: 'media-tools/webcam-snapshot' }
      ]
    },
    {
      name: 'System / Browser Utilities',
      description: 'System information and browser tools',
      icon: 'devices',
      path: 'browser-utils',
      subCategories: [
        { name: 'screen-resolution-info', path: 'browser-utils/screen-resolution-info' },
        { name: 'battery-status-viewer', path: 'browser-utils/battery-status-viewer' },
        { name: 'device-orientation-logger', path: 'browser-utils/device-orientation-logger' },
        { name: 'storage-viewer', path: 'browser-utils/storage-viewer' },
        { name: 'cookie-editor', path: 'browser-utils/cookie-editor' },
        { name: 'network-speed-test', path: 'browser-utils/network-speed-test' }
      ]
    },
    {
      name: 'Fun & Productivity Tools',
      description: 'Entertainment and productivity helpers',
      icon: 'emoji_emotions',
      path: 'fun-tools',
      subCategories: [
        { name: 'qr-code-generator', path: 'fun-tools/qr-code-generator' },
        { name: 'barcode-generator', path: 'fun-tools/barcode-generator' },
        { name: 'stopwatch-timer', path: 'fun-tools/stopwatch-timer' },
        { name: 'random-number-generator', path: 'fun-tools/random-number-generator' },
        { name: 'coin-toss-dice-roller', path: 'fun-tools/coin-toss-dice-roller' },
        { name: 'lorem-ipsum-generator', path: 'fun-tools/lorem-ipsum-generator' },
        { name: 'timezone-converter', path: 'fun-tools/timezone-converter' },
        { name: 'typing-speed-test', path: 'fun-tools/typing-speed-test' },
        { name: 'pomodoro-timer', path: 'fun-tools/pomodoro-timer' },
        { name: 'flashcard-quiz-generator', path: 'fun-tools/flashcard-quiz-generator' },
        { name: 'motivational-quote-generator', path: 'fun-tools/motivational-quote-generator' }
      ]
    }
  ];

  searchQuery: string = '';
  filteredCategories: any[] = [];


  constructor(private router: Router) { 
     this.filteredCategories = this.toolCategories;
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  filterCategories() {
    const query = this.searchQuery.toLowerCase();
    if (!query.trim()) {
      this.filteredCategories = this.toolCategories;
      return;
    }

    this.filteredCategories = this.toolCategories
      .map(category => {
        const matchingTools = category.subCategories.filter((tool: any) =>
          tool.name.toLowerCase().includes(query)
        );
        if (
          category.name.toLowerCase().includes(query) ||
          matchingTools.length > 0
        ) {
          return { ...category, subCategories: matchingTools.length > 0 ? matchingTools : category.subCategories };
        }
        return null;
      })
      .filter((cat: any) => cat !== null);
  }
}
