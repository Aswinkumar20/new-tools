import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Navigation } from '../navigation/navigation';
import { AssetService } from '../../services/asset.service';
import { TooltipDirective } from '../../directive/tooltip.directive';

@Component({
  selector: 'lib-my-component',
  standalone: true,
  templateUrl: './my-component.html',
  styleUrl: './my-component.scss',
  imports: [
    CommonModule,
    FormsModule,
    Navigation,
    RouterModule,
    TooltipDirective,
  ],
})
export class MyComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'My Component';
  toolCategories = [
    {
      name: 'Text & Utilities',
      description: 'Tools for text manipulation and utilities',
      icon: 'fas fa-font',
      path: 'text-utilities',
      subCategories: [
        {
          name: 'Word & Character Counter',
          description: 'Measure characters, words, reading time, and more in real time.',
          path: '/text-utilities/character-counter'
        },
        {
          name: 'Text Case Converter',
          description: 'Switch text between lowercase, uppercase, sentence case, or custom formats.',
          path: 'text-utilities/text-case-convertor'
        },
        {
          name: 'Text to ASCII Converter',
          description: 'Transform any text into ASCII codes for encoding or debugging.',
          path: 'text-utilities/text-to-ascii'
        },
        {
          name: 'Remove Duplicate Lines',
          description: 'Clean up repeated lines from pasted text while keeping order intact.',
          path: 'text-utilities/remove-duplicate-lines'
        },
        {
          name: 'Reverse Text & Palindrome Checker',
          description: 'Flip strings instantly and verify whether phrases read the same both ways.',
          path: 'text-utilities/text-reversal-and-palindrome-checker'
        },
        {
          name: 'Base64 Encode & Decode',
          description: 'Encode files or strings to Base64 and decode them back effortlessly.',
          path: 'text-utilities/base64-encode-and-decode'
        },
        {
          name: 'Slug Generator',
          description: 'Convert titles into clean, SEO-friendly URL slugs with smart formatting.',
          path: 'text-utilities/slug-generator'
        },
        {
          name: 'Text Difference Checker',
          description: 'Compare two blocks of text and highlight additions, removals, or edits.',
          path: 'text-utilities/text-difference'
        }
      ]
    },
    {
      name: 'File Viewers',
      description: 'Easily open, preview, and explore different file types directly in your browser.',
      icon: 'fas fa-file-alt',
      path: 'file-viewers',
      subCategories: [
        {
          name: 'Image Viewer (PNG, JPEG, JPG, GIF, BMP, SVG, WEBP)',
          description: 'Preview your images instantly, zoom in for details, or browse through multiple pictures effortlessly.',
          path: '/file-viewers/image-viewer'
        },
        {
          name: 'PDF Viewer',
          description: 'Read, scroll, and search through PDF documents smoothly without installing any external software.',
          path: '/file-viewers/pdf-viewer'
        },
        {
          name: 'Word Document Viewer (DOC, DOCX)',
          description: 'Open and review Word documents directly online, preserving text formatting and layout.',
          path: '/file-viewers/word-viewer'
        },
        {
          name: 'PowerPoint Viewer (PPT, PPTX)',
          description: 'Flip through presentation slides online and preview content without needing PowerPoint.',
          path: '/file-viewers/powerpoint-viewer'
        },
        {
          name: 'Text File Viewer (TXT, LOG, MD, JSON, XML, YAML)',
          description: 'Quickly view text and data files in a clear, distraction-free interface with formatting support.',
          path: '/file-viewers/text-file-viewer'
        },
        {
          name: 'Markdown Previewer',
          description: 'Transform Markdown files into beautifully formatted documents right inside your browser.',
          path: '/file-viewers/markdown-previewer'
        },
        {
          name: 'Excel Viewer (XLS, XLSX, CSV)',
          description: 'View spreadsheets, inspect data, and analyze rows and columns with interactive tables.',
          path: '/file-viewers/excel-viewer'
        },
        {
          name: 'Log File Viewer & Analyzer',
          description: 'Browse and search large log files instantly to identify key entries or errors with ease.',
          path: '/file-viewers/log-viewer'
        },
        {
          name: 'Audio Player (MP3, WAV, OGG, FLAC)',
          description: 'Play and listen to audio files directly in your browser with an elegant, responsive player.',
          path: '/file-viewers/audio-player'
        },
        {
          name: 'Video Player (MP4, WEBM, OGV)',
          description: 'Watch videos seamlessly with playback controls, speed options, and full-screen support.',
          path: '/file-viewers/video-player'
        },
        {
          name: 'Font File Previewer (TTF, OTF, WOFF)',
          description: 'Preview custom fonts instantly and see how they look with different sample texts.',
          path: '/file-viewers/font-viewer'
        },
        {
          name: '3D Model Viewer (GLTF, OBJ, STL, FBX)',
          description: 'Inspect 3D models interactively—rotate, zoom, and explore objects in real time.',
          path: '/file-viewers/3d-model-viewer'
        },
        {
          name: 'Archive Viewer (ZIP, TAR, GZ)',
          description: 'Open compressed archives online, browse their contents, and preview files without extraction.',
          path: '/file-viewers/archive-viewer'
        }
      ]
    },
    {
      name: 'JSON / Data Converters',
      description: 'Tools to convert, format, and validate JSON and data formats',
      icon: 'fas fa-database',
      path: 'data-converters',
      subCategories: [
        {
          name: 'JSON Formatter & Validator',
          description: 'Beautify JSON, validate schemas, and spot syntax errors instantly.',
          path: 'data-converters/json-formatter-beautifier-validator'
        },
        {
          name: 'CSV ↔ JSON Converter',
          description: 'Convert between CSV and JSON while preserving headers and structure.',
          path: 'data-converters/csv-to-json-json-to-csv'
        },
        {
          name: 'YAML ↔ JSON Converter',
          description: 'Translate YAML to JSON (and back) with indentation-aware parsing.',
          path: 'data-converters/yaml-to-json-json-to-yaml'
        },
        {
          name: 'HTML Table to JSON',
          description: 'Paste any HTML table markup and export clean, structured JSON.',
          path: 'data-converters/html-table-to-json'
        },
        {
          name: 'Markdown to HTML',
          description: 'Preview and convert Markdown documents into standards-compliant HTML.',
          path: 'data-converters/markdown-to-html'
        },
        {
          name: 'JSON Linter & Viewer',
          description: 'Inspect and lint JSON with collapsible nodes and detailed error tips.',
          path: 'data-converters/json-linter-viewer'
        },
        {
          name: 'Excel to JSON',
          description: 'Upload spreadsheets (XLS, XLSX, CSV) and output tidy JSON payloads.',
          path: 'data-converters/excel-to-json'
        },
        {
          name: 'JSON Parser',
          description: 'Evaluate JSON expressions and explore the resulting JavaScript objects.',
          path: 'data-converters/json-parser'
        }
      ]
    },
    {
      name: 'Number & Date Tools',
      description: 'Calculators, converters, and date utilities',
      icon: 'fas fa-calculator',
      path: 'math-date-utils',
      subCategories: [
        {
          name: 'Unit Converter',
          description: 'Convert length, weight, temperature, and more with smart unit detection.',
          path: 'math-date-utils/unit-converter'
        },
        {
          name: 'Number to Words',
          description: 'Spell out any number in plain English for cheques, invoices, or UX copy.',
          path: 'math-date-utils/number-to-words'
        },
        {
          name: 'Percentage Calculator',
          description: 'Compute percentages, increases, and discounts with quick presets.',
          path: 'math-date-utils/percentage-calculator'
        },
        {
          name: 'Age Calculator',
          description: 'Find exact age in years, months, days, or upcoming milestones.',
          path: 'math-date-utils/age-calculator'
        },
        {
          name: 'Date Difference Calculator',
          description: 'Measure the gap between two dates including business-day views.',
          path: 'math-date-utils/date-difference-calculator'
        },
        {
          name: 'Interest Calculator',
          description: 'Compare simple and compound interest with adjustable schedules.',
          path: 'math-date-utils/simple-compound-interest-calculator'
        },
        {
          name: 'BMI Calculator',
          description: 'Check body mass index with guidance across multiple measurement units.',
          path: 'math-date-utils/bmi-calculator'
        },
        {
          name: 'Loan EMI Calculator',
          description: 'Project loan payments, total interest, and amortization breakdowns.',
          path: 'math-date-utils/loan-emi-calculator'
        },
        {
          name: 'Tip Calculator',
          description: 'Split bills and tips with rounding options and party size controls.',
          path: 'math-date-utils/tip-calculator'
        },
        {
          name: 'Currency Converter',
          description: 'Convert global currencies with live mid-market exchange rates.',
          path: 'math-date-utils/currency-converter'
        },
        {
          name: 'Fraction Calculator',
          description: 'Add, subtract, multiply, or simplify fractions with visual steps.',
          path: 'math-date-utils/fraction-calculator'
        },
        {
          name: 'Date to Day of Week',
          description: 'Enter any date to instantly reveal the weekday and calendar context.',
          path: 'math-date-utils/date-to-day-of-week'
        },
        {
          name: 'Zodiac Finder',
          description: 'Discover sun signs and traits based on birth dates in seconds.',
          path: 'math-date-utils/zodiac-finder'
        }
      ]
    },
    {
      name: 'PDF Tools',
      description: 'View, edit, generate, and secure PDFs',
      icon: 'fas fa-file-pdf',
      path: 'pdf-tools',
      subCategories: [
        {
          name: 'PDF Viewer',
          description: 'Open PDFs in-browser with search, zoom, pagination, and theme controls.',
          path: 'pdf-tools/pdf-viewer'
        },
        {
          name: 'Merge PDFs',
          description: 'Combine multiple PDF files into one document in your chosen order.',
          path: 'pdf-tools/merge-pdfs'
        },
        {
          name: 'Split PDFs',
          description: 'Split large PDFs into smaller files by range or individual pages.',
          path: 'pdf-tools/split-pdfs'
        },
        {
          name: 'Delete PDF Pages',
          description: 'Remove selected pages from a PDF and download the cleaned document.',
          path: 'pdf-tools/delete-pages'
        },
        {
          name: 'Rotate PDF Pages',
          description: 'Rotate any page clockwise or counter-clockwise before exporting.',
          path: 'pdf-tools/rotate-pages'
        },
        {
          name: 'Reorder PDF Pages',
          description: 'Drag and drop page thumbnails to rearrange a PDF instantly.',
          path: 'pdf-tools/reorder-pages'
        },
        {
          name: 'Extract PDF Pages',
          description: 'Pull out selected pages into a brand-new PDF in just a click.',
          path: 'pdf-tools/extract-pages'
        },
        {
          name: 'Compress PDF',
          description: 'Reduce file size while preserving document clarity and structure.',
          path: 'pdf-tools/compress-pdf'
        },
        {
          name: 'Create PDF from HTML',
          description: 'Render HTML content as a polished PDF with custom margins and fonts.',
          path: 'pdf-tools/create-pdf-from-html'
        },
        {
          name: 'Tables & Charts to PDF',
          description: 'Export data tables or charts into printable, presentation-ready PDFs.',
          path: 'pdf-tools/tables-charts-to-pdf'
        },
        {
          name: 'Resume & Invoice Generator',
          description: 'Build resumes or invoices with templated PDFs ready to send.',
          path: 'pdf-tools/resume-invoice-generator'
        },
        {
          name: 'Text to PDF',
          description: 'Convert plain text or notes into properly formatted PDF documents.',
          path: 'pdf-tools/text-to-pdf'
        },
        {
          name: 'Screenshot to PDF',
          description: 'Turn images or screenshots into PDFs for archiving or sharing.',
          path: 'pdf-tools/screenshot-to-pdf'
        },
        {
          name: 'Annotate PDF',
          description: 'Highlight, draw, and comment on PDFs without leaving the browser.',
          path: 'pdf-tools/annotate-pdf'
        },
        {
          name: 'Highlight Text',
          description: 'Mark up important passages across any PDF with your favorite colors.',
          path: 'pdf-tools/highlight-text'
        },
        {
          name: 'Add Signature',
          description: 'Sign PDF documents digitally with stored or drawn signatures.',
          path: 'pdf-tools/add-signature'
        },
        {
          name: 'Fill PDF Forms',
          description: 'Complete and save interactive PDF forms with auto-save support.',
          path: 'pdf-tools/fill-pdf-forms'
        },
        {
          name: 'PDF Metadata Editor',
          description: 'Update title, author, keywords, and metadata fields in seconds.',
          path: 'pdf-tools/pdf-metadata-editor'
        },
        {
          name: 'Add Watermark',
          description: 'Overlay logos or text watermarks onto PDFs with custom placement.',
          path: 'pdf-tools/add-watermark'
        },
        {
          name: 'PDF to Base64',
          description: 'Encode PDFs into Base64 strings for APIs or inline embedding.',
          path: 'pdf-tools/pdf-to-base64'
        },
        {
          name: 'Password Protect PDF',
          description: 'Secure PDFs with passwords and choose between owner/user permissions.',
          path: 'pdf-tools/password-protect-pdf'
        },
        {
          name: 'Flatten PDF Forms',
          description: 'Convert fillable PDFs into static documents that preserve entries.',
          path: 'pdf-tools/flatten-pdf-forms'
        }
      ]
    },
    {
      name: 'Image & Color Tools',
      description: 'Image manipulation and color utilities',
      icon: 'fas fa-palette',
      path: 'image-color-tools',
      subCategories: [
        {
          name: 'Image to Base64',
          description: 'Convert images into Base64 strings for embedding in HTML or CSS.',
          path: 'image-color-tools/image-to-base64'
        },
        {
          name: 'Image Resizer',
          description: 'Resize images to specific dimensions while preserving key metadata.',
          path: 'image-color-tools/image-resizer'
        },
        {
          name: 'Image Compressor',
          description: 'Shrink image file sizes with adjustable quality sliders and previews.',
          path: 'image-color-tools/image-compressor'
        },
        {
          name: 'Color Picker',
          description: 'Capture hex, RGB, and HSL values from swatches, images, or uploads.',
          path: 'image-color-tools/color-picker'
        },
        {
          name: 'HEX to RGB Converter',
          description: 'Translate hex color codes into RGB, HSL, and CSS-ready formats.',
          path: 'image-color-tools/hex-to-rgb'
        },
        {
          name: 'Gradient Generator',
          description: 'Design smooth CSS gradients with live previews and exportable code.',
          path: 'image-color-tools/gradient-generator'
        },
        {
          name: 'Palette Generator',
          description: 'Create cohesive color palettes from photos, keywords, or base colors.',
          path: 'image-color-tools/palette-generator'
        },
        {
          name: 'Image to Text (OCR)',
          description: 'Extract editable text from images using fast on-device OCR.',
          path: 'image-color-tools/image-to-text'
        },
        {
          name: 'Favicon Generator',
          description: 'Produce favicon sets in multiple sizes, formats, and manifest variants.',
          path: 'image-color-tools/favicon-generator'
        },
        {
          name: 'Drawing Pad',
          description: 'Sketch ideas or annotate screenshots with a lightweight digital canvas.',
          path: 'image-color-tools/drawing-pad'
        }
      ]
    },
    {
      name: 'File & Code Tools',
      description: 'Code formatting and file utilities',
      icon: 'fas fa-code',
      path: 'code-file-tools',
      subCategories: [
        {
          name: 'HTML Minifier',
          description: 'Strip whitespace and comments to optimize HTML for production.',
          path: 'code-file-tools/html-minifier'
        },
        {
          name: 'CSS Minifier',
          description: 'Compress CSS files while preserving readability when needed.',
          path: 'code-file-tools/css-minifier'
        },
        {
          name: 'JavaScript Minifier',
          description: 'Minify JavaScript with tree-shaking friendly settings and sourcemaps.',
          path: 'code-file-tools/javascript-minifier'
        },
        {
          name: 'HTML Entity Encoder',
          description: 'Encode special characters to HTML entities or decode them back.',
          path: 'code-file-tools/html-entity-encoder'
        },
        {
          name: 'Clipboard Viewer',
          description: 'Inspect clipboard contents, formats, and history in a secure sandbox.',
          path: 'code-file-tools/clipboard-viewer'
        },
        {
          name: 'Clipboard History',
          description: 'Capture and organize clipboard snippets for reuse across projects.',
          path: 'code-file-tools/clipboard-history'
        },
        {
          name: 'File Metadata Viewer',
          description: 'Reveal EXIF, IPTC, and file system metadata without leaving the browser.',
          path: 'code-file-tools/file-metadata-viewer'
        },
        {
          name: 'Markdown to PDF',
          description: 'Convert Markdown documents into styled PDFs with optional templates.',
          path: 'code-file-tools/markdown-to-pdf'
        },
        {
          name: 'HTML Table Exporter',
          description: 'Export HTML tables into CSV, Excel, or JSON with a single click.',
          path: 'code-file-tools/html-table-exporter'
        }
      ]
    },
    {
      name: 'Design & Web Dev Tools',
      description: 'CSS tools, responsive design helpers, and web dev utilities',
      icon: 'fas fa-laptop-code',
      path: 'dev-design-tools',
      subCategories: [
        {
          name: 'CSS Gradient Generator',
          description: 'Craft linear and radial gradients with ready-to-copy CSS snippets.',
          path: 'dev-design-tools/css-gradient-generator'
        },
        {
          name: 'Box Shadow Generator',
          description: 'Visualize multi-layer shadows and export modern CSS box-shadow code.',
          path: 'dev-design-tools/box-shadow-generator'
        },
        {
          name: 'Border Radius Preview',
          description: 'Play with complex border-radius values and replicate neomorphic shapes.',
          path: 'dev-design-tools/border-radius-preview'
        },
        {
          name: 'Pixel to REM Converter',
          description: 'Convert pixel values to rem/em units using your project root size.',
          path: 'dev-design-tools/pixel-to-rem'
        },
        {
          name: 'Responsive Breakpoint Tester',
          description: 'Preview breakpoints side-by-side to validate responsive layouts.',
          path: 'dev-design-tools/responsive-breakpoint-tester'
        },
        {
          name: 'Viewport Size Detector',
          description: 'Inspect live viewport dimensions, DPR, and user agent details.',
          path: 'dev-design-tools/viewport-size-detector'
        },
        {
          name: 'Postman Lite',
          description: 'Send REST calls, inspect responses, and save reusable request collections.',
          path: 'dev-design-tools/postman-lite'
        },
        {
          name: 'CORS Test Tool',
          description: 'Verify CORS headers, methods, and credentials for any endpoint.',
          path: 'dev-design-tools/cors-test-tool'
        },
        {
          name: 'HTTP Header Decoder',
          description: 'Parse and explain HTTP headers for debugging and security reviews.',
          path: 'dev-design-tools/http-header-decoder'
        },
        {
          name: 'WebSocket Client',
          description: 'Connect to WebSocket servers, send messages, and monitor events.',
          path: 'dev-design-tools/websocket-client'
        },
        {
          name: 'HTTP Request Generator',
          description: 'Assemble fetch/XHR snippets with custom headers, payloads, and auth.',
          path: 'dev-design-tools/http-request-generator'
        },
        {
          name: 'Mock JSON Generator',
          description: 'Generate mock JSON data sets using easy-to-define templates.',
          path: 'dev-design-tools/mock-json-generator'
        }
      ]
    },
    {
      name: 'Validation & Testing Tools',
      description: 'Validators and testing utilities',
      icon: 'fas fa-check-circle',
      path: 'testing-tools',
      subCategories: [
        {
          name: 'JSON Schema Validator',
          description: 'Validate JSON against schemas with helpful pointer-based errors.',
          path: 'testing-tools/json-schema-validator'
        },
        {
          name: 'Password Rule Validator',
          description: 'Check passwords against custom complexity and compliance rules.',
          path: 'testing-tools/password-rule-validator'
        },
        {
          name: 'Email, URL & IP Checker',
          description: 'Confirm formatting and reachability for email, URL, and IP inputs.',
          path: 'testing-tools/email-url-ip-checker'
        },
        {
          name: 'User-Agent Parser',
          description: 'Decode user-agent strings into browser, device, and OS profiles.',
          path: 'testing-tools/user-agent-parser'
        },
        {
          name: 'Credit Card Validator',
          description: 'Validate card numbers, brand types, and Luhn checksum instantly.',
          path: 'testing-tools/credit-card-validator'
        },
        {
          name: 'JWT Decoder',
          description: 'Decode JSON Web Tokens, inspect payloads, and verify signature headers.',
          path: 'testing-tools/jwt-decoder'
        }
      ]
    },
    {
      name: 'Security & Crypto Tools',
      description: 'Hashing, encryption, and secure utilities',
      icon: 'fas fa-lock',
      path: 'security-tools',
      subCategories: [
        {
          name: 'Hash Generator',
          description: 'Generate MD5, SHA, and other hashes for files or arbitrary strings.',
          path: 'security-tools/hash-generator'
        },
        {
          name: 'UUID Generator',
          description: 'Create RFC-compliant UUIDs (v1-v5) for database keys or tracking.',
          path: 'security-tools/uuid-generator'
        },
        {
          name: 'Password Strength Checker',
          description: 'Score password strength and receive actionable improvement tips.',
          path: 'security-tools/password-strength-checker'
        },
        {
          name: 'Random Password Generator',
          description: 'Build secure passphrases with custom length, entropy, and wordlists.',
          path: 'security-tools/random-password-generator'
        },
        {
          name: 'Text Encrypt & Decrypt',
          description: 'Encrypt snippets with AES or custom ciphers and decrypt them later.',
          path: 'security-tools/text-encrypt-decrypt'
        },
        {
          name: 'Secure Clipboard',
          description: 'Store sensitive clipboard items using client-side encryption.',
          path: 'security-tools/secure-clipboard'
        },
        {
          name: 'Private Notes',
          description: 'Write self-destructing notes that live entirely in your browser.',
          path: 'security-tools/private-notes'
        }
      ]
    },
    {
      name: 'Media & Audio Tools',
      description: 'Audio, video, and media utilities',
      icon: 'fas fa-music',
      path: 'media-tools',
      subCategories: [
        {
          name: 'Voice Recorder',
          description: 'Record high-quality audio directly from your microphone with waveform previews.',
          path: 'media-tools/voice-recorder'
        },
        {
          name: 'Audio Player',
          description: 'Play MP3, WAV, and more with playlists, looping, and playback speed controls.',
          path: 'media-tools/audio-player'
        },
        {
          name: 'Audio Trimmer',
          description: 'Cut audio clips to precise start and end points without leaving the browser.',
          path: 'media-tools/audio-trimmer'
        },
        {
          name: 'Video to GIF Converter',
          description: 'Turn video segments into optimized GIFs with size and frame-rate settings.',
          path: 'media-tools/video-to-gif'
        },
        {
          name: 'Webcam Snapshot',
          description: 'Capture still photos from your webcam and export them in common formats.',
          path: 'media-tools/webcam-snapshot'
        }
      ]
    },
    {
      name: 'System / Browser Utilities',
      description: 'System information and browser tools',
      icon: 'fas fa-desktop',
      path: 'browser-utils',
      subCategories: [
        {
          name: 'Screen Resolution Info',
          description: 'Inspect viewport size, pixel density, and media query breakpoints.',
          path: 'browser-utils/screen-resolution-info'
        },
        {
          name: 'Battery Status Viewer',
          description: 'Monitor device battery level, charging state, and estimated time remaining.',
          path: 'browser-utils/battery-status-viewer'
        },
        {
          name: 'Device Orientation Logger',
          description: 'Track accelerometer and gyroscope data for motion-aware experiences.',
          path: 'browser-utils/device-orientation-logger'
        },
        {
          name: 'Storage Viewer',
          description: 'Browse localStorage, sessionStorage, and indexedDB entries with ease.',
          path: 'browser-utils/storage-viewer'
        },
        {
          name: 'Cookie Editor',
          description: 'View, add, edit, or delete cookies per domain with secure flag insights.',
          path: 'browser-utils/cookie-editor'
        },
        {
          name: 'Network Speed Test',
          description: 'Measure download/upload throughput and latency directly from your browser.',
          path: 'browser-utils/network-speed-test'
        }
      ]
    },
    {
      name: 'Fun & Productivity Tools',
      description: 'Entertainment and productivity helpers',
      icon: 'fas fa-gamepad',
      path: 'fun-tools',
      subCategories: [
        {
          name: 'QR Code Generator',
          description: 'Create QR codes for URLs, text, Wi-Fi access, and more with custom colors.',
          path: 'fun-tools/qr-code-generator'
        },
        {
          name: 'Barcode Generator',
          description: 'Produce barcode images (EAN, UPC, Code128) ready for printing or scanning.',
          path: 'fun-tools/barcode-generator'
        },
        {
          name: 'Stopwatch & Timer',
          description: 'Run countdown timers or stopwatches with lap tracking and alerts.',
          path: 'fun-tools/stopwatch-timer'
        },
        {
          name: 'Random Number Generator',
          description: 'Generate random numbers or lists with optional seeding and ranges.',
          path: 'fun-tools/random-number-generator'
        },
        {
          name: 'Coin Toss & Dice Roller',
          description: 'Flip virtual coins or roll dice with probability stats and animations.',
          path: 'fun-tools/coin-toss-dice-roller'
        },
        {
          name: 'Lorem Ipsum Generator',
          description: 'Fill designs with customizable lorem ipsum paragraphs, sentences, or words.',
          path: 'fun-tools/lorem-ipsum-generator'
        },
        {
          name: 'Timezone Converter',
          description: 'Compare time zones and schedule meetings with daylight-saving awareness.',
          path: 'fun-tools/timezone-converter'
        },
        {
          name: 'Typing Speed Test',
          description: 'Challenge your typing speed with live WPM, accuracy, and heatmaps.',
          path: 'fun-tools/typing-speed-test'
        },
        {
          name: 'Pomodoro Timer',
          description: 'Stay focused with configurable Pomodoro sessions, breaks, and stats.',
          path: 'fun-tools/pomodoro-timer'
        },
        {
          name: 'Flashcard Quiz Generator',
          description: 'Build flashcard decks and run spaced-repetition practice in minutes.',
          path: 'fun-tools/flashcard-quiz-generator'
        },
        {
          name: 'Motivational Quote Generator',
          description: 'Refresh your day with curated motivational quotes and shareable cards.',
          path: 'fun-tools/motivational-quote-generator'
        }
      ]
    }
  ];

  searchQuery: string = '';
  filteredCategories: any[] = [];
  popularTools: Array<{ name: string; path: string; category: string; iconUrl: string }> = [];
  highlights: Array<{ title: string; description: string }> = [
    {
      title: 'Lightning Fast Processing',
      description: 'Launch any tool in under a second with zero install overhead and smart caching built for the browser.'
    },
    {
      title: 'Privacy First Design',
      description: 'Your data stays on your device. No silent syncs, no tracking pixels, and no surprise pop-ups.'
    },
    {
      title: 'Built for Everyone',
      description: 'Intuitive enough for beginners, yet powerful enough for professionals and development teams.'
    },
    {
      title: 'Fully Accessible',
      description: 'Keyboard-friendly navigation, high-contrast themes, and screen-reader aware markup across the board.'
    }
  ];
  totalTools = 0;
  weeklyHighlights = 0;
  isDarkMode = false;
  searchIconUrl = '';
  featuredCategories: Array<{
    name: string;
    description?: string;
    iconUrl?: string;
    path: string;
    subCategories?: Array<{ path: string }>;
  }> = [];
  activeCategoryName: string | null = null;
  pageReady = false;
  readonly skeletonChipSlots = [0, 1, 2, 3, 4, 5];
  readonly skeletonCategorySlots = [0, 1, 2, 3, 4, 5];
  readonly skeletonPopularSlots = [0, 1, 2, 3, 4];
  readonly skeletonStatSlots = [0, 1, 2, 3];
  readonly skeletonCardSlots = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly skeletonToolLineSlots = [0, 1, 2, 3, 4];
  readonly maxToolsPreview = 6;
  expandedCategories: Record<string, boolean> = {};
  @ViewChild('homepageSearch') homepageSearch?: ElementRef<HTMLInputElement>;
  readonly searchSuggestions = [
    'PDF merge',
    'JSON formatter',
    'password generator',
    'image to PDF',
    'text case converter',
    'QR code',
    'UUID generator',
    'color picker',
  ];
  suggestionIndex = 0;
  private suggestionTimer: ReturnType<typeof setInterval> | null = null;
  private readonly themeStorageKey = 'easytoolhub.theme';
  private readonly assetService = inject(AssetService);

  /** Maps category names to SVG filenames in assets/icons/categories/ */
  private readonly categoryIconFiles: Record<string, string> = {
    'Text & Utilities': 'text-utilities.svg',
    'File Viewers': 'file-viewers.svg',
    'JSON / Data Converters': 'json-data-converters.svg',
    'Number & Date Tools': 'number-date-tools.svg',
    'PDF Tools': 'pdf-tools.svg',
    'Image & Color Tools': 'image-color-tools.svg',
    'File & Code Tools': 'file-code-tools.svg',
    'Design & Web Dev Tools': 'dev-design-tools.svg',
    'Validation & Testing Tools': 'validation-testing-tools.svg',
    'Security & Crypto Tools': 'security-crypto-tools.svg',
    'Media & Audio Tools': 'media-audio-tools.svg',
    'System / Browser Utilities': 'system-browser-utilities.svg',
    'Fun & Productivity Tools': 'fun-productivity-tools.svg',
  };

  constructor(private readonly router: Router) {
    this.filteredCategories = this.toolCategories;
  }

  ngOnInit(): void {
    this.searchIconUrl = this.assetService.getAssetPath('icons/search.svg');
    this.attachIconPaths();
    this.featuredCategories = this.toolCategories;
    this.totalTools = this.computeTotalToolCount();
    this.popularTools = this.computePopularTools(5);
    this.weeklyHighlights = this.estimateWeeklyHighlights();
    this.hydrateThemePreference();
    this.startSuggestionRotation();
  }

  ngAfterViewInit(): void {
    this.focusSearchOnDesktop();
    // Defer so entrance animations run after first paint
    requestAnimationFrame(() => {
      this.pageReady = true;
    });
  }

  ngOnDestroy(): void {
    this.stopSuggestionRotation();
  }

  get currentSuggestion(): string {
    return this.searchSuggestions[this.suggestionIndex] ?? this.searchSuggestions[0];
  }

  get searchPlaceholder(): string {
    return `Search tools — try “${this.currentSuggestion}”…`;
  }

  get catalogMode(): 'browse' | 'category' | 'search' {
    if (this.searchQuery.trim()) {
      return 'search';
    }
    if (this.activeCategoryName) {
      return 'category';
    }
    return 'browse';
  }

  get hasActiveCatalogFilter(): boolean {
    return !!this.searchQuery.trim() || !!this.activeCategoryName;
  }

  navigateTo(path: string) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    this.router.navigateByUrl(normalized);
  }

  navigateToCategory(category: { path: string; subCategories?: Array<{ path: string }> }) {
    const first = category.subCategories?.[0];
    if (first?.path) {
      this.navigateTo(first.path);
      return;
    }
    this.router.navigateByUrl(`/${category.path}`);
  }

  exploreCategory(category: { name: string }) {
    if (this.activeCategoryName === category.name) {
      this.clearCategoryFilter();
      return;
    }
    this.activeCategoryName = category.name;
    this.searchQuery = '';
    this.filterCategories();
    this.scrollToCatalog();
  }

  applySuggestion(term?: string) {
    this.activeCategoryName = null;
    this.searchQuery = term?.trim() || this.currentSuggestion;
    this.filterCategories();
  }

  onSearchInput() {
    if (this.searchQuery.trim()) {
      this.activeCategoryName = null;
    }
    this.filterCategories();
  }

  scrollToCatalog() {
    const catalog = document.getElementById('catalog-title');
    catalog?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  clearSearch() {
    this.searchQuery = '';
    this.activeCategoryName = null;
    this.expandedCategories = {};
    this.filterCategories();
  }

  clearCategoryFilter() {
    this.activeCategoryName = null;
    this.expandedCategories = {};
    this.filterCategories();
  }

  private focusSearchOnDesktop() {
    if (typeof globalThis === 'undefined' || typeof globalThis.matchMedia !== 'function') {
      return;
    }
    const isDesktop = globalThis.matchMedia('(min-width: 768px)').matches;
    if (!isDesktop) {
      return;
    }
    queueMicrotask(() => this.homepageSearch?.nativeElement?.focus({ preventScroll: true }));
  }

  private startSuggestionRotation() {
    this.stopSuggestionRotation();
    if (typeof globalThis === 'undefined' || typeof globalThis.setInterval !== 'function') {
      return;
    }
    this.suggestionTimer = globalThis.setInterval(() => {
      if (this.searchQuery.trim()) {
        return;
      }
      this.suggestionIndex = (this.suggestionIndex + 1) % this.searchSuggestions.length;
    }, 2800);
  }

  private stopSuggestionRotation() {
    if (this.suggestionTimer != null) {
      globalThis.clearInterval(this.suggestionTimer);
      this.suggestionTimer = null;
    }
  }

  getDisplayTools(category: { name: string; subCategories?: Array<{ name: string; path: string; description?: string }> }) {
    const tools = category.subCategories ?? [];
    if (this.isCategoryExpanded(category.name)) {
      return tools;
    }
    return tools.slice(0, this.maxToolsPreview);
  }

  isCategoryExpanded(categoryName: string): boolean {
    return !!this.expandedCategories[categoryName];
  }

  toggleCategoryTools(categoryName: string, event?: Event): void {
    const wasExpanded = this.isCategoryExpanded(categoryName);
    this.expandedCategories = {
      ...this.expandedCategories,
      [categoryName]: !wasExpanded,
    };
    if (wasExpanded && event) {
      queueMicrotask(() => {
        const toolsList = (event.currentTarget as HTMLElement | null)
          ?.closest('.home-card')
          ?.querySelector('.home-card__tools');
        toolsList?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  getRemainingToolCount(category: { subCategories?: unknown[] }): number {
    const total = category.subCategories?.length ?? 0;
    return Math.max(0, total - this.maxToolsPreview);
  }

  getVisibleToolCount(): number {
    return this.filteredCategories.reduce(
      (total, category) => total + (category.subCategories?.length ?? 0),
      0
    );
  }

  getSearchResults(): Array<{ name: string; path: string; category: string; description?: string }> {
    if (!this.searchQuery.trim()) {
      return [];
    }
    return this.filteredCategories.flatMap(category =>
      (category.subCategories ?? []).map((tool: { name: string; path: string; description?: string }) => ({
        name: tool.name,
        path: tool.path,
        category: category.name,
        description: tool.description,
      }))
    );
  }

  getCatalogListTools(): Array<{ name: string; path: string; category: string; description?: string }> {
    if (this.catalogMode === 'search') {
      return this.getSearchResults();
    }
    if (this.catalogMode === 'category') {
      const category = this.filteredCategories[0];
      if (!category) {
        return [];
      }
      return (category.subCategories ?? []).map((tool: { name: string; path: string; description?: string }) => ({
        name: tool.name,
        path: tool.path,
        category: category.name,
        description: tool.description,
      }));
    }
    return [];
  }

  clearAllCatalogFilters(): void {
    this.clearSearch();
  }

  toolInitial(name: string): string {
    return this.shortToolName(name).charAt(0).toUpperCase();
  }

  shortToolName(name: string): string {
    const parenIndex = name.indexOf('(');
    const trimmed = parenIndex > 0 ? name.slice(0, parenIndex).trim() : name;
    return trimmed.length > 36 ? `${trimmed.slice(0, 33)}…` : trimmed;
  }

  shortCategoryName(name: string): string {
    const shortNames: Record<string, string> = {
      'Text & Utilities': 'Text',
      'File Viewers': 'Files',
      'JSON / Data Converters': 'Data',
      'Number & Date Tools': 'Numbers',
      'PDF Tools': 'PDF',
      'Image & Color Tools': 'Image',
      'File & Code Tools': 'Code',
      'Design & Web Dev Tools': 'Dev',
      'Validation & Testing Tools': 'Validate',
      'Security & Crypto Tools': 'Security',
      'Media & Audio Tools': 'Media',
      'System / Browser Utilities': 'Browser',
      'Fun & Productivity Tools': 'Fun',
    };
    return shortNames[name] ?? (name.length > 12 ? `${name.slice(0, 10)}…` : name);
  }

  filterCategories() {
    const query = this.searchQuery.toLowerCase().trim();
    this.expandedCategories = {};

    if (!query && this.activeCategoryName) {
      this.filteredCategories = this.toolCategories.filter(
        category => category.name === this.activeCategoryName
      );
      return;
    }

    if (!query) {
      this.filteredCategories = this.toolCategories;
      return;
    }

    this.filteredCategories = this.toolCategories
      .map(category => {
        const matchingTools = category.subCategories.filter((tool: any) =>
          tool.name.toLowerCase().includes(query) || tool.description.toLowerCase().includes(query)
        );
        if (
          category.name.toLowerCase().includes(query) ||
          category.description.toLowerCase().includes(query) ||
          matchingTools.length > 0
        ) {
          return { ...category, subCategories: matchingTools.length > 0 ? matchingTools : category.subCategories };
        }
        return null;
      })
      .filter((cat: any) => cat !== null);
  }

  onSearch(event: Event) {
    event.preventDefault();
    this.filterCategories();
    const first = this.getSearchResults()[0];
    if (first?.path) {
      this.navigateTo(first.path);
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    const storage = this.getLocalStorage();
    storage?.setItem(this.themeStorageKey, this.isDarkMode ? 'dark' : 'light');
  }

  trackByCategory = (_: number, category: any) => category?.name;
  trackByTool = (_: number, tool: any) => tool?.path ?? tool?.name;
  trackByHighlight = (_: number, highlight: any) => highlight?.title;
  
  private computeTotalToolCount(): number {
    return this.toolCategories.reduce((total, category) => {
      const toolsCount = Array.isArray(category.subCategories) ? category.subCategories.length : 0;
      return total + toolsCount;
    }, 0);
  }

  private computePopularTools(limit = 6): Array<{ name: string; path: string; category: string; iconUrl: string }> {
    return this.toolCategories
      .flatMap(category =>
        (category.subCategories ?? []).map((tool: any) => ({
          name: tool.name,
          path: tool.path,
          category: category.name,
          iconUrl: tool.iconUrl ?? this.buildIconPath(tool.name)
        }))
      )
      .slice(0, limit);
  }

  private attachIconPaths(): void {
    this.toolCategories = this.toolCategories.map(category => {
      const iconUrl = this.buildIconPath(category.name);
      const subCategories = (category.subCategories ?? []).map((tool: any) => ({
        ...tool,
        iconUrl: tool.iconUrl ?? this.buildIconPath(tool.name)
      }));
      return { ...category, iconUrl, subCategories };
    });
    this.filteredCategories = this.toolCategories;
  }

  private buildIconPath(name: string): string {
    const categoryFile = this.categoryIconFiles[name];
    if (categoryFile) {
      return this.assetService.getAssetPath(`icons/categories/${categoryFile}`);
    }
    const segments = name.toLowerCase().match(/[a-z0-9]+/g);
    const slug = segments?.join('-') ?? 'icon';
    return this.assetService.getAssetPath(`icons/categories/${slug}.svg`);
  }

   private estimateWeeklyHighlights(): number {
    return Math.max(3, Math.round(this.toolCategories.length * 0.6));
  }

  private hydrateThemePreference() {
    const storage = this.getLocalStorage();
    const storedTheme = storage?.getItem(this.themeStorageKey);
    if (storedTheme === 'dark' || storedTheme === 'light') {
      this.isDarkMode = storedTheme === 'dark';
      return;
    }
    const matchMediaFn = this.getMatchMedia();
    const mediaQuery = matchMediaFn ? matchMediaFn('(prefers-color-scheme: dark)') : null;
    this.isDarkMode = mediaQuery?.matches ?? false;
  }

  private getLocalStorage(): Storage | null {
    if (typeof globalThis === 'undefined') {
      return null;
    }
    const globalObject = globalThis as typeof globalThis & { localStorage?: Storage };
    return globalObject.localStorage ?? null;
  }

  private getMatchMedia(): ((query: string) => MediaQueryList) | null {
    if (typeof globalThis === 'undefined') {
      return null;
    }
    const globalObject = globalThis as typeof globalThis & { matchMedia?: (query: string) => MediaQueryList };
    return typeof globalObject.matchMedia === 'function' ? globalObject.matchMedia.bind(globalObject) : null;
  }
}