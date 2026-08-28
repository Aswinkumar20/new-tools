import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { fvCopyText } from '../../shared/fv-clipboard.util';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  TEXT_ACCEPT_ATTR,
  TEXT_DEFAULT_ZOOM,
  TEXT_FULLSCREEN_ENTER_DELAY_MS,
  TEXT_FULLSCREEN_EVENTS,
  TEXT_FULLSCREEN_FIT_MS,
  TEXT_LOAD_FALLBACK_MS,
  TEXT_MAX_FILE_SIZE_BYTES,
  TEXT_MAX_FILE_SIZE_LABEL,
  TEXT_MAX_ZOOM,
  TEXT_MIN_ZOOM,
  TEXT_RELATED_TOOLS,
  TEXT_RENDER_DELAY_MS,
  TEXT_RENDER_MAX_ATTEMPTS,
  TEXT_RENDER_RETRY_MS,
  TEXT_SELECT_DELAY_MS
} from '../../constants/text-file-viewer.constants';
import type { TextFile } from '../../types/text-file-viewer.types';
import { TextFileType } from '../../types/text-file-viewer.types';
import {
  createTextFileRecord,
  escapeTextHtml,
  findTextSearchMatchIndexes,
  formatTextContent,
  formatTextFileSize,
  getTextFileTypeLabel,
  isFullscreenActive,
  readTextFileContent,
  resolveTextFileSuggestion,
  safeRevokeObjectUrl,
  stepTextZoom,
  validateTextFiles
} from '../../utils/text-file-viewer.utils';

