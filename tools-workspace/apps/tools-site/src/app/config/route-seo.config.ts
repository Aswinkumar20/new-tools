import { SeoMetadata } from '../services/seo.service';
import { TOOL_SEO_CATALOG, ToolSeoEntry } from './tool-seo-catalog.generated';

/**
 * Optional hand-tuned SEO overrides for high-traffic pages.
 * These take precedence over the auto-generated catalog.
 */
const SEO_OVERRIDES: Record<string, Partial<SeoMetadata>> = {
  '/tools/home': {
    title: 'EasyToolHub - Free Online Tools for Everyone',
    description:
      'Discover 160+ free online tools for text editing, PDF editing, file conversion, image tools, calculators, developer utilities, and security. No signup — fast, private, and browser-based.',
    keywords:
      'free online tools, online utilities, text tools, PDF tools, file converter, image tools, JSON formatter, developer tools, password generator, QR code generator, unit converter, hash generator, word counter, merge PDF, compress PDF, easytoolhub',
  },
  '/text-utilities/character-counter': {
    title: 'Character Counter - Count Words, Characters, Lines',
    description:
      'Free online character counter. Count words, characters, sentences, paragraphs, and lines instantly. Perfect for writers, students, and content creators. Runs in your browser.',
    keywords:
      'character counter, word counter, text counter, character count, word count tool, letter counter, reading time calculator',
  },
  '/text-utilities/text-case-convertor': {
    title: 'Text Case Converter - Uppercase, Lowercase, Title Case',
    description:
      'Convert text to uppercase, lowercase, title case, sentence case, and more. Free online case converter — private and instant.',
    keywords:
      'text case converter, uppercase converter, lowercase converter, title case, sentence case, camel case',
  },
  '/text-utilities/base64-encode-and-decode': {
    title: 'Base64 Encode & Decode Online',
    description:
      'Encode text or files to Base64 and decode Base64 back instantly. Free online Base64 encoder/decoder — no upload required.',
    keywords: 'base64 encoder, base64 decoder, encode base64 online, decode base64, base64 converter',
  },
  '/text-utilities/url-encode-and-decode': {
    title: 'URL Encode & Decode - Percent Encoding Online',
    description:
      'URL-encode or decode strings, query values, and Unicode text. Free percent-encoding tool for developers.',
    keywords: 'url encoder, url decoder, percent encode, decode url online, uri encode',
  },
  '/data-converters/json-formatter-beautifier-validator': {
    title: 'JSON Formatter - Format, Validate & Beautify JSON',
    description:
      'Format, validate, and beautify JSON online. Free JSON formatter with syntax highlighting and error detection. No upload required — private and fast.',
    keywords:
      'json formatter, json beautifier, json validator, format json, json prettifier, pretty print json',
  },
  '/data-converters/csv-to-json-json-to-csv': {
    title: 'CSV to JSON Converter - JSON to CSV Online',
    description:
      'Convert CSV to JSON and JSON to CSV instantly. Free bidirectional data converter that runs in your browser.',
    keywords: 'csv to json, json to csv, convert csv json, csv json converter',
  },
  '/pdf-tools/merge-pdfs': {
    title: 'Merge PDFs - Combine Multiple PDF Files Online',
    description:
      'Merge multiple PDF files into one document. Free online PDF merger — combine pages in any order. No signup, files stay in your browser.',
    keywords: 'merge pdf, combine pdf, pdf merger, merge pdf files, pdf combiner, join pdf',
  },
  '/pdf-tools/split-pdfs': {
    title: 'Split PDF - Separate PDF Pages Online',
    description:
      'Split a PDF into separate files or extract page ranges. Free online PDF splitter — private and fast.',
    keywords: 'split pdf, pdf splitter, separate pdf pages, extract pdf range',
  },
  '/pdf-tools/compress-pdf': {
    title: 'Compress PDF - Reduce PDF File Size Online',
    description:
      'Compress PDF files to reduce size while keeping quality usable. Free online PDF compressor — no upload to a server.',
    keywords: 'compress pdf, reduce pdf size, pdf compressor online, shrink pdf',
  },
  '/pdf-tools/pdf-viewer': {
    title: 'PDF Viewer - Open & Read PDFs Online',
    description:
      'View PDF documents in your browser with zoom, outline, and page navigation. Free online PDF viewer — no install.',
    keywords: 'pdf viewer online, view pdf in browser, free pdf reader, open pdf online',
  },
  '/security-tools/hash-generator': {
    title: 'Hash Generator - MD5, SHA256, SHA512 Online',
    description:
      'Generate cryptographic hashes (MD5, SHA256, SHA512) from text or files. Free online hash generator for developers and security testing.',
    keywords: 'hash generator, md5, sha256, sha512, hash calculator, cryptographic hash, checksum',
  },
  '/security-tools/random-password-generator': {
    title: 'Password Generator - Strong Random Passwords',
    description:
      'Generate strong random passwords with length and character controls. Free online password generator — private and instant.',
    keywords: 'password generator, strong password, random password maker, secure password generator',
  },
  '/fun-tools/qr-code-generator': {
    title: 'QR Code Generator - Create QR Codes Online',
    description:
      'Generate QR codes for URLs, Wi-Fi, text, and contact cards. Free online QR code generator with customization. Download instantly.',
    keywords: 'qr code generator, create qr code, qr code maker, qr code creator, wifi qr code',
  },
  '/math-date-utils/unit-converter': {
    title: 'Unit Converter - Length, Weight, Temperature & More',
    description:
      'Convert metric and imperial units for length, weight, temperature, volume, and more. Free online unit converter.',
    keywords: 'unit converter, metric converter, length converter, weight converter, temperature converter',
  },
  '/image-color-tools/image-resizer': {
    title: 'Image Resizer - Resize Photos Online',
    description:
      'Resize images by pixels or percentage and download instantly. Free online image resizer — private in your browser.',
    keywords: 'image resizer, resize photo online, change image size, resize jpg png',
  },
  '/image-color-tools/image-compressor': {
    title: 'Image Compressor - Reduce Image File Size',
    description:
      'Compress JPG, PNG, and WebP images to smaller file sizes. Free online image compressor with quality control.',
    keywords: 'image compressor, compress jpg, reduce image size, compress png online',
  },
  '/testing-tools/jwt-decoder': {
    title: 'JWT Decoder - Decode JSON Web Tokens Online',
    description:
      'Decode and inspect JWT headers and payloads safely in your browser. Free JWT debugger — tokens never leave your device.',
    keywords: 'jwt decoder, decode jwt token, jwt debugger, json web token decoder',
  },
};

