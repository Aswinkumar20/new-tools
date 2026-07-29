import type { IctToolSuggestion } from '../shared/ict-tool-suggestion.model';
import { ictFormatBytes } from '../shared/ict-format.util';
import {
  IMAGE_COMPRESSOR_ERROR,
  IMAGE_COMPRESSOR_HISTORY_LIMIT,
  IMAGE_COMPRESSOR_MAX_FILE_SIZE
} from '../constants/image-compressor.constants';
import type {
  ImageCompressionOptions,
  ImageCompressionResult,
  ImageCompressorFormat,
  ImageCompressorHistoryEntry
} from '../types/image-compressor.types';

export function validateImageCompressorFile(file: File): string[] | null {
  if (!file.type.startsWith('image/')) {
    return [IMAGE_COMPRESSOR_ERROR.invalidImage];
  }
  if (file.size > IMAGE_COMPRESSOR_MAX_FILE_SIZE) {
    return [
      `File size ${ictFormatBytes(file.size)} exceeds the ${ictFormatBytes(IMAGE_COMPRESSOR_MAX_FILE_SIZE)} limit.`,
      'Compress or resize externally before importing.'
    ];
  }
  return null;
}

export function buildImageCompressorOptions(
  image: HTMLImageElement,
  values: {
    quality: number;
    format: ImageCompressorFormat;
    resizeWidth: number | null;
    resizeHeight: number | null;
    keepAspect: boolean;
    stripMetadata: boolean;
  }
): { options: ImageCompressionOptions | null; error: string | null } {
  const { quality, format, resizeWidth, resizeHeight, keepAspect, stripMetadata } = values;

  if (quality <= 0 || quality > 1) {
    return { options: null, error: IMAGE_COMPRESSOR_ERROR.qualityRange };
  }

  const targetWidth = resizeWidth ?? image.naturalWidth;
  const targetHeight = resizeHeight ?? image.naturalHeight;
  if (targetWidth <= 0 || targetHeight <= 0) {
    return { options: null, error: IMAGE_COMPRESSOR_ERROR.invalidDimensions };
  }

  return {
    options: {
      quality,
      format,
      resizeWidth: targetWidth,
      resizeHeight: targetHeight,
      keepAspect,
      stripMetadata
    },
    error: null
  };
}

export function syncImageCompressorAspect(
  source: 'width' | 'height',
  naturalWidth: number,
  naturalHeight: number,
  width: number | null,
  height: number | null
): { width: number | null; height: number | null } {
  const originalAspect = naturalWidth / naturalHeight;
  if (source === 'width') {
    if (!width) {
      return { width, height };
    }
    return { width, height: Math.round(width / originalAspect) };
  }
  if (!height) {
    return { width, height };
  }
  return { width: Math.round(height * originalAspect), height };
}

export function extensionForCompressorFormat(format: ImageCompressorFormat): string {
  if (format === 'image/jpeg') {
    return 'jpg';
  }
  if (format === 'image/webp') {
    return 'webp';
  }
  return 'png';
}

export function buildCompressedFilename(
  originalName: string | null,
  format: ImageCompressorFormat
): string {
  const base = originalName ? originalName.replace(/\.[^.]+$/, '') : 'compressed-image';
  return `${base}.${extensionForCompressorFormat(format)}`;
}

export function createImageCompressorHistoryEntry(
  result: ImageCompressionResult,
  now: (() => number) = Date.now
): ImageCompressorHistoryEntry {
  return {
    timestamp: now(),
    name: result.originalName,
    format: result.format,
    sizes: `${ictFormatBytes(result.originalSize)} → ${ictFormatBytes(result.compressedSize)}`,
    dimensions: `${result.originalDimensions.width}×${result.originalDimensions.height} → ${result.compressedDimensions.width}×${result.compressedDimensions.height}`
  };
}

export function prependImageCompressorHistory(
  entries: readonly ImageCompressorHistoryEntry[],
  entry: ImageCompressorHistoryEntry,
  limit: number = IMAGE_COMPRESSOR_HISTORY_LIMIT
): ImageCompressorHistoryEntry[] {
  return [entry, ...entries].slice(0, limit);
}

export function renderCompressorCanvas(
  image: HTMLImageElement,
  options: ImageCompressionOptions
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const targetWidth = options.resizeWidth ?? image.naturalWidth;
    const targetHeight = options.resizeHeight ?? image.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error(IMAGE_COMPRESSOR_ERROR.contextFailed));
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    resolve(canvas);
  });
}

export function canvasToCompressorBlob(
  canvas: HTMLCanvasElement,
  format: ImageCompressorFormat,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, format, quality);
  });
}

export function resolveImageCompressorSuggestion(options: {
  hasFile: boolean;
  hasResult: boolean;
  hasError: boolean;
  reduction: number | null;
  format: ImageCompressorFormat | null;
  isOversizedHint: boolean;
}): IctToolSuggestion | null {
  const { hasFile, hasResult, hasError, reduction, format, isOversizedHint } = options;

  if (hasError && isOversizedHint) {
    return {
      id: 'icomp-oversized',
      title: 'File is too large to import',
      reason:
        'This tool caps uploads at 45 MB. Shrink dimensions in Image Resizer first, then compress here.',
      actionLabel: 'Open Image Resizer',
      path: '/image-color-tools/image-resizer'
    };
  }

  if (hasError && !hasFile) {
    return {
      id: 'icomp-invalid',
      title: 'That file is not a usable image',
      reason:
        'Choose a common image type (JPEG, PNG, WebP, GIF). Drawing Pad can export a PNG if you need a fresh asset.',
      actionLabel: 'Open Drawing Pad',
      path: '/image-color-tools/drawing-pad'
    };
  }

  if (!hasFile) {
    return {
      id: 'icomp-start',
      title: 'Upload an image to compress',
      reason:
        'Drag a file onto the panel or browse. Image Resizer helps when you need exact pixel dimensions first.',
      actionLabel: 'Open Image Resizer',
      path: '/image-color-tools/image-resizer'
    };
  }

  if (hasResult && reduction !== null && reduction >= 0.95) {
    return {
      id: 'icomp-little-gain',
      title: 'Little size reduction this round',
      reason:
        'Try a lower quality preset or WebP. Image Resizer can cut pixels before another compress pass.',
      actionLabel: 'Open Image Resizer',
      path: '/image-color-tools/image-resizer'
    };
  }

  if (hasResult && format === 'image/png') {
    return {
      id: 'icomp-png-webp',
      title: 'PNG stayed large?',
      reason:
        'PNG is lossless. Switch to WebP/JPEG for photos, or embed a small PNG via Image to Base64.',
      actionLabel: 'Open Image to Base64',
      path: '/image-color-tools/image-to-base64'
    };
  }

  if (hasResult) {
    return {
      id: 'icomp-next',
      title: 'Use the compressed file next',
      reason:
        'Image to Base64 embeds it in CSS/HTML, or Favicon Generator builds icons from a small asset.',
      actionLabel: 'Open Image to Base64',
      path: '/image-color-tools/image-to-base64'
    };
  }

  return {
    id: 'icomp-ready',
    title: 'Ready to compress',
    reason:
      'Tune quality or apply a preset, then Compress. Related tools help with resize and embedding.',
    actionLabel: 'Open Image Resizer',
    path: '/image-color-tools/image-resizer'
  };
}
