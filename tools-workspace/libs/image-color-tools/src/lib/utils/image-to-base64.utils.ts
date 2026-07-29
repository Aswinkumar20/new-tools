import type { IctToolSuggestion } from '../shared/ict-tool-suggestion.model';
import { ictFormatBytes } from '../shared/ict-format.util';
import {
  IMAGE_TO_BASE64_FALLBACK_EXTENSIONS,
  IMAGE_TO_BASE64_HISTORY_LIMIT,
  IMAGE_TO_BASE64_MAX_FILE_SIZE,
  IMAGE_TO_BASE64_MIN_CHUNK_SIZE
} from '../constants/image-to-base64.constants';
import type {
  ImageToBase64BuiltPayload,
  ImageToBase64ConversionOptions,
  ImageToBase64HistoryEntry,
  ImageToBase64OutputFormat
} from '../types/image-to-base64.types';

export function wrapBase64Text(value: string, width: number | null): string {
  if (!width || width <= 0) {
    return value;
  }
  let output = '';
  for (let index = 0; index < value.length; index += width) {
    output += value.slice(index, index + width);
    if (index + width < value.length) {
      output += '\n';
    }
  }
  return output;
}

export function chunkBase64String(value: string, size: number): string[] {
  if (size <= 0) {
    return [value];
  }
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks;
}

export function toBase64Url(value: string): string {
  return value
    .split('+')
    .join('-')
    .split('/')
    .join('_')
    .replace(/=+$/, '');
}

/** Convert bytes to Base64 via btoa (Latin1 code points 0–255). */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
  return btoa(binary);
}

export function validateImageToBase64File(file: File): {
  errors: string[] | null;
  warnings: string[];
  isOversized: boolean;
} {
  const mimeType = file.type ?? '';
  const isImageMime = mimeType.startsWith('image/');
  const extension = (file.name?.split('.').pop() ?? '').toLowerCase();
  const isKnownExtension = extension ? IMAGE_TO_BASE64_FALLBACK_EXTENSIONS.has(extension) : false;
  const warnings: string[] = [];

  if (!isImageMime && !isKnownExtension) {
    return {
      errors: [
        `Unsupported file type: ${mimeType || extension || 'unknown'}.`,
        'Only image files are supported. Please choose a file with an image MIME type or a common image extension.'
      ],
      warnings,
      isOversized: false
    };
  }

  if (!isImageMime && isKnownExtension) {
    warnings.push(`File lacks an image MIME type. Proceeding based on extension ".${extension}".`);
  }

  if (file.size > IMAGE_TO_BASE64_MAX_FILE_SIZE) {
    return {
      errors: [
        `File size ${ictFormatBytes(file.size)} exceeds the ${ictFormatBytes(IMAGE_TO_BASE64_MAX_FILE_SIZE)} limit.`,
        'Consider compressing the image or using an external optimizer before conversion.'
      ],
      warnings,
      isOversized: true
    };
  }

  return { errors: null, warnings, isOversized: false };
}

export function buildImageToBase64Payload(
  file: File,
  base64: string,
  options: ImageToBase64ConversionOptions
): ImageToBase64BuiltPayload {
  const { outputFormat, wrapWidth, includeMime, chunkSize } = options;
  const encoded = outputFormat === 'base64url' ? toBase64Url(base64) : base64;
  const wrapped = wrapBase64Text(encoded, wrapWidth ?? null);
  const shouldPrefix = includeMime && outputFormat === 'base64';
  const dataUri = shouldPrefix ? `data:${file.type};base64,${encoded}` : encoded;
  const textPreview = outputFormat === 'text' ? encoded : wrapped;
  const encodedBytes = new Blob([textPreview]).size;

  return {
    dataUri,
    textPreview,
    size: file.size,
    encodedSize: encodedBytes,
    compressionRatio: encodedBytes / file.size,
    filename: file.name || null,
    mime: file.type,
    outputFormat,
    chunks: chunkBase64String(encoded, Math.max(chunkSize, IMAGE_TO_BASE64_MIN_CHUNK_SIZE))
  };
}

export function buildEncodedDownloadFilename(
  filename: string | null,
  outputFormat: ImageToBase64OutputFormat
): string {
  const base = filename ?? 'image';
  const extension = outputFormat === 'text' ? 'txt' : 'base64.txt';
  return `${base}.${extension}`;
}

export function createImageToBase64HistoryEntry(
  payload: Pick<
    ImageToBase64BuiltPayload,
    'filename' | 'size' | 'mime' | 'outputFormat' | 'encodedSize'
  >,
  now: (() => number) = Date.now
): ImageToBase64HistoryEntry {
  return {
    timestamp: now(),
    filename: payload.filename,
    size: payload.size,
    mime: payload.mime,
    format: payload.outputFormat,
    encodedLength: payload.encodedSize
  };
}

export function prependImageToBase64History(
  entries: readonly ImageToBase64HistoryEntry[],
  entry: ImageToBase64HistoryEntry,
  limit: number = IMAGE_TO_BASE64_HISTORY_LIMIT
): ImageToBase64HistoryEntry[] {
  return [entry, ...entries].slice(0, limit);
}

export function resolveImageToBase64Suggestion(options: {
  hasFile: boolean;
  hasResult: boolean;
  hasError: boolean;
  isOversizedHint: boolean;
  encodedSize: number | null;
  outputFormat: ImageToBase64OutputFormat | null;
}): IctToolSuggestion | null {
  const { hasFile, hasResult, hasError, isOversizedHint, encodedSize, outputFormat } = options;

  if (hasError && isOversizedHint) {
    return {
      id: 'itb-oversized',
      title: 'Image is too large to encode here',
      reason:
        'Uploads cap at 25 MB. Compress or resize first so the Base64 string stays manageable for CSS/HTML.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (hasError && !hasFile) {
    return {
      id: 'itb-invalid',
      title: 'That file is not recognized as an image',
      reason:
        'Use a common image type, or export a PNG from Drawing Pad if you need a fresh asset.',
      actionLabel: 'Open Drawing Pad',
      path: '/image-color-tools/drawing-pad'
    };
  }

  if (!hasFile) {
    return {
      id: 'itb-start',
      title: 'Upload an image to encode',
      reason:
        'Drop a file to generate Base64 / data URI output. Smaller assets embed more cleanly—compress first if needed.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (hasResult && encodedSize !== null && encodedSize > 500_000) {
    return {
      id: 'itb-large-output',
      title: 'Encoded output is quite large',
      reason:
        'Huge data URIs can slow pages. Resize or compress the source, then re-encode for a lighter embed.',
      actionLabel: 'Open Image Resizer',
      path: '/image-color-tools/image-resizer'
    };
  }

  if (hasResult && outputFormat === 'base64url') {
    return {
      id: 'itb-url-safe',
      title: 'Using URL-safe Base64',
      reason:
        'Great for tokens and query params. For CSS background images, switch to Base64 with MIME prefix.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (hasResult) {
    return {
      id: 'itb-next',
      title: 'Ready to embed',
      reason:
        'Copy the data URI into CSS/HTML, or build a tiny favicon first if you only need an icon-sized asset.',
      actionLabel: 'Open Favicon Generator',
      path: '/image-color-tools/favicon-generator'
    };
  }

  return {
    id: 'itb-ready',
    title: 'Encoding in progress',
    reason:
      'Tune wrap width and MIME prefix in Options. Compress first when you care about payload size.',
    actionLabel: 'Open Image Compressor',
    path: '/image-color-tools/image-compressor'
  };
}
