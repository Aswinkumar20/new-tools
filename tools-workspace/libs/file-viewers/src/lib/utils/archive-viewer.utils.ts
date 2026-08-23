import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  ARCHIVE_FILE_ICON_MAP,
  ARCHIVE_FULLY_SUPPORTED_EXTENSION,
  ARCHIVE_IMAGE_EXTENSIONS,
  ARCHIVE_SUPPORTED_EXTENSIONS,
  ARCHIVE_TEXT_EXTENSIONS
} from '../constants/archive-viewer.constants';
import type {
  ArchiveFile,
  ArchiveInfo,
  ArchivePreviewType,
  ArchiveTreeBuildResult,
  JSZipConstructor,
  JSZipFile,
  JSZipInstance
} from '../types/archive-viewer.types';

export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) {
    return '';
  }
  return `.${parts.pop()?.toLowerCase() ?? ''}`;
}

export function getBaseExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function isSupportedArchiveFile(
  file: Pick<File, 'name' | 'type'>,
  extensions: ReadonlyArray<string> = ARCHIVE_SUPPORTED_EXTENSIONS
): boolean {
  const ext = getFileExtension(file.name);
  return (
    extensions.includes(ext) ||
    file.type.includes('zip') ||
    file.type.includes('archive') ||
    file.type.includes('compressed')
  );
}

export function filterValidArchiveFiles(files: ReadonlyArray<File>): File[] {
  return files.filter((file) => isSupportedArchiveFile(file));
}

export function isFullySupportedArchiveExtension(ext: string): boolean {
  return ext === ARCHIVE_FULLY_SUPPORTED_EXTENSION;
}

export function detectPreviewType(fileName: string): Exclude<ArchivePreviewType, 'none'> {
  const ext = getBaseExtension(fileName);
  if (ARCHIVE_IMAGE_EXTENSIONS.includes(ext)) {
    return 'image';
  }
  if (ARCHIVE_TEXT_EXTENSIONS.includes(ext)) {
    return 'text';
  }
  return 'binary';
}

export function formatArchiveFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getArchiveFileIcon(file: Pick<ArchiveFile, 'isDirectory' | 'name'>): string {
  if (file.isDirectory) {
    return '📁';
  }
  const ext = getBaseExtension(file.name);
  return ARCHIVE_FILE_ICON_MAP[ext] || '📄';
}

export function sortArchiveFiles(files: ArchiveFile[]): ArchiveFile[] {
  return files
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })
    .map((file) => {
      if (file.children) {
        file.children = sortArchiveFiles(file.children);
      }
      return file;
    });
}

