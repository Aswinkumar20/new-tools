import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  IMAGE_EXTENSION_MIME_MAP,
  IMAGE_FILE_EXTENSIONS,
  IMAGE_LIMITED_BROWSER_SUPPORT_MIME_TYPES,
  IMAGE_MAX_FILE_SIZE_BYTES,
  IMAGE_MAX_ZOOM,
  IMAGE_MIN_ZOOM,
  IMAGE_SUPPORTED_MIME_TYPES,
  IMAGE_UNIVERSALLY_SUPPORTED_MIME_TYPES,
  IMAGE_VERIFY_TIMEOUT_MS,
  IMAGE_ZOOM_STEP
} from '../constants/image-viewer.constants';
import type { ImageFile, ImageValidationResult } from '../types/image-viewer.types';

export function getImageFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function getMimeTypeFromExtension(fileName: string): string {
  const extension = getImageFileExtension(fileName);
  return IMAGE_EXTENSION_MIME_MAP[extension] || 'application/octet-stream';
}

export function normalizeImageMimeType(mimeType: string, fileName: string): string {
  if (mimeType === 'image/jpg') {
    return 'image/jpeg';
  }
  if (mimeType === 'image/ico' || mimeType === 'image/vnd.microsoft.icon') {
    return 'image/x-icon';
  }
  if (mimeType === 'image/x-png') {
    return 'image/png';
  }
  if (mimeType === 'image/x-jpeg') {
    return 'image/jpeg';
  }
  if (
    mimeType === 'image/x-bmp' ||
    mimeType === 'image/x-windows-bmp' ||
    mimeType === 'image/x-ms-bmp'
  ) {
    return 'image/bmp';
  }

  if (!mimeType || mimeType === 'application/octet-stream') {
    return getMimeTypeFromExtension(fileName);
  }

  return mimeType;
}

export function isImageFileByExtension(
  fileName: string,
  extensions: ReadonlyArray<string> = IMAGE_FILE_EXTENSIONS
): boolean {
  return extensions.includes(getImageFileExtension(fileName));
}

export function isUniversallySupportedImageMime(mimeType: string): boolean {
  return IMAGE_UNIVERSALLY_SUPPORTED_MIME_TYPES.includes(mimeType);
}

export function isLimitedBrowserSupportImageMime(mimeType: string): boolean {
  return IMAGE_LIMITED_BROWSER_SUPPORT_MIME_TYPES.includes(mimeType);
}

