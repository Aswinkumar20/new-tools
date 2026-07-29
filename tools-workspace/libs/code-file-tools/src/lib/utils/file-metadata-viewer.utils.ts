import type { CftToolSuggestion } from '../shared/cft-tool-suggestion.model';
import {
  FILE_METADATA_ADDITIONAL_INFO_LABELS,
  FILE_METADATA_DEFAULT_ICON,
  FILE_METADATA_ICONS_BY_EXTENSION,
  FILE_METADATA_MIME_BY_EXTENSION,
  FILE_METADATA_SIZE_UNITS
} from '../constants/file-metadata-viewer.constants';
import type {
  FileAdditionalInfo,
  FileAdditionalInfoItem,
  FileDimensions,
  FileMetadata
} from '../types/file-metadata-viewer.types';

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function getMimeTypeFromExtension(extension: string): string {
  return FILE_METADATA_MIME_BY_EXTENSION[extension] || 'application/octet-stream';
}

export function formatFileMetadataSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    FILE_METADATA_SIZE_UNITS.length - 1
  );
  const scaled = bytes / Math.pow(1024, exponent);
  return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${FILE_METADATA_SIZE_UNITS[exponent]}`;
}

export function formatFileMetadataDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp));
}

export function getFileTypeLabel(mimeType: string): string {
  if (!mimeType || mimeType === 'application/octet-stream') {
    return 'Unknown';
  }
  const parts = mimeType.split('/');
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}

export function getFileIcon(extension: string): string {
  return FILE_METADATA_ICONS_BY_EXTENSION[extension] || FILE_METADATA_DEFAULT_ICON;
}

export function getAdditionalInfoItems(
  additionalInfo: FileAdditionalInfo
): FileAdditionalInfoItem[] {
  return Object.entries(additionalInfo).map(([key, value]) => ({
    key,
    label:
      FILE_METADATA_ADDITIONAL_INFO_LABELS[key] ||
      key.charAt(0).toUpperCase() + key.slice(1),
    value: String(value)
  }));
}

export function formatFileMetadataText(file: FileMetadata): string {
  const lines = [
    `Name: ${file.name}`,
    `Size: ${formatFileMetadataSize(file.size)}`,
    `Type: ${getFileTypeLabel(file.mimeType)}`,
    `MIME: ${file.mimeType}`,
    `Extension: ${file.extension || 'None'}`,
    `Last modified: ${formatFileMetadataDate(file.lastModified)}`
  ];

  if (file.dimensions) {
    lines.push(`Dimensions: ${file.dimensions.width} × ${file.dimensions.height} px`);
  }

  if (file.additionalInfo) {
    for (const item of getAdditionalInfoItems(file.additionalInfo)) {
      lines.push(`${item.label}: ${item.value}`);
    }
  }

  return lines.join('\n');
}

export function getImageDimensions(file: File): Promise<FileDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to create preview'));
    reader.readAsDataURL(file);
  });
}

export async function extractTextAdditionalInfo(file: File): Promise<FileAdditionalInfo> {
  const text =
    typeof file.text === 'function'
      ? await file.text()
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = () => reject(new Error('Failed to read text file'));
          reader.readAsText(file);
        });

  return {
    lines: text.split('\n').length,
    characters: text.length,
    words: text.trim() ? text.trim().split(/\s+/).length : 0
  };
}

export async function extractFileMetadata(file: File): Promise<FileMetadata> {
  const extension = getFileExtension(file.name);
  const metadata: FileMetadata = {
    file,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    lastModified: file.lastModified,
    extension,
    mimeType: file.type || getMimeTypeFromExtension(extension),
    additionalInfo: {}
  };

  if (file.type.startsWith('image/')) {
    try {
      const dimensions = await getImageDimensions(file);
      metadata.dimensions = dimensions;
      metadata.preview = await createImagePreview(file);
    } catch {
      // Ignore image processing errors
    }
  }

  if (file.type.startsWith('text/') || file.type === 'application/json') {
    try {
      metadata.additionalInfo = await extractTextAdditionalInfo(file);
    } catch {
      // Ignore text reading errors
    }
  }

  return metadata;
}

export function resolveFileMetadataSuggestion(
  selected: FileMetadata | null,
  fileCount: number
): CftToolSuggestion | null {
  if (fileCount === 0 || !selected) {
    return {
      id: 'empty-files',
      title: 'Upload a file to inspect',
      reason:
        'Drop images, PDFs, or text assets here. After inspection, related tools can encode, resize, or hash the same file type.',
      actionLabel: 'Open Hash Generator',
      path: '/security-tools/hash-generator'
    };
  }

  if (selected.mimeType.startsWith('image/') || selected.dimensions) {
    return {
      id: 'image-file',
      title: 'Image file selected',
      reason:
        'Convert to Base64 for embeds, or resize using the detected dimensions in Image Resizer.',
      actionLabel: 'Open Image to Base64',
      path: '/image-color-tools/image-to-base64'
    };
  }

  if (selected.mimeType === 'application/pdf' || selected.extension === 'pdf') {
    return {
      id: 'pdf-file',
      title: 'PDF file selected',
      reason:
        'This viewer shows browser File metadata. PDF Metadata Editor can inspect and edit document properties next.',
      actionLabel: 'Open PDF Metadata Editor',
      path: '/pdf-tools/pdf-metadata-editor'
    };
  }

  if (
    selected.mimeType === 'text/css' ||
    selected.extension === 'css' ||
    selected.mimeType === 'text/html' ||
    selected.extension === 'html'
  ) {
    return {
      id: 'web-source',
      title: 'Web source file selected',
      reason:
        'After reviewing size and line counts, minify CSS or HTML to reduce transfer size.',
      actionLabel: 'Open CSS Minifier',
      path: '/code-file-tools/css-minifier'
    };
  }

  if (
    selected.mimeType === 'application/json' ||
    selected.extension === 'json' ||
    selected.mimeType.startsWith('text/')
  ) {
    return {
      id: 'text-file',
      title: 'Text file selected',
      reason:
        'Generate a checksum for integrity checks, or continue with formatting tools for structured text.',
      actionLabel: 'Open Hash Generator',
      path: '/security-tools/hash-generator'
    };
  }

  return {
    id: 'pair-hash',
    title: 'Verify file integrity next',
    reason:
      'Metadata alone does not prove the file is unchanged. Hash Generator can compute checksums locally.',
    actionLabel: 'Open Hash Generator',
    path: '/security-tools/hash-generator'
  };
}
