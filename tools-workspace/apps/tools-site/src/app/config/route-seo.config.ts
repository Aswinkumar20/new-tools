import { SeoMetadata } from '../services/seo.service';

/**
 * SEO metadata configuration for all routes
 * This helps Google understand what each page is about
 */
export const routeSeoConfig: Record<string, SeoMetadata> = {
  // Home page
  '/tools/home': {
    title: 'EasyToolHub - Free Online Tools for Everyone',
    description:
      'Discover 100+ free online tools for text editing, file conversion, PDF manipulation, image editing, and more. No signup required. Fast, secure, and privacy-focused.',
    keywords:
      'free online tools, text tools, file converter, PDF tools, image tools, developer tools, web tools, utility tools',
    url: '/tools/home',
  },

  // Text Utilities
  '/text-utilities/character-counter': {
    title: 'Character Counter - Count Words, Characters, Lines | EasyToolHub',
    description:
      'Free online character counter tool. Count words, characters, sentences, paragraphs, and lines instantly. Perfect for writers, students, and content creators.',
    keywords: 'character counter, word counter, text counter, character count, word count tool',
    url: '/text-utilities/character-counter',
  },
  '/text-utilities/text-case-convertor': {
    title: 'Text Case Converter - Uppercase, Lowercase, Title Case | EasyToolHub',
    description:
      'Convert text between uppercase, lowercase, title case, sentence case, and more. Free online text case converter tool.',
    keywords: 'text case converter, uppercase, lowercase, title case, case converter tool',
    url: '/text-utilities/text-case-convertor',
  },
  '/text-utilities/base64-encode-and-decode': {
    title: 'Base64 Encode & Decode - Free Online Tool | EasyToolHub',
    description:
      'Encode and decode Base64 strings instantly. Free online Base64 encoder and decoder tool for developers and data processing.',
    keywords: 'base64 encode, base64 decode, base64 converter, base64 tool, encoder decoder',
    url: '/text-utilities/base64-encode-and-decode',
  },
  '/text-utilities/slug-generator': {
    title: 'URL Slug Generator - Create SEO-Friendly Slugs | EasyToolHub',
    description:
      'Generate SEO-friendly URL slugs from any text. Convert titles to clean, readable URLs instantly.',
    keywords: 'slug generator, url slug, seo slug, url generator, slugify tool',
    url: '/text-utilities/slug-generator',
  },

  // File Viewers
  '/file-viewers/image-viewer': {
    title: 'Image Viewer - View & Analyze Images Online | EasyToolHub',
    description:
      'Free online image viewer. View, analyze, and get image metadata. Supports all major image formats.',
    keywords: 'image viewer, image viewer online, image metadata, image analyzer',
    url: '/file-viewers/image-viewer',
  },
  '/file-viewers/pdf-viewer': {
    title: 'PDF Viewer - View PDF Files Online | EasyToolHub',
    description: 'View PDF files online without downloading. Free PDF viewer with zoom, search, and navigation features.',
    keywords: 'pdf viewer, view pdf online, pdf reader, online pdf viewer',
    url: '/file-viewers/pdf-viewer',
  },
  '/file-viewers/markdown-previewer': {
    title: 'Markdown Previewer - Preview Markdown Online | EasyToolHub',
    description:
      'Preview and render Markdown files online. Real-time markdown preview with syntax highlighting and formatting.',
    keywords: 'markdown previewer, markdown viewer, markdown renderer, markdown editor',
    url: '/file-viewers/markdown-previewer',
  },

  // PDF Tools
  '/pdf-tools/merge-pdfs': {
    title: 'Merge PDFs - Combine Multiple PDF Files | EasyToolHub',
    description: 'Merge multiple PDF files into one document. Free online PDF merger tool. No file size limits.',
    keywords: 'merge pdf, combine pdf, pdf merger, merge pdf files, pdf combiner',
    url: '/pdf-tools/merge-pdfs',
  },
  '/pdf-tools/split-pdfs': {
    title: 'Split PDF - Split PDF Files Online | EasyToolHub',
    description: 'Split PDF files into multiple documents. Extract pages from PDFs easily. Free online tool.',
    keywords: 'split pdf, pdf splitter, extract pdf pages, divide pdf, pdf separator',
    url: '/pdf-tools/split-pdfs',
  },
  '/pdf-tools/compress-pdf': {
    title: 'Compress PDF - Reduce PDF File Size | EasyToolHub',
    description:
      'Compress PDF files to reduce file size. Free online PDF compressor. Maintain quality while reducing size.',
    keywords: 'compress pdf, pdf compressor, reduce pdf size, pdf optimizer, shrink pdf',
    url: '/pdf-tools/compress-pdf',
  },

  // Image Tools
  '/image-color-tools/image-resizer': {
    title: 'Image Resizer - Resize Images Online | EasyToolHub',
    description:
      'Resize images online for free. Change image dimensions while maintaining aspect ratio. Supports all formats.',
    keywords: 'image resizer, resize image, image size changer, photo resizer, image dimensions',
    url: '/image-color-tools/image-resizer',
  },
  '/image-color-tools/image-compressor': {
    title: 'Image Compressor - Compress Images Online | EasyToolHub',
    description:
      'Compress images to reduce file size. Free online image compressor. Optimize images for web without losing quality.',
    keywords: 'image compressor, compress image, image optimizer, reduce image size, photo compressor',
    url: '/image-color-tools/image-compressor',
  },
  '/image-color-tools/color-picker': {
    title: 'Color Picker - Pick Colors from Images | EasyToolHub',
    description: 'Pick colors from images or use the color picker tool. Get hex, RGB, HSL color codes instantly.',
    keywords: 'color picker, color selector, hex color, rgb color, color tool',
    url: '/image-color-tools/color-picker',
  },

  // Data Converters
  '/data-converters/json-formatter-beautifier-validator': {
    title: 'JSON Formatter - Format, Validate & Beautify JSON | EasyToolHub',
    description:
      'Format, validate, and beautify JSON online. Free JSON formatter with syntax highlighting and error detection.',
    keywords: 'json formatter, json beautifier, json validator, format json, json prettifier',
    url: '/data-converters/json-formatter-beautifier-validator',
  },
  '/data-converters/csv-to-json-json-to-csv': {
    title: 'CSV to JSON Converter - Convert CSV & JSON | EasyToolHub',
    description: 'Convert CSV to JSON and JSON to CSV online. Free data format converter tool.',
    keywords: 'csv to json, json to csv, csv converter, data converter, csv json converter',
    url: '/data-converters/csv-to-json-json-to-csv',
  },

  // Security Tools
  '/security-tools/hash-generator': {
    title: 'Hash Generator - Generate MD5, SHA256, SHA512 Hashes | EasyToolHub',
    description:
      'Generate cryptographic hashes (MD5, SHA256, SHA512) from text. Free online hash generator tool.',
    keywords: 'hash generator, md5, sha256, sha512, hash calculator, cryptographic hash',
    url: '/security-tools/hash-generator',
  },
  '/security-tools/password-strength-checker': {
    title: 'Password Strength Checker - Test Password Security | EasyToolHub',
    description:
      'Check your password strength and security. Get real-time feedback on password strength and suggestions.',
    keywords: 'password strength, password checker, password security, password analyzer',
    url: '/security-tools/password-strength-checker',
  },

  // Fun Tools
  '/fun-tools/qr-code-generator': {
    title: 'QR Code Generator - Create QR Codes Online | EasyToolHub',
    description: 'Generate QR codes for URLs, text, and more. Free online QR code generator with customization options.',
    keywords: 'qr code generator, create qr code, qr code maker, qr code creator',
    url: '/fun-tools/qr-code-generator',
  },
};

