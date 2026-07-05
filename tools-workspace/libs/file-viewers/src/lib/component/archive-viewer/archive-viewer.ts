import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  HostListener,
  PLATFORM_ID,
  Inject,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

// JSZip types
interface JSZip {
  new (): JSZipInstance;
  loadAsync(data: ArrayBuffer | Uint8Array | string, options?: { base64?: boolean; checkCRC32?: boolean; password?: string }): Promise<JSZipInstance>;
}

interface JSZipInstance {
  files: { [path: string]: JSZipFile };
  forEach(callback: (relativePath: string, file: JSZipFile) => void): void;
  file(name: string): JSZipFile | null;
  folder(name?: string): JSZipObject | null;
  generateAsync(options?: { type?: string; compression?: string; compressionOptions?: any; password?: string }): Promise<Blob>;
}

interface JSZipFile {
  name: string;
  dir: boolean;
  date: Date;
  comment: string;
  unixPermissions: number;
  dosPermissions: number;
  async(type: string, options?: { base64?: boolean; password?: string }): Promise<any>;
  async(type: 'string'): Promise<string>;
  async(type: 'text'): Promise<string>;
  async(type: 'blob'): Promise<Blob>;
  async(type: 'arraybuffer'): Promise<ArrayBuffer>;
  async(type: 'uint8array'): Promise<Uint8Array>;
}

interface JSZipObject {
  files: { [path: string]: JSZipFile };
  folders: { [path: string]: JSZipObject };
}

// Load JSZip dynamically from CDN
async function loadJSZip(): Promise<JSZip> {
  if (globalThis.window === undefined) {
    throw new TypeError('JSZip can only be loaded in browser environment');
  }

  if ((globalThis as any).JSZip) {
    return (globalThis as any).JSZip;
  }

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const JSZipLib = (globalThis as any).JSZip;
      resolve(new JSZipLib());
    };
    script.onerror = () => reject(new Error('Failed to load JSZip library'));
  });
}

interface ArchiveFile {
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

interface ArchiveInfo {
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

@Component({
  selector: 'lib-archive-viewer',
  standalone: true,
  templateUrl: './archive-viewer.html',
  styleUrls: ['./archive-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective]
})
export class ArchiveViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('previewContainer') previewContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fileTree') fileTree!: ElementRef<HTMLDivElement>;

  archiveFiles: ArchiveInfo[] = [];
  currentArchiveIndex: number = -1;
  fileTreeData: ArchiveFile[] = [];
  flatFileList: ArchiveFile[] = [];
  selectedFile: ArchiveFile | null = null;
  previewContent: string = '';
  previewType: 'text' | 'image' | 'binary' | 'none' = 'none';
  previewFileName: string = '';
  
  loading: boolean = false;
  loadingProgress: number = 0;
  errorMessage: string = '';
  showDropZone: boolean = false;
  showAbout: boolean = false;
  showPasswordDialog: boolean = false;
  passwordInput: string = '';
  passwordError: string = '';
  passwordForArchive: ArchiveInfo | null = null;
  
  searchText: string = '';
  expandedPaths: Set<string> = new Set();
  selectedPath: string = '';
  
  private JSZipLib: JSZip | null = null;
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly supportedFormats = [
    '.zip',
    '.rar',
    '.7z',
    '.tar',
    '.gz',
    '.bz2',
    '.xz',
    '.z',
    '.cab',
    '.iso',
    '.apk',
    '.jar',
    '.war',
    '.ear'
  ];

  constructor(
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      loadJSZip()
        .then(lib => {
          this.JSZipLib = lib;
        })
        .catch(err => {
          console.error('Failed to load JSZip:', err);
          this.errorMessage = 'Failed to load archive processing library. Please refresh the page.';
          this.cdr.markForCheck();
        });
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.showPasswordDialog) {
      this.closePasswordDialog();
    }
  }

