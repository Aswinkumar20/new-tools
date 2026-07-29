import type { IctToolSuggestion } from '../shared/ict-tool-suggestion.model';
import { ictFormatBytes } from '../shared/ict-format.util';
import {
  IMAGE_RESIZER_ERROR,
  IMAGE_RESIZER_HISTORY_LIMIT,
  IMAGE_RESIZER_MAX_DIMENSION,
  IMAGE_RESIZER_MAX_FILE_SIZE
} from '../constants/image-resizer.constants';
import type {
  ImageResizeOptions,
  ImageResizeResult,
  ImageResizerFormat,
  ImageResizerHistoryEntry,
  ImageResizerInterpolation
} from '../types/image-resizer.types';

export function validateImageResizerFile(file: File): string[] | null {
  if (!file.type.startsWith('image/')) {
    return [IMAGE_RESIZER_ERROR.invalidImage];
  }
  if (file.size > IMAGE_RESIZER_MAX_FILE_SIZE) {
    return [
      `File size ${ictFormatBytes(file.size)} exceeds the ${ictFormatBytes(IMAGE_RESIZER_MAX_FILE_SIZE)} limit.`,
      'Compress or resize externally before importing.'
    ];
  }
  return null;
}

/** Clamps dimensions the same way as the original getOptions implementation. */
export function buildImageResizeOptions(values: {
  width: number | null;
  height: number | null;
  keepAspect: boolean;
  interpolation: ImageResizerInterpolation;
  background: string | null;
  format: ImageResizerFormat;
  quality: number;
}): ImageResizeOptions {
  const { width, height, keepAspect, interpolation, background, format, quality } = values;
  const safeWidth = Math.min(Math.max(width ?? 0, 1), IMAGE_RESIZER_MAX_DIMENSION);
  const safeHeight = Math.min(Math.max(height ?? 0, 1), IMAGE_RESIZER_MAX_DIMENSION);
  return {
    width: safeWidth,
    height: safeHeight,
    keepAspect: !!keepAspect,
    interpolation,
    background: background?.trim() ? background : null,
    format,
    quality
  };
}

export function syncImageResizerAspect(
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

export function extensionForResizerFormat(format: ImageResizerFormat): string {
  if (format === 'image/jpeg') {
    return 'jpg';
  }
  if (format === 'image/webp') {
    return 'webp';
  }
  return 'png';
}

export function buildResizedFilename(
  originalName: string | null,
  width: number,
  height: number,
  format: ImageResizerFormat
): string {
  const base = originalName ? originalName.replace(/\.[^.]+$/, '') : 'resized-image';
  return `${base}-${width}x${height}.${extensionForResizerFormat(format)}`;
}

export function createImageResizerHistoryEntry(
  result: ImageResizeResult,
  now: (() => number) = Date.now
): ImageResizerHistoryEntry {
  return {
    timestamp: now(),
    name: result.originalName,
    originalDimensions: `${result.originalDimensions.width}×${result.originalDimensions.height}`,
    resizedDimensions: `${result.resizedDimensions.width}×${result.resizedDimensions.height}`,
    format: result.format,
    sizeDiff: `${ictFormatBytes(result.originalSize)} → ${ictFormatBytes(result.resizedSize)}`
  };
}

export function prependImageResizerHistory(
  entries: readonly ImageResizerHistoryEntry[],
  entry: ImageResizerHistoryEntry,
  limit: number = IMAGE_RESIZER_HISTORY_LIMIT
): ImageResizerHistoryEntry[] {
  return [entry, ...entries].slice(0, limit);
}

export function renderResizerCanvas(
  image: HTMLImageElement,
  options: ImageResizeOptions
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error(IMAGE_RESIZER_ERROR.contextFailed));
      return;
    }

    ctx.imageSmoothingEnabled = options.interpolation === 'smooth';
    ctx.imageSmoothingQuality = options.interpolation === 'smooth' ? 'high' : 'low';

    if (options.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    resolve(canvas);
  });
}

export function canvasToResizerBlob(
  canvas: HTMLCanvasElement,
  format: ImageResizerFormat,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, format, quality);
  });
}

export function resolveImageResizerSuggestion(options: {
  hasFile: boolean;
  hasResult: boolean;
  hasError: boolean;
  isOversizedHint: boolean;
  targetWidth: number | null;
  targetHeight: number | null;
  resizedWidth: number | null;
  resizedHeight: number | null;
}): IctToolSuggestion | null {
  const {
    hasFile,
    hasResult,
    hasError,
    isOversizedHint,
    targetWidth,
    targetHeight,
    resizedWidth,
    resizedHeight
  } = options;

  if (hasError && isOversizedHint) {
    return {
      id: 'ires-oversized',
      title: 'File is too large to import',
      reason:
        'This tool caps uploads at 35 MB. Shrink with Image Compressor first, then come back to set exact pixels.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (hasError && !hasFile) {
    return {
      id: 'ires-invalid',
      title: 'That file is not a usable image',
      reason:
        'Choose JPEG, PNG, WebP, or GIF. Drawing Pad can export a PNG if you need a fresh canvas.',
      actionLabel: 'Open Drawing Pad',
      path: '/image-color-tools/drawing-pad'
    };
  }

  if (!hasFile) {
    return {
      id: 'ires-start',
      title: 'Upload an image to resize',
      reason:
        'Drop a file or browse, then pick a preset (HD, social, favicon). Compress first if the file is huge.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (
    hasResult &&
    resizedWidth === 64 &&
    resizedHeight === 64
  ) {
    return {
      id: 'ires-favicon',
      title: 'Looks like a favicon size',
      reason:
        '64×64 is ideal for icons. Favicon Generator can package HTML tags and extra sizes.',
      actionLabel: 'Open Favicon Generator',
      path: '/image-color-tools/favicon-generator'
    };
  }

  if (
    hasResult &&
    resizedWidth !== null &&
    resizedHeight !== null &&
    resizedWidth * resizedHeight > 1_500_000
  ) {
    return {
      id: 'ires-compress-large',
      title: 'Large canvas — compress next?',
      reason:
        'High pixel counts keep files heavy. Image Compressor can cut bytes without changing dimensions again.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (hasResult) {
    return {
      id: 'ires-next',
      title: 'Resize complete — optimize or embed?',
      reason:
        'Image Compressor shrinks the download, or Image to Base64 embeds it in CSS/HTML.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (targetWidth && targetHeight) {
    return {
      id: 'ires-ready',
      title: 'Ready to resize',
      reason:
        'Hit Resize when dimensions look right. After export, Image Compressor is the usual next step.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  return {
    id: 'ires-dimensions',
    title: 'Set a target size',
    reason:
      'Enter width/height or tap a preset. Lock aspect ratio to keep proportions while you edit one side.',
    actionLabel: 'Open Image Compressor',
    path: '/image-color-tools/image-compressor'
  };
}
