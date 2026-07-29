import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { fvCopyText } from '../../shared/fv-clipboard.util';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  ARCHIVE_ACCEPT_ATTR,
  ARCHIVE_RELATED_TOOLS
} from '../../constants/archive-viewer.constants';
import type {
  ArchiveFile,
  ArchiveInfo,
  ArchivePreviewType,
  JSZipConstructor,
  JSZipInstance
} from '../../types/archive-viewer.types';
import {
  buildArchiveFileTree,
  createPasswordPendingArchive,
  detectPreviewType,
  filterValidArchiveFiles,
  findArchiveFileByPath,
  formatArchiveFileSize,
  getArchiveFileIcon,
  getFileExtension,
  isFullySupportedArchiveExtension,
  isPasswordRequiredError,
  loadJSZipLibrary,
  resolveArchiveSuggestion
} from '../../utils/archive-viewer.utils';

@Component({
  selector: 'lib-archive-viewer',
  standalone: true,
  templateUrl: './archive-viewer.html',
  styleUrls: ['./archive-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class ArchiveViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('previewContainer') previewContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fileTree') fileTree!: ElementRef<HTMLDivElement>;

  readonly acceptAttr = ARCHIVE_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = ARCHIVE_RELATED_TOOLS;

  archiveFiles: ArchiveInfo[] = [];
  currentArchiveIndex = -1;
  fileTreeData: ArchiveFile[] = [];
  flatFileList: ArchiveFile[] = [];
  selectedFile: ArchiveFile | null = null;
  previewContent = '';
  previewType: ArchivePreviewType = 'none';
  previewFileName = '';

  loading = false;
  loadingProgress = 0;
  errorMessage = '';
  showDropZone = false;
  showAbout = false;
  showPasswordDialog = false;
  passwordInput = '';
  passwordError = '';
  passwordForArchive: ArchiveInfo | null = null;

  searchText = '';
  expandedPaths: Set<string> = new Set();
  selectedPath = '';

  dismissedSuggestionId: string | null = null;
  hasCopiedPreview = false;

  private JSZipLib: JSZipConstructor | null = null;
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  constructor(
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  get primarySuggestion() {
    const suggestion = resolveArchiveSuggestion({
      hasArchives: this.archiveFiles.length > 0,
      unsupportedFormatMessage: this.errorMessage.toLowerCase().includes('not fully supported'),
      previewType: this.previewType,
      selectedFileName: this.previewFileName || this.selectedFile?.name || '',
      hasCopiedPreview: this.hasCopiedPreview
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      loadJSZipLibrary()
        .then((lib) => {
          this.JSZipLib = lib;
        })
        .catch(() => {
          this.errorMessage = 'Failed to load archive processing library. Please refresh the page.';
          this.cdr.markForCheck();
        });
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.markForCheck();
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
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

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
      void this.handleFiles(Array.from(files));
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.handleFiles(Array.from(input.files));
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    if (!this.JSZipLib) {
      this.errorMessage = 'Archive library is still loading. Please wait a moment and try again.';
      this.cdr.markForCheck();
      return;
    }

    const validFiles = filterValidArchiveFiles(files);

    if (validFiles.length === 0) {
      this.errorMessage = 'Please select valid archive files (.zip, .rar, .7z, .tar, etc.)';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
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

    const ext = getFileExtension(file.name);

    if (!isFullySupportedArchiveExtension(ext)) {
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
          password
        });
        this.loadingProgress = 60;
      } catch (error: unknown) {
        if (isPasswordRequiredError(error)) {
          this.passwordForArchive = createPasswordPendingArchive(file, ext);
          this.showPasswordDialog = true;
          this.loading = false;
          this.cdr.markForCheck();
          return;
        }
        throw error;
      }

      const { roots, flatList } = buildArchiveFileTree(zip);
      this.flatFileList = flatList;
      this.loadingProgress = 80;

      const archiveInfo: ArchiveInfo = {
        name: file.name,
        file,
        size: file.size,
        format: ext,
        totalFiles: this.flatFileList.length,
        totalSize: this.flatFileList.reduce((sum, entry) => sum + entry.size, 0),
        compressedSize: file.size,
        passwordProtected: false,
        loaded: true
      };

      this.archiveFiles.push(archiveInfo);

      if (this.archiveFiles.length === 1) {
        this.currentArchiveIndex = 0;
        this.fileTreeData = roots;
        this.expandedPaths.add('/');
      }

      this.loadingProgress = 100;
      this.loading = false;
      this.cdr.markForCheck();
    } catch (error) {
      throw new Error(
        `Failed to parse archive: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return file.arrayBuffer();
  }

  selectArchive(index: number): void {
    if (index >= 0 && index < this.archiveFiles.length) {
      this.currentArchiveIndex = index;
      this.selectedFile = null;
      this.previewContent = '';
      this.previewType = 'none';
      this.previewFileName = '';
      this.searchText = '';
      this.hasCopiedPreview = false;
      this.dismissedSuggestionId = null;

      if (this.archiveFiles[index].loaded) {
        void this.loadArchiveStructure(index);
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
      const { roots, flatList } = buildArchiveFileTree(zip);
      this.fileTreeData = roots;
      this.flatFileList = flatList;
      this.expandedPaths.clear();
      this.expandedPaths.add('/');
      this.cdr.markForCheck();
    } catch {
      this.errorMessage = 'Failed to reload archive structure';
      this.cdr.markForCheck();
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
    this.hasCopiedPreview = false;
    this.dismissedSuggestionId = null;

    try {
      await this.previewFile(file);
    } catch {
      this.previewType = 'binary';
      this.previewContent = 'Binary file - cannot preview';
      this.cdr.markForCheck();
    }
  }

  async previewFile(file: ArchiveFile): Promise<void> {
    if (!this.JSZipLib || this.currentArchiveIndex < 0) {
      return;
    }

    if (this.previewContent && this.previewType === 'image') {
      URL.revokeObjectURL(this.previewContent);
    }

    const archive = this.archiveFiles[this.currentArchiveIndex];
    const arrayBuffer = await this.readFileAsArrayBuffer(archive.file);
    const zip = await (this.JSZipLib as any).loadAsync(arrayBuffer);
    const zipFile = zip.file(file.path);

    if (!zipFile) {
      this.previewType = 'none';
      return;
    }

    const kind = detectPreviewType(file.name);
    if (kind === 'image') {
      const blob = await zipFile.async('blob');
      this.previewContent = URL.createObjectURL(blob);
      this.previewType = 'image';
    } else if (kind === 'text') {
      this.previewContent = await zipFile.async('text');
      this.previewType = 'text';
    } else {
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
      this.toast.info(`Downloaded ${file.name}`);
    } catch {
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

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = archive.name.replace(/\.(zip|rar|7z|tar)$/i, '_extracted.zip');
      link.click();
      URL.revokeObjectURL(url);
      this.toast.info('Archive extract started');
    } catch {
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
    const matchedFiles = this.flatFileList.filter(
      (file) =>
        Boolean(
          file.name.toLowerCase().includes(searchLower) || file.path.toLowerCase().includes(searchLower)
        )
    );

    if (matchedFiles.length > 0) {
      const firstMatch = matchedFiles[0];
      this.expandToPath(firstMatch.path);
      void this.selectFile(firstMatch);
    }

    this.cdr.markForCheck();
  }

  expandToPath(path: string): void {
    const parts = path.split('/').filter((part) => part);
    let currentPath = '';

    for (const part of parts.slice(0, -1)) {
      currentPath += part + '/';
      this.expandedPaths.add(currentPath);

      const file = findArchiveFileByPath(this.fileTreeData, currentPath);
      if (file) {
        file.expanded = true;
      }
    }
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

    this.loadArchiveFile(archive.file, password).catch((error: Error) => {
      if (isPasswordRequiredError(error)) {
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
          void this.loadArchiveStructure(this.currentArchiveIndex);
        }
      }

      this.cdr.markForCheck();
    }
  }

  clearAll(): void {
    if (this.previewContent && this.previewType === 'image') {
      URL.revokeObjectURL(this.previewContent);
    }
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
    this.hasCopiedPreview = false;
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();
  }

  async copyPreviewText(): Promise<void> {
    if (!this.previewContent || this.previewType !== 'text') {
      return;
    }
    const ok = await fvCopyText(this.toast, this.previewContent, 'Preview text');
    if (ok) {
      this.hasCopiedPreview = true;
      this.dismissedSuggestionId = null;
      this.cdr.markForCheck();
    }
  }

  formatFileSize(bytes: number): string {
    return formatArchiveFileSize(bytes);
  }

  getFileIcon(file: ArchiveFile): string {
    return getArchiveFileIcon(file);
  }

  toggleAbout(): void {
    this.showAbout = !this.showAbout;
    this.cdr.markForCheck();
  }

  cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }

    if (this.previewContent && this.previewType === 'image') {
      URL.revokeObjectURL(this.previewContent);
    }
  }
}