export function findArchiveFileByPath(files: ArchiveFile[], path: string): ArchiveFile | null {
  for (const file of files) {
    if (file.path === path) {
      return file;
    }
    if (file.children) {
      const found = findArchiveFileByPath(file.children, path);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function readZipEntrySizes(file: JSZipFile): { size: number; compressedSize: number } {
  const data = (file as JSZipFile & { _data?: { uncompressedSize?: number; compressedSize?: number } })
    ._data;
  return {
    size: data?.uncompressedSize || 0,
    compressedSize: data?.compressedSize || 0
  };
}

/** Builds a sorted directory tree from a JSZip instance (preserves prior nesting logic). */
export function buildArchiveFileTree(zip: JSZipInstance): ArchiveTreeBuildResult {
  const rootFiles: ArchiveFile[] = [];
  const fileMap = new Map<string, ArchiveFile>();
  const flatList: ArchiveFile[] = [];

  zip.forEach((relativePath, file) => {
    const pathParts = relativePath.split('/').filter((part) => part);
    const isDirectory = relativePath.endsWith('/');
    const name = pathParts[pathParts.length - 1] || relativePath;
    const sizes = isDirectory ? { size: 0, compressedSize: 0 } : readZipEntrySizes(file);

    const archiveFile: ArchiveFile = {
      name,
      path: relativePath,
      size: sizes.size,
      compressedSize: sizes.compressedSize,
      isDirectory,
      date: file.date || new Date(),
      level: pathParts.length - 1,
      expanded: false,
      children: []
    };

    flatList.push(archiveFile);
    fileMap.set(relativePath, archiveFile);

    if (isDirectory) {
      return;
    }

    const parentPath = pathParts.slice(0, -1).join('/') + '/';
    if (parentPath === '/') {
      rootFiles.push(archiveFile);
      return;
    }

    const parent = fileMap.get(parentPath);
    if (parent) {
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(archiveFile);
      archiveFile.parent = parent;
      return;
    }

    let currentPath = '';
    for (let i = 0; i < pathParts.length - 1; i++) {
      currentPath += pathParts[i] + '/';
      if (!fileMap.has(currentPath)) {
        const dir: ArchiveFile = {
          name: pathParts[i],
          path: currentPath,
          size: 0,
          compressedSize: 0,
          isDirectory: true,
          date: new Date(),
          level: i,
          expanded: false,
          children: []
        };
        fileMap.set(currentPath, dir);
        flatList.push(dir);

        if (i > 0) {
          const ancestorPath = pathParts.slice(0, i).join('/') + '/';
          const ancestor = fileMap.get(ancestorPath);
          if (ancestor?.children) {
            ancestor.children.push(dir);
            dir.parent = ancestor;
          }
        }
      }
    }

    const finalParent = fileMap.get(currentPath);
    if (finalParent?.children) {
      finalParent.children.push(archiveFile);
      archiveFile.parent = finalParent;
    }
  });

  const roots: ArchiveFile[] = [];
  fileMap.forEach((file) => {
    if (file.level === 0) {
      roots.push(file);
    }
  });

  return {
    roots: sortArchiveFiles(roots),
    flatList
  };
}

export function isPasswordRequiredError(error: unknown): boolean {
  return error instanceof Error && !!error.message && error.message.includes('password');
}

export async function loadJSZipLibrary(): Promise<JSZipConstructor> {
  if (globalThis.window === undefined) {
    throw new TypeError('JSZip can only be loaded in browser environment');
  }

  const jszipMod = await import('jszip');
  const JSZipLib = (jszipMod.default ?? jszipMod) as unknown as JSZipConstructor;
  if (!JSZipLib) {
    throw new Error('Failed to load JSZip library');
  }
  return JSZipLib;
}

export function resolveArchiveSuggestion(options: {
  hasArchives: boolean;
  unsupportedFormatMessage: boolean;
  previewType: ArchivePreviewType;
  selectedFileName: string;
  hasCopiedPreview: boolean;
}): FvToolSuggestion | null {
  const { hasArchives, unsupportedFormatMessage, previewType, selectedFileName, hasCopiedPreview } =
    options;

  if (unsupportedFormatMessage) {
    return {
      id: 'av-zip-only',
      title: 'Need a ZIP instead?',
      reason:
        'Full browser unpacking currently works best with ZIP. Convert or re-pack as ZIP, or inspect the file’s metadata first.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (hasCopiedPreview || previewType === 'text') {
    const ext = getBaseExtension(selectedFileName);
    if (ext === 'json' || selectedFileName.toLowerCase().endsWith('.json')) {
      return {
        id: 'av-json',
        title: 'Validate this JSON payload?',
        reason: 'The preview looks like JSON. Beautify and lint it in the JSON Formatter.',
        actionLabel: 'Open JSON Formatter',
        path: '/data-converters/json-formatter-beautifier-validator'
      };
    }
    if (previewType === 'text' || hasCopiedPreview) {
      return {
        id: 'av-text',
        title: 'Open in Text File Viewer?',
        reason: 'Richer line navigation and search are available once you leave the inline preview.',
        actionLabel: 'Open Text File Viewer',
        path: '/file-viewers/text-file-viewer'
      };
    }
  }

  if (previewType === 'image') {
    return {
      id: 'av-image',
      title: 'Inspect this image in Image Viewer?',
      reason: 'Zoom, pan, and compare textures more comfortably outside the archive pane.',
      actionLabel: 'Open Image Viewer',
      path: '/file-viewers/image-viewer'
    };
  }

  const modelExt = getBaseExtension(selectedFileName);
  if (['gltf', 'glb', 'obj', 'stl', 'fbx'].includes(modelExt)) {
    return {
      id: 'av-3d',
      title: 'Preview this 3D asset next?',
      reason: 'Model files inside archives can be inspected in the 3D Model Viewer once it launches.',
      actionLabel: 'Open 3D Model Viewer',
      path: '/file-viewers/3d-model-viewer'
    };
  }

  if (!hasArchives) {
    return {
      id: 'av-meta',
      title: 'Check archive metadata first?',
      reason: 'Confirm MIME type and size for unusual extensions before uploading a large archive.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  return null;
}

export function createPasswordPendingArchive(file: File, ext: string): ArchiveInfo {
  return {
    name: file.name,
    file,
    size: file.size,
    format: ext,
    totalFiles: 0,
    totalSize: 0,
    compressedSize: 0,
    passwordProtected: true,
    loaded: false
  };
}