  setupDragAndDrop(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  onDragEnter(): void {
    this.showDropZone = true;
    this.cdr.markForCheck();
  }

  onDragLeave(): void {
    this.showDropZone = false;
    this.cdr.markForCheck();
  }

  onDrop(e: DragEvent): void {
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFiles(Array.from(files));
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(Array.from(input.files));
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    if (!this.JSZipLib) {
      this.errorMessage = 'Archive library is still loading. Please wait a moment and try again.';
      this.cdr.markForCheck();
      return;
    }

    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return this.supportedFormats.includes(ext) || 
             file.type.includes('zip') || 
             file.type.includes('archive') ||
             file.type.includes('compressed');
    });

    if (validFiles.length === 0) {
      this.errorMessage = 'Please select valid archive files (.zip, .rar, .7z, .tar, etc.)';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      for (const file of validFiles) {
        await this.loadArchiveFile(file);
      }
    } catch (error) {
      this.errorMessage = `Failed to load archive: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadArchiveFile(file: File, password?: string): Promise<void> {
    if (!this.JSZipLib) {
      throw new Error('JSZip library not loaded');
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    // For now, only ZIP files are fully supported via JSZip
    // Other formats would need additional libraries
    if (ext !== '.zip') {
      this.errorMessage = `Format ${ext} is currently not fully supported. ZIP files are fully supported.`;
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      this.loadingProgress = 0;
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      this.loadingProgress = 30;

      let zip: JSZipInstance;
      try {
        zip = await (this.JSZipLib as any).loadAsync(arrayBuffer, {
          password: password
        });
        this.loadingProgress = 60;
      } catch (error: any) {
        if (error.message && error.message.includes('password')) {
          // Password required
          this.passwordForArchive = {
            name: file.name,
            file: file,
            size: file.size,
            format: ext,
            totalFiles: 0,
            totalSize: 0,
            compressedSize: 0,
            passwordProtected: true,
            loaded: false
          };
          this.showPasswordDialog = true;
          this.loading = false;
          this.cdr.markForCheck();
          return;
        }
        throw error;
      }

      // Build file tree
      const fileTree = this.buildFileTree(zip);
      this.loadingProgress = 80;

      const archiveInfo: ArchiveInfo = {
        name: file.name,
        file: file,
        size: file.size,
        format: ext,
        totalFiles: this.flatFileList.length,
        totalSize: this.flatFileList.reduce((sum, f) => sum + f.size, 0),
        compressedSize: file.size,
        passwordProtected: false,
        loaded: true
      };

      this.archiveFiles.push(archiveInfo);

      if (this.archiveFiles.length === 1) {
        this.currentArchiveIndex = 0;
        this.fileTreeData = fileTree;
        this.expandedPaths.add('/');
      }

      this.loadingProgress = 100;
      this.loading = false;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading archive:', error);
      throw new Error(`Failed to parse archive: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return await file.arrayBuffer();
  }

  buildFileTree(zip: JSZipInstance): ArchiveFile[] {
    const rootFiles: ArchiveFile[] = [];
    const fileMap = new Map<string, ArchiveFile>();
    this.flatFileList = [];

    zip.forEach((relativePath, file) => {
      const pathParts = relativePath.split('/').filter(p => p);
      const isDirectory = relativePath.endsWith('/');
      const name = pathParts[pathParts.length - 1] || relativePath;

      const archiveFile: ArchiveFile = {
        name: name,
        path: relativePath,
        size: isDirectory ? 0 : (file as any)._data?.uncompressedSize || 0,
        compressedSize: isDirectory ? 0 : (file as any)._data?.compressedSize || 0,
        isDirectory: isDirectory,
        date: file.date || new Date(),
        level: pathParts.length - 1,
        expanded: false,
        children: []
      };

      this.flatFileList.push(archiveFile);

      if (isDirectory) {
        fileMap.set(relativePath, archiveFile);
      } else {
        fileMap.set(relativePath, archiveFile);

        // Add to parent
        const parentPath = pathParts.slice(0, -1).join('/') + '/';
        if (parentPath !== '/') {
          const parent = fileMap.get(parentPath);
          if (parent) {
            if (!parent.children) {
              parent.children = [];
            }
            parent.children.push(archiveFile);
            archiveFile.parent = parent;
          } else {
            // Create parent directories
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
                this.flatFileList.push(dir);

                // Add to parent
                if (i > 0) {
                  const parentPath = pathParts.slice(0, i).join('/') + '/';
                  const parent = fileMap.get(parentPath);
                  if (parent && parent.children) {
                    parent.children.push(dir);
                    dir.parent = parent;
                  }
                }
              }
            }
            const finalParent = fileMap.get(currentPath);
            if (finalParent && finalParent.children) {
              finalParent.children.push(archiveFile);
              archiveFile.parent = finalParent;
            }
          }
        } else {
          rootFiles.push(archiveFile);
        }
      }
    });