/**
 * Get SEO metadata for a route
 */
export function getSeoMetadataForRoute(route: string): SeoMetadata | null {
  const cleanRoute = route.split('?')[0].replace(/\/$/, '') || '/tools/home';
  const catalogEntry = TOOL_SEO_CATALOG[cleanRoute];
  const override = SEO_OVERRIDES[cleanRoute];

  if (!catalogEntry && !override) {
    return generateFallbackSeoMetadata(cleanRoute);
  }

  const base = catalogEntry
    ? catalogEntryToMetadata(catalogEntry, cleanRoute)
    : generateFallbackSeoMetadata(cleanRoute);

  if (override) {
    return { ...base, ...override, url: cleanRoute };
  }

  return base;
}

/**
 * Get catalog entry for breadcrumb and structured data
 */
export function getToolSeoEntry(route: string): ToolSeoEntry | null {
  const cleanRoute = route.split('?')[0].replace(/\/$/, '') || '/tools/home';
  return TOOL_SEO_CATALOG[cleanRoute] ?? null;
}

function catalogEntryToMetadata(entry: ToolSeoEntry, route: string): SeoMetadata {
  return {
    title: entry.title,
    description: entry.description,
    keywords: entry.keywords,
    url: route,
    type: 'website',
  };
}

function generateFallbackSeoMetadata(route: string): SeoMetadata {
  const parts = route.split('/').filter(Boolean);
  const toolSlug = parts[parts.length - 1] || 'tool';
  const categorySlug = parts[parts.length - 2] || 'tools';

  const formattedToolName = toolSlug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const formattedCategory = categorySlug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    title: `${formattedToolName} - Free Online ${formattedCategory} Tool`,
    description: `Free online ${formattedToolName.toLowerCase()} tool. Fast, private ${formattedCategory.toLowerCase()} utility — runs in your browser on EasyToolHub.`,
    keywords: `${formattedToolName.toLowerCase()}, ${formattedCategory.toLowerCase()}, free online tool, easytoolhub`,
    url: route,
  };
}