@Component({
  selector: 'lib-text-file-viewer',
  standalone: true,
  templateUrl: './text-file-viewer.html',
  styleUrls: ['./text-file-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class TextFileViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('textContent') textContent!: ElementRef<HTMLPreElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenTextContent') fullscreenTextContent!: ElementRef<HTMLPreElement>;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = TEXT_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = TEXT_RELATED_TOOLS;
  readonly minZoom = TEXT_MIN_ZOOM;
  readonly maxZoom = TEXT_MAX_ZOOM;
  readonly maxFileSizeLabel = TEXT_MAX_FILE_SIZE_LABEL;

  textFiles: TextFile[] = [];
  currentFileIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  isFullscreen = false;
  zoomLevel = TEXT_DEFAULT_ZOOM;
  wordWrap = true;
  showLineNumbers = true;
  searchText = '';
  searchCaseSensitive = false;
  searchResults: number[] = [];
  currentSearchIndex = -1;
  dismissedSuggestionId: string | null = null;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    // View children available after first CD cycle
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'g' && this.searchText) {
      e.preventDefault();
      this.findNext();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G' && this.searchText) {
      e.preventDefault();
      this.findPrevious();
    }
  }

  get currentFile(): TextFile | null {
    return this.currentFileIndex >= 0 && this.currentFileIndex < this.textFiles.length
      ? this.textFiles[this.currentFileIndex]
      : null;
  }

  get loadedFilesCount(): number {
    return this.textFiles.length;
  }

  get currentLineCount(): number {
    return this.currentFile?.lines ?? 0;
  }

  get searchResultsCount(): number {
    return this.searchResults.length;
  }

  get primarySuggestion() {
    const suggestion = resolveTextFileSuggestion({
      hasFiles: this.textFiles.length > 0,
      hasError: !!this.errorMessage,
      fileType: this.currentFile?.fileType ?? null,
      lineCount: this.currentFile?.lines ?? 0
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.detectChanges();
  }

  setupDragAndDrop(): void {
    if (typeof document === 'undefined') {
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
  }

  onDragLeave(): void {
    this.showDropZone = false;
  }

  onDrop(e: DragEvent): void {
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void this.processFiles(Array.from(files));
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.processFiles(Array.from(input.files));
    }
  }

  async processFiles(files: File[]): Promise<void> {
    this.errorMessage = '';
    this.loading = true;
    this.dismissedSuggestionId = null;

    const { validFiles, errors } = validateTextFiles(files, {
      maxFileSize: TEXT_MAX_FILE_SIZE_BYTES,
      maxFileSizeLabel: TEXT_MAX_FILE_SIZE_LABEL
    });

    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    for (const file of validFiles) {
      try {
        const url = URL.createObjectURL(file);

        let content: string;
        let encoding: string;
        try {
          const read = await readTextFileContent(file);
          content = read.content;
          encoding = read.encoding;
        } catch (err) {
          errors.push(
            `${file.name}: Failed to read file - ${err instanceof Error ? err.message : 'Unknown error'}`
          );
          safeRevokeObjectUrl(url);
          continue;
        }

        const textFile = createTextFileRecord(file, url, content, encoding);
        this.textFiles.push(textFile);
        this.cdr.detectChanges();

        if (this.currentFileIndex === -1) {
          this.currentFileIndex = this.textFiles.length - 1;
          requestAnimationFrame(() => {
            setTimeout(() => {
              void this.loadFile(textFile);
            }, TEXT_SELECT_DELAY_MS);
          });
        }
      } catch (error) {
        errors.push(
          `${file.name}: Failed to load file - ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    this.loading = false;
    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  async loadFile(textFile: TextFile): Promise<void> {
    try {
      if (!textFile || !textFile.content) {
        this.errorMessage = 'File content not available';
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }

      this.errorMessage = '';
      this.cdr.detectChanges();

      await new Promise((resolve) => setTimeout(resolve, TEXT_RENDER_DELAY_MS));

      const getContainer = (): HTMLPreElement | null => {
        if (this.isFullscreen && this.fullscreenTextContent?.nativeElement) {
          return this.fullscreenTextContent.nativeElement;
        }
        if (this.textContent?.nativeElement) {
          return this.textContent.nativeElement;
        }
        return document.querySelector('.text-content') as HTMLPreElement;
      };

      let attempts = 0;
      let renderComplete = false;

      const tryRender = (): void => {
        attempts++;
        const container = getContainer();

        if (container) {
          container.innerHTML = '';
          container.innerHTML = formatTextContent(
            textFile.content,
            textFile.fileType,
            this.showLineNumbers
          );
          this.applyStyles(container);
          this.updateZoom(container);
          this.highlightSearch(container);
          this.cdr.detectChanges();
          container.scrollTop = 0;
          renderComplete = true;
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        if (attempts < TEXT_RENDER_MAX_ATTEMPTS) {
          this.cdr.detectChanges();
          setTimeout(tryRender, TEXT_RENDER_RETRY_MS);
        } else {
          this.errorMessage =
            'Failed to render file: container not available. Please try uploading again.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      };

      tryRender();

      if (!renderComplete) {
        await new Promise((resolve) => setTimeout(resolve, TEXT_LOAD_FALLBACK_MS));
        if (!renderComplete) {
          this.loading = false;
          this.cdr.detectChanges();
        }
      }
    } catch (error) {
      this.errorMessage = `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  applyStyles(container: HTMLPreElement): void {
    if (this.wordWrap) {
      container.classList.add('word-wrap');
    } else {
      container.classList.remove('word-wrap');
    }

    if (this.showLineNumbers) {
      container.classList.add('show-line-numbers');
    } else {
      container.classList.remove('show-line-numbers');
    }
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.textFiles.length) {
      return;
    }
    if (this.loading) {
      return;
    }

    this.currentFileIndex = index;
    this.searchText = '';
    this.searchResults = [];
    this.currentSearchIndex = -1;
    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.detectChanges();

    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => setTimeout(resolve, TEXT_SELECT_DELAY_MS));
    await this.loadFile(this.textFiles[index]);
  }

  removeFile(index: number): void {
    if (index < 0 || index >= this.textFiles.length) {
      return;
    }

    const removedFile = this.textFiles.splice(index, 1)[0];
    safeRevokeObjectUrl(removedFile.url);

    if (this.textFiles.length === 0) {
      this.currentFileIndex = -1;
      if (this.textContent?.nativeElement) {
        this.textContent.nativeElement.innerHTML = '';
      }
    } else if (index === this.currentFileIndex) {
      this.currentFileIndex = Math.min(index, this.textFiles.length - 1);
      void this.loadFile(this.textFiles[this.currentFileIndex]);
    } else if (index < this.currentFileIndex) {
      this.currentFileIndex--;
    }
    this.cdr.detectChanges();
  }

  clearAll(): void {
    for (const file of this.textFiles) {
      safeRevokeObjectUrl(file.url);
    }
    this.textFiles = [];
    this.currentFileIndex = -1;
    this.loading = false;
    this.errorMessage = '';
    this.searchText = '';
    this.searchResults = [];
    this.currentSearchIndex = -1;
    this.dismissedSuggestionId = null;
    if (this.textContent?.nativeElement) {
      this.textContent.nativeElement.innerHTML = '';
    }
    this.cdr.detectChanges();
  }

  downloadFile(): void {
    if (!this.currentFile) {
      return;
    }

    const link = document.createElement('a');
    link.href = this.currentFile.url;
    link.download = this.currentFile.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.toast.info(`Downloaded ${this.currentFile.name}`);
  }

  async copyToClipboard(): Promise<void> {
    if (!this.currentFile) {
      return;
    }
    await fvCopyText(this.toast, this.currentFile.content, 'Text');
  }

  printFile(): void {
    if (!this.currentFile) {
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${escapeTextHtml(this.currentFile.name)}</title>
            <style>
              body { font-family: 'Courier New', monospace; margin: 20px; font-size: 12px; }
              pre { white-space: pre-wrap; word-wrap: break-word; }
            </style>
          </head>
          <body>
            <pre>${escapeTextHtml(this.currentFile.content)}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  }

  formatFileSize(bytes: number): string {
    return formatTextFileSize(bytes);
  }

  toggleWordWrap(): void {
    this.wordWrap = !this.wordWrap;
    if (this.currentFile) {
      void this.loadFile(this.currentFile);
    }
  }

  toggleLineNumbers(): void {
    this.showLineNumbers = !this.showLineNumbers;
    if (this.currentFile) {
      void this.loadFile(this.currentFile);
    }
  }

  getFileTypeLabel(type: TextFileType): string {
    return getTextFileTypeLabel(type);
  }

  onSearchChange(): void {
    if (!this.currentFile) {
      return;
    }

    const container = this.isFullscreen
      ? this.fullscreenTextContent?.nativeElement
      : this.textContent?.nativeElement;

    if (container) {
      this.highlightSearch(container);
    }
  }

  highlightSearch(container: HTMLPreElement): void {
    if (!this.searchText || !this.currentFile) {
      container.querySelectorAll('.search-highlight').forEach((el) => {
        el.classList.remove('search-highlight', 'search-highlight-active');
      });
      return;
    }

    container.querySelectorAll('.search-highlight').forEach((el) => {
      const text = document.createTextNode(el.textContent || '');
      el.parentNode?.replaceChild(text, el);
    });

    const text = container.textContent || '';
    this.searchResults = findTextSearchMatchIndexes(
      text,
      this.searchText,
      this.searchCaseSensitive
    );

    if (this.searchResults.length > 0) {
      this.currentSearchIndex = this.currentSearchIndex >= 0 ? this.currentSearchIndex : 0;
      this.scrollToSearchResult();
    } else {
      this.currentSearchIndex = -1;
    }

    this.cdr.detectChanges();
  }

  findNext(): void {
    if (this.searchResults.length === 0) {
      this.onSearchChange();
      return;
    }

    this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResults.length;
    this.scrollToSearchResult();
  }

  findPrevious(): void {
    if (this.searchResults.length === 0) {
      this.onSearchChange();
      return;
    }

    this.currentSearchIndex =
      this.currentSearchIndex <= 0
        ? this.searchResults.length - 1
        : this.currentSearchIndex - 1;
    this.scrollToSearchResult();
  }

  scrollToSearchResult(): void {
    const container = this.isFullscreen
      ? this.fullscreenTextContent?.nativeElement
      : this.textContent?.nativeElement;

    if (container && this.currentSearchIndex >= 0) {
      container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  zoomIn(): void {
    if (this.zoomLevel < TEXT_MAX_ZOOM) {
      this.zoomLevel = stepTextZoom(this.zoomLevel, 1);
      this.updateZoom();
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > TEXT_MIN_ZOOM) {
      this.zoomLevel = stepTextZoom(this.zoomLevel, -1);
      this.updateZoom();
    }
  }

  resetZoom(): void {
    this.zoomLevel = TEXT_DEFAULT_ZOOM;
    this.updateZoom();
  }

  updateZoom(container?: HTMLPreElement): void {
    const targetContainer =
      container ||
      (this.isFullscreen
        ? this.fullscreenTextContent?.nativeElement
        : this.textContent?.nativeElement ||
          (document.querySelector('.text-content') as HTMLPreElement));

    if (targetContainer) {
      targetContainer.style.fontSize = `${this.zoomLevel}%`;
    }
  }

  enterFullscreen(): void {
    if (!this.currentFile) {
      return;
    }

    this.isFullscreen = true;
    this.cdr.detectChanges();

    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = this.fullscreenContainer?.nativeElement;
        if (!container) {
          this.isFullscreen = false;
          this.cdr.detectChanges();
          return;
        }

        const reloadAfterEnter = () => {
          setTimeout(() => {
            if (this.currentFile) {
              void this.loadFile(this.currentFile);
            }
          }, TEXT_FULLSCREEN_FIT_MS);
        };

        const extended = container as HTMLElement & {
          webkitRequestFullscreen?: () => void;
          mozRequestFullScreen?: () => void;
          msRequestFullscreen?: () => void;
        };

        if (container.requestFullscreen) {
          container
            .requestFullscreen()
            .then(reloadAfterEnter)
            .catch(() => {
              this.isFullscreen = false;
              this.cdr.detectChanges();
            });
        } else if (extended.webkitRequestFullscreen) {
          extended.webkitRequestFullscreen();
          reloadAfterEnter();
        } else if (extended.mozRequestFullScreen) {
          extended.mozRequestFullScreen();
          reloadAfterEnter();
        } else if (extended.msRequestFullscreen) {
          extended.msRequestFullscreen();
          reloadAfterEnter();
        } else {
          container.classList.add('fullscreen-active');
          this.isFullscreen = true;
          reloadAfterEnter();
        }
      }, TEXT_FULLSCREEN_ENTER_DELAY_MS);
    });
  }

  exitFullscreen(): void {
    this.isFullscreen = false;

    const doc = document as Document & {
      webkitExitFullscreen?: () => void;
      mozCancelFullScreen?: () => void;
      msExitFullscreen?: () => void;
    };

    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => undefined);
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    }

    this.fullscreenContainer?.nativeElement?.classList.remove('fullscreen-active');

    setTimeout(() => {
      if (this.currentFile) {
        void this.loadFile(this.currentFile);
      }
      this.cdr.detectChanges();
    }, TEXT_FULLSCREEN_FIT_MS);
  }

  toggleFullscreen(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  setupFullscreenListeners(): void {
    if (typeof document === 'undefined') {
      return;
    }
    for (const eventName of TEXT_FULLSCREEN_EVENTS) {
      document.addEventListener(eventName, this.fullscreenChangeHandler);
    }
  }

  onFullscreenChange(): void {
    if (!isFullscreenActive() && this.isFullscreen) {
      this.isFullscreen = false;
      this.cdr.detectChanges();
    }
  }

  cleanup(): void {
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }

    for (const eventName of TEXT_FULLSCREEN_EVENTS) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }

    for (const file of this.textFiles) {
      safeRevokeObjectUrl(file.url);
    }
  }
}