    // Build root structure
    const roots: ArchiveFile[] = [];
    fileMap.forEach((file, path) => {
      if (file.level === 0) {
        roots.push(file);
      }
    });

    // Sort: directories first, then by name
    const sortFiles = (files: ArchiveFile[]): ArchiveFile[] => {
      return files.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      }).map(f => {
        if (f.children) {
          f.children = sortFiles(f.children);
        }
        return f;
      });
    };

    return sortFiles(roots);
  }

  selectArchive(index: number): void {
    if (index >= 0 && index < this.archiveFiles.length) {
      this.currentArchiveIndex = index;
      this.selectedFile = null;
      this.previewContent = '';
      this.previewType = 'none';
      this.previewFileName = '';
      this.searchText = '';
      
      // Reload file tree for selected archive
      if (this.archiveFiles[index].loaded) {
        this.loadArchiveStructure(index);
      }
      
      this.cdr.markForCheck();
    }
  }

  async loadArchiveStructure(index: number): Promise<void> {
    if (!this.JSZipLib || index < 0 || !this.archiveFiles[index].loaded) {
      return;
    }

    try {
      const archive = this.archiveFiles[index];
      const arrayBuffer = await this.readFileAsArrayBuffer(archive.file);
      const zip = await (this.JSZipLib as any).loadAsync(arrayBuffer);
      this.fileTreeData = this.buildFileTree(zip);
      this.expandedPaths.clear();
      this.expandedPaths.add('/');
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading archive structure:', error);
    }
  }

  toggleExpand(file: ArchiveFile): void {
    if (!file.isDirectory || !file.children) {
      return;
    }

    file.expanded = !file.expanded;
    if (file.expanded) {
      this.expandedPaths.add(file.path);
    } else {
      this.expandedPaths.delete(file.path);
      // Collapse all children
      this.collapseChildren(file);
    }
    this.cdr.markForCheck();
  }

  collapseChildren(file: ArchiveFile): void {
    if (file.children) {
      for (const child of file.children) {
        if (child.isDirectory) {
          child.expanded = false;
          this.expandedPaths.delete(child.path);
          this.collapseChildren(child);
        }
      }
    }
  }

  expandAll(): void {
    const expandRecursive = (files: ArchiveFile[]): void => {
      for (const file of files) {
        if (file.isDirectory) {
          file.expanded = true;
          this.expandedPaths.add(file.path);
          if (file.children) {
            expandRecursive(file.children);
          }
        }
      }
    };
    expandRecursive(this.fileTreeData);
    this.cdr.markForCheck();
  }

  collapseAll(): void {
    const collapseRecursive = (files: ArchiveFile[]): void => {
      for (const file of files) {
        if (file.isDirectory) {
          file.expanded = false;
          this.expandedPaths.delete(file.path);
          if (file.children) {
            collapseRecursive(file.children);
          }
        }
      }
    };
    collapseRecursive(this.fileTreeData);
    this.cdr.markForCheck();
  }

  async selectFile(file: ArchiveFile): Promise<void> {
    if (file.isDirectory) {
      return;
    }

    this.selectedFile = file;
    this.selectedPath = file.path;
    this.previewContent = '';
    this.previewType = 'none';
    this.previewFileName = file.name;

    try {
      await this.previewFile(file);
    } catch (error) {
      console.error('Error previewing file:', error);
      this.previewType = 'binary';
      this.previewContent = 'Binary file - cannot preview';
      this.cdr.markForCheck();
    }
  }

  async previewFile(file: ArchiveFile): Promise<void> {
    if (!this.JSZipLib || this.currentArchiveIndex < 0) {
      return;
    }

    const archive = this.archiveFiles[this.currentArchiveIndex];
    const arrayBuffer = await this.readFileAsArrayBuffer(archive.file);
    const zip = await (this.JSZipLib as any).loadAsync(arrayBuffer);
    const zipFile = zip.file(file.path);

    if (!zipFile) {
      this.previewType = 'none';
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const textExtensions = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'log', 'csv', 'yml', 'yaml'];

    if (imageExtensions.includes(ext)) {
      // Preview as image
      const blob = await zipFile.async('blob');
      const url = URL.createObjectURL(blob);
      this.previewContent = url;
      this.previewType = 'image';
    } else if (textExtensions.includes(ext)) {
      // Preview as text
      const text = await zipFile.async('text');
      this.previewContent = text;
      this.previewType = 'text';
    } else {
      // Binary file
      this.previewContent = 'Binary file - cannot preview';
      this.previewType = 'binary';
    }

    this.cdr.markForCheck();
  }

  async downloadFile(file: ArchiveFile): Promise<void> {
    if (!this.JSZipLib || this.currentArchiveIndex < 0 || file.isDirectory) {
      return;
    }

    try {
      const archive = this.archiveFiles[this.currentArchiveIndex];
      const arrayBuffer = await this.readFileAsArrayBuffer(archive.file);
      const zip = await (this.JSZipLib as any).loadAsync(arrayBuffer);
      const zipFile = zip.file(file.path);

      if (!zipFile) {
        this.errorMessage = 'File not found in archive';
        this.cdr.markForCheck();
        return;
      }

      const blob = await zipFile.async('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      this.errorMessage = 'Failed to download file';
      this.cdr.markForCheck();
    }
  }

  async extractAll(): Promise<void> {
    if (!this.JSZipLib || this.currentArchiveIndex < 0) {
      return;
    }

    try {
      const archive = this.archiveFiles[this.currentArchiveIndex];
      const arrayBuffer = await this.readFileAsArrayBuffer(archive.file);
      const zip = await (this.JSZipLib as any).loadAsync(arrayBuffer);
      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Create a download link for all files
      // In a real implementation, you might want to extract files individually
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = archive.name.replace(/\.(zip|rar|7z|tar)$/i, '_extracted.zip');
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error extracting archive:', error);
      this.errorMessage = 'Failed to extract archive';
      this.cdr.markForCheck();
    }
  }

  performSearch(): void {
    if (!this.searchText.trim()) {
      this.selectedPath = '';
      this.cdr.markForCheck();
      return;
    }

    const searchLower = this.searchText.toLowerCase();
    const matchedFiles = this.flatFileList.filter(file => 
      Boolean(file.name.toLowerCase().includes(searchLower) ||
      file.path.toLowerCase().includes(searchLower))
    );

    if (matchedFiles.length > 0) {
      // Expand paths to show first match
      const firstMatch = matchedFiles[0];
      this.expandToPath(firstMatch.path);
      this.selectFile(firstMatch);
    }

    this.cdr.markForCheck();
  }

  expandToPath(path: string): void {
    const parts = path.split('/').filter(p => p);
    let currentPath = '';
    
    for (const part of parts.slice(0, -1)) {
      currentPath += part + '/';
      this.expandedPaths.add(currentPath);
      
      // Find and expand the file in tree
      const file = this.findFileByPath(this.fileTreeData, currentPath);
      if (file) {
        file.expanded = true;
      }
    }
  }

  findFileByPath(files: ArchiveFile[], path: string): ArchiveFile | null {
    for (const file of files) {
      if (file.path === path) {
        return file;
      }
      if (file.children) {
        const found = this.findFileByPath(file.children, path);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  onPasswordSubmit(): void {
    if (!this.passwordForArchive || !this.passwordInput.trim()) {
      this.passwordError = 'Please enter a password';
      this.cdr.markForCheck();
      return;
    }

    this.passwordError = '';
    const password = this.passwordInput;
    const archive = this.passwordForArchive;
    
    this.passwordInput = '';
    this.showPasswordDialog = false;
    this.passwordForArchive = null;
    this.loading = true;
    this.cdr.markForCheck();

    this.loadArchiveFile(archive.file, password)
      .catch(error => {
        if (error.message && error.message.includes('password')) {
          this.passwordForArchive = archive;
          this.showPasswordDialog = true;
          this.passwordError = 'Incorrect password. Please try again.';
          this.loading = false;
        } else {
          this.errorMessage = `Failed to load archive: ${error.message}`;
          this.loading = false;
        }
        this.cdr.markForCheck();
      });
  }

  closePasswordDialog(): void {
    this.showPasswordDialog = false;
    this.passwordInput = '';
    this.passwordError = '';
    this.passwordForArchive = null;
    this.loading = false;
    this.cdr.markForCheck();
  }

  removeArchive(index: number): void {
    if (index >= 0 && index < this.archiveFiles.length) {
      this.archiveFiles.splice(index, 1);
      
      if (this.archiveFiles.length === 0) {
        this.currentArchiveIndex = -1;
        this.fileTreeData = [];
        this.flatFileList = [];
        this.selectedFile = null;
        this.previewContent = '';
        this.previewType = 'none';
      } else {
        if (this.currentArchiveIndex >= this.archiveFiles.length) {
          this.currentArchiveIndex = this.archiveFiles.length - 1;
        }
        if (this.currentArchiveIndex >= 0) {
          this.loadArchiveStructure(this.currentArchiveIndex);
        }
      }
      
      this.cdr.markForCheck();
    }
  }

  clearAll(): void {
    this.archiveFiles = [];
    this.currentArchiveIndex = -1;
    this.fileTreeData = [];
    this.flatFileList = [];
    this.selectedFile = null;
    this.previewContent = '';
    this.previewType = 'none';
    this.searchText = '';
    this.errorMessage = '';
    this.loading = false;
    this.cdr.markForCheck();
  }

  async copyPreviewText(): Promise<void> {
    if (!this.previewContent || this.previewType !== 'text') return;
    try {
      await navigator.clipboard.writeText(this.previewContent);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = this.previewContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getFileIcon(file: ArchiveFile): string {
    if (file.isDirectory) {
      return '📁';
    }
    
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const iconMap: { [key: string]: string } = {
      'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'bmp': '🖼️', 'webp': '🖼️', 'svg': '🖼️',
      'txt': '📄', 'md': '📝', 'doc': '📄', 'docx': '📄',
      'pdf': '📕', 'zip': '📦', 'rar': '📦', '7z': '📦',
      'mp3': '🎵', 'mp4': '🎬', 'avi': '🎬',
      'js': '📜', 'ts': '📜', 'json': '📜',
      'html': '🌐', 'css': '🎨', 'xml': '📋'
    };
    return iconMap[ext] || '📄';
  }

  toggleAbout(): void {
    this.showAbout = !this.showAbout;
    this.cdr.markForCheck();
  }

  cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }

    // Cleanup preview URLs
    if (this.previewContent && this.previewType === 'image') {
      URL.revokeObjectURL(this.previewContent);
    }
  }
}
