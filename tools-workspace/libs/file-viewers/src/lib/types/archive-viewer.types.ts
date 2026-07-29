export interface JSZipConstructor {
  new (): JSZipInstance;
  loadAsync(
    data: ArrayBuffer | Uint8Array | string,
    options?: { base64?: boolean; checkCRC32?: boolean; password?: string }
  ): Promise<JSZipInstance>;
}

export interface JSZipInstance {
  files: { [path: string]: JSZipFile };
  forEach(callback: (relativePath: string, file: JSZipFile) => void): void;
  file(name: string): JSZipFile | null;
  folder(name?: string): JSZipObject | null;
  generateAsync(options?: {
    type?: string;
    compression?: string;
    compressionOptions?: unknown;
    password?: string;
  }): Promise<Blob>;
}

export interface JSZipFile {
  name: string;
  dir: boolean;
  date: Date;
  comment: string;
  unixPermissions: number;
  dosPermissions: number;
  async(type: string, options?: { base64?: boolean; password?: string }): Promise<unknown>;
  async(type: 'string'): Promise<string>;
  async(type: 'text'): Promise<string>;
  async(type: 'blob'): Promise<Blob>;
  async(type: 'arraybuffer'): Promise<ArrayBuffer>;
  async(type: 'uint8array'): Promise<Uint8Array>;
}

export interface JSZipObject {
  files: { [path: string]: JSZipFile };
  folders: { [path: string]: JSZipObject };
}

export interface ArchiveFile {
  name: string;
  path: string;
  size: number;
  compressedSize: number;
  isDirectory: boolean;
  date: Date;
  children?: ArchiveFile[];
  parent?: ArchiveFile;
  level: number;
  expanded?: boolean;
}

export interface ArchiveInfo {
  name: string;
  file: File;
  size: number;
  format: string;
  totalFiles: number;
  totalSize: number;
  compressedSize: number;
  passwordProtected: boolean;
  loaded: boolean;
}

export type ArchivePreviewType = 'text' | 'image' | 'binary' | 'none';

export interface ArchiveTreeBuildResult {
  roots: ArchiveFile[];
  flatList: ArchiveFile[];
}