/**
 * Get SEO metadata for a route
 */
export function getSeoMetadataForRoute(route: string): SeoMetadata | null {
  // Remove query parameters and trailing slashes
  const cleanRoute = route.split('?')[0].replace(/\/$/, '') || '/tools/home';

  // Check exact match first
  if (routeSeoConfig[cleanRoute]) {
    return routeSeoConfig[cleanRoute];
  }

  // Check if it's a category route (e.g., /text-utilities)
  const categoryRoute = cleanRoute.split('/').slice(0, 2).join('/');
  if (routeSeoConfig[categoryRoute]) {
    return routeSeoConfig[categoryRoute];
  }

  // Generate default metadata based on route
  return generateDefaultSeoMetadata(cleanRoute);
}

/**
 * Generate default SEO metadata for routes not in config
 */
function generateDefaultSeoMetadata(route: string): SeoMetadata {
  const parts = route.split('/').filter(Boolean);
  const toolName = parts[parts.length - 1] || 'Tool';
  const category = parts[parts.length - 2] || 'Tools';

  // Convert kebab-case to Title Case
  const formattedToolName = toolName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const formattedCategory = category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    title: `${formattedToolName} - Free Online ${formattedCategory} Tool | EasyToolHub`,
    description: `Free online ${formattedToolName.toLowerCase()} tool. ${formattedCategory} utility for ${formattedToolName.toLowerCase().replace(/-/g, ' ')}. No signup required.`,
    keywords: `${formattedToolName.toLowerCase()}, ${formattedCategory.toLowerCase()}, online tool, free tool, ${formattedToolName.toLowerCase().replace(/-/g, ', ')}`,
    url: route,
  };
}