export function validateImageFiles(
  files: ReadonlyArray<File>,
  options: {
    supportedFormats?: ReadonlyArray<string>;
    maxFileSize?: number;
  } = {}
): ImageValidationResult {
  const supportedFormats = options.supportedFormats ?? IMAGE_SUPPORTED_MIME_TYPES;
  const maxFileSize = options.maxFileSize ?? IMAGE_MAX_FILE_SIZE_BYTES;
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const fileType = file.type || getMimeTypeFromExtension(file.name);
    const normalizedType = normalizeImageMimeType(fileType, file.name);

    if (!supportedFormats.includes(normalizedType) && !isImageFileByExtension(file.name)) {
      errors.push(
        `${file.name}: Unsupported format. Please use standard image formats (PNG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF, etc.)`
      );
      continue;
    }

    if (file.size > maxFileSize) {
      errors.push(`${file.name}: File size exceeds 50MB limit`);
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
}

export function formatImageFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function formatImageMimeLabel(mimeType: string | undefined): string {
  if (!mimeType) {
    return '—';
  }
  return mimeType.replace('image/', '').toUpperCase() || '—';
}

export function clampImageZoom(level: number): number {
  return Math.max(IMAGE_MIN_ZOOM, Math.min(IMAGE_MAX_ZOOM, level));
}

export function stepImageZoom(current: number, direction: 1 | -1): number {
  return clampImageZoom(current + direction * IMAGE_ZOOM_STEP);
}

export function computeFitZoomPercent(
  naturalWidth: number,
  naturalHeight: number,
  availableWidth: number,
  availableHeight: number
): number {
  const widthRatio = availableWidth / naturalWidth;
  const heightRatio = availableHeight / naturalHeight;
  const fitRatio = Math.min(widthRatio, heightRatio, 1);
  return Math.max(IMAGE_MIN_ZOOM, Math.min(100, Math.round(fitRatio * 100)));
}

export function resolveNextImageIndexAfterRemoval(
  removedIndex: number,
  currentIndex: number,
  remainingCount: number
): number {
  if (remainingCount === 0) {
    return -1;
  }

  if (removedIndex === currentIndex) {
    if (removedIndex > 0) {
      return removedIndex - 1;
    }
    if (removedIndex < remainingCount) {
      return removedIndex;
    }
    return remainingCount - 1;
  }

  if (removedIndex < currentIndex) {
    return currentIndex - 1;
  }

  if (currentIndex >= remainingCount) {
    return remainingCount - 1;
  }

  return currentIndex;
}

export function isFullscreenActive(doc: Document = document): boolean {
  const extended = doc as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return !!(
    doc.fullscreenElement ||
    extended.webkitFullscreenElement ||
    extended.mozFullScreenElement ||
    extended.msFullscreenElement
  );
}

export function verifyImageCanLoad(
  url: string,
  imageFile: ImageFile,
  errors: string[],
  timeoutMs: number = IMAGE_VERIFY_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isResolved = false;

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };

    img.onload = () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve();
      }
    };

    img.onerror = () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        if (isLimitedBrowserSupportImageMime(imageFile.type)) {
          errors.push(
            `${imageFile.name}: Format ${imageFile.type} may not be supported by your browser. Try converting to PNG or JPEG.`
          );
        }
        reject(new Error(`Failed to load image: ${imageFile.name}`));
      }
    };

    img.src = url;

    timeoutId = globalThis.setTimeout(() => {
      if (!isResolved && !img.complete) {
        isResolved = true;
        cleanup();
        reject(new Error(`Image load timeout: ${imageFile.name}`));
      }
    }, timeoutMs);
  });
}

export function safeRevokeObjectUrl(url: string | undefined): void {
  if (!url?.startsWith('blob:')) {
    return;
  }
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore invalid object URLs during teardown
  }
}

export function resolveImageSuggestion(options: {
  hasImages: boolean;
  hasError: boolean;
  imageCount: number;
  currentMimeType: string;
  currentSize: number;
}): FvToolSuggestion | null {
  const { hasImages, hasError, imageCount, currentMimeType, currentSize } = options;

  if (hasError) {
    return {
      id: 'iv-meta',
      title: 'Check the file type?',
      reason:
        'Some files were rejected or failed to load. Confirm MIME type and extension before retrying.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasImages) {
    return {
      id: 'iv-compress',
      title: 'Need smaller uploads first?',
      reason:
        'Large photos load slower in galleries. Compress before previewing when you are preparing assets for the web.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (currentMimeType.includes('svg')) {
    return {
      id: 'iv-base64',
      title: 'Embed this SVG in code?',
      reason: 'SVGs often ship as data URIs. Convert to Base64 when you need inline CSS or HTML.',
      actionLabel: 'Open Image to Base64',
      path: '/image-color-tools/image-to-base64'
    };
  }

  if (currentSize > 2 * 1024 * 1024) {
    return {
      id: 'iv-compress-large',
      title: 'This image is fairly large',
      reason: 'Files over 2MB benefit from compression before sharing or uploading to a CMS.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (imageCount > 1) {
    return {
      id: 'iv-pdf',
      title: 'Turn this gallery into a PDF?',
      reason: 'Multi-image reviews often need a printable pack. Export the set with Image to PDF.',
      actionLabel: 'Open Image to PDF',
      path: '/pdf-tools/image-to-pdf'
    };
  }

  return {
    id: 'iv-resize',
    title: 'Export exact dimensions?',
    reason: 'After inspecting the photo, resize to production widths for web or social layouts.',
    actionLabel: 'Open Image Resizer',
    path: '/image-color-tools/image-resizer'
  };
}
