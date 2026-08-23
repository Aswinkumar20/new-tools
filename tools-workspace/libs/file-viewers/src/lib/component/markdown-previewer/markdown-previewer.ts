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
  MARKDOWN_ACCEPT_ATTR,
  MARKDOWN_DEFAULT_ZOOM,
  MARKDOWN_FULLSCREEN_ENTER_DELAY_MS,
  MARKDOWN_FULLSCREEN_EVENTS,
  MARKDOWN_FULLSCREEN_FIT_MS,
  MARKDOWN_MAX_FILE_SIZE_BYTES,
  MARKDOWN_MAX_ZOOM,
  MARKDOWN_MIN_ZOOM,
  MARKDOWN_RELATED_TOOLS,
  MARKDOWN_RENDER_DELAY_MS,
  MARKDOWN_RENDER_MAX_ATTEMPTS,
  MARKDOWN_RENDER_RETRY_MS,
  MARKDOWN_SUPPORTED_EXTENSIONS
} from '../../constants/markdown-previewer.constants';
import type {
  DomPurifyLibrary,
  MarkdownFile,
  MarkdownRenderMode,
  MarkedLibrary
} from '../../types/markdown-previewer.types';
import {
  createMarkdownFileRecord,
  formatMarkdownFileSize,
  isFullscreenActive,
  loadDomPurifyLibrary,
  loadMarkedLibrary,
  parseAndSanitizeMarkdown,
  resolveMarkdownSuggestion,
  safeRevokeObjectUrl,
  stepMarkdownZoom,
  validateMarkdownFiles
} from '../../utils/markdown-previewer.utils';

@Component({
  selector: 'lib-markdown-previewer',
  standalone: true,
  templateUrl: './markdown-previewer.html',
  styleUrls: ['./markdown-previewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class MarkdownPreviewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('previewContainer') previewContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenPreviewContainer') fullscreenPreviewContainer!: ElementRef<HTMLDivElement>;

  readonly acceptAttr = MARKDOWN_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = MARKDOWN_RELATED_TOOLS;
  readonly minZoom = MARKDOWN_MIN_ZOOM;
  readonly maxZoom = MARKDOWN_MAX_ZOOM;
  readonly supportedFormats = MARKDOWN_SUPPORTED_EXTENSIONS;
  readonly maxFileSize = MARKDOWN_MAX_FILE_SIZE_BYTES;

  markdownFiles: MarkdownFile[] = [];
  currentFileIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  zoomLevel = MARKDOWN_DEFAULT_ZOOM;
  isFullscreen = false;
  renderMode: MarkdownRenderMode = 'preview';
  dismissedSuggestionId: string | null = null;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  get currentFile(): MarkdownFile | null {
    return this.currentFileIndex >= 0 && this.currentFileIndex < this.markdownFiles.length
      ? this.markdownFiles[this.currentFileIndex]
      : null;
  }

  get loadedFilesCount(): number {
    return this.markdownFiles.length;
  }

  get primarySuggestion() {
    const suggestion = resolveMarkdownSuggestion({
      hasFiles: this.markdownFiles.length > 0,
      hasError: !!this.errorMessage,
      currentFileName: this.currentFile?.name || '',
      lineCount: this.currentFile?.lines || 0
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    Promise.all([loadMarkedLibrary(), loadDomPurifyLibrary()]).catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.detectChanges();
  }

  setupDragAndDrop(): void {
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  setupFullscreenListeners(): void {
    for (const eventName of MARKDOWN_FULLSCREEN_EVENTS) {
      document.addEventListener(eventName, this.fullscreenChangeHandler);
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
    this.cdr.detectChanges();

    let markedLib: MarkedLibrary;
    let purify: DomPurifyLibrary;

    try {
      [markedLib, purify] = await Promise.all([loadMarkedLibrary(), loadDomPurifyLibrary()]);
    } catch (error) {
      this.loading = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.errorMessage = `Failed to load markdown libraries: ${message}. Please refresh the page.`;
      this.cdr.detectChanges();
      return;
    }

    const { validFiles, errors } = validateMarkdownFiles(files, {
      maxFileSize: this.maxFileSize,
      formatFileSize: formatMarkdownFileSize
    });

    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    for (const file of validFiles) {
      try {
        const url = URL.createObjectURL(file);
        const content = await file.text();

        if (!content.trim()) {
          errors.push(`${file.name}: File contains no content`);
          safeRevokeObjectUrl(url);
          continue;
        }

        const htmlContent = parseAndSanitizeMarkdown(content, markedLib, purify);
        const markdownFile = createMarkdownFileRecord(file, url, content, htmlContent);

        this.markdownFiles.push(markdownFile);
        this.cdr.detectChanges();

        if (this.currentFileIndex === -1) {
          this.currentFileIndex = this.markdownFiles.length - 1;
          requestAnimationFrame(() => {
            setTimeout(() => {
              void this.renderMarkdown(markdownFile);
            }, 50);
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

    this.cdr.detectChanges();
  }

  async renderMarkdown(markdownFile: MarkdownFile): Promise<void> {
    if (!markdownFile) {
      this.errorMessage = 'No markdown file to render';
      this.cdr.detectChanges();
      return;
    }

    this.cdr.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, MARKDOWN_RENDER_DELAY_MS));

    const getContentDiv = (): HTMLDivElement | null => {
      if (this.isFullscreen) {
        return this.fullscreenPreviewContainer?.nativeElement || null;
      }

      const container = this.previewContainer?.nativeElement;
      if (container) {
        let contentDiv = container.querySelector('.markdown-preview-content') as HTMLDivElement;
        if (!contentDiv) {
          contentDiv = document.createElement('div');
          contentDiv.className = 'markdown-preview-content';
          container.appendChild(contentDiv);
        }
        return contentDiv;
      }
      return document.querySelector('.markdown-preview-content') as HTMLDivElement;
    };

    let attempts = 0;

    const tryRender = (): void => {
      attempts++;
      const contentDiv = getContentDiv();

      if (contentDiv) {
        contentDiv.innerHTML = markdownFile.htmlContent;
        this.updateZoom(contentDiv);
        this.cdr.detectChanges();
        const container = this.isFullscreen
          ? this.fullscreenContainer?.nativeElement?.querySelector('.fullscreen-preview-container')
          : this.previewContainer?.nativeElement;
        if (container) {
          (container as HTMLElement).scrollTop = 0;
        }
        return;
      }

      if (attempts < MARKDOWN_RENDER_MAX_ATTEMPTS) {
        this.cdr.detectChanges();
        setTimeout(tryRender, MARKDOWN_RENDER_RETRY_MS);
      } else {
        this.errorMessage =
          'Failed to render markdown: container not available. Please try uploading again.';
        this.cdr.detectChanges();
      }
    };

    tryRender();
  }

  selectFile(index: number): Promise<void> {
    if (index >= 0 && index < this.markdownFiles.length) {
      this.currentFileIndex = index;
      return this.renderMarkdown(this.markdownFiles[index]);
    }
    return Promise.resolve();
  }

  removeFile(index: number): void {
    if (index >= 0 && index < this.markdownFiles.length) {
      const markdownFile = this.markdownFiles[index];
      safeRevokeObjectUrl(markdownFile.url);
      this.markdownFiles.splice(index, 1);

      if (this.currentFileIndex === index) {
        if (this.markdownFiles.length > 0) {
          this.currentFileIndex = Math.min(index, this.markdownFiles.length - 1);
          void this.renderMarkdown(this.markdownFiles[this.currentFileIndex]);
        } else {
          this.currentFileIndex = -1;
          if (this.previewContainer?.nativeElement) {
            this.previewContainer.nativeElement.innerHTML = '';
          }
        }
      } else if (this.currentFileIndex > index) {
        this.currentFileIndex--;
      }

      this.cdr.detectChanges();
    }
  }

  clearAll(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    }

    for (const markdownFile of this.markdownFiles) {
      safeRevokeObjectUrl(markdownFile.url);
    }

    this.markdownFiles = [];
    this.currentFileIndex = -1;
    this.dismissedSuggestionId = null;

    if (this.previewContainer?.nativeElement) {
      this.previewContainer.nativeElement.innerHTML = '';
    }

    if (this.fullscreenPreviewContainer?.nativeElement) {
      this.fullscreenPreviewContainer.nativeElement.innerHTML = '';
    }

    this.cdr.detectChanges();
  }

  toggleRenderMode(): void {
    if (this.renderMode === 'preview') {
      this.renderMode = 'source';
    } else if (this.renderMode === 'source') {
      this.renderMode = 'split';
    } else {
      this.renderMode = 'preview';
    }
    if (this.currentFile) {
      void this.renderMarkdown(this.currentFile);
    }
  }

  zoomIn(): void {
    if (this.zoomLevel < MARKDOWN_MAX_ZOOM) {
      this.zoomLevel = stepMarkdownZoom(this.zoomLevel, 1);
      this.updateZoom();
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > MARKDOWN_MIN_ZOOM) {
      this.zoomLevel = stepMarkdownZoom(this.zoomLevel, -1);
      this.updateZoom();
    }
  }

  resetZoom(): void {
    this.zoomLevel = MARKDOWN_DEFAULT_ZOOM;
    this.updateZoom();
  }

  updateZoom(container?: HTMLDivElement): void {
    const targetContainer =
      container ||
      (() => {
        if (this.isFullscreen) {
          return this.fullscreenPreviewContainer?.nativeElement;
        }
        const previewContainer = this.previewContainer?.nativeElement;
        return previewContainer?.querySelector('.markdown-preview-content') as HTMLDivElement;
      })();

    if (targetContainer) {
      targetContainer.style.fontSize = `${this.zoomLevel}%`;
    }
  }

  toggleFullscreen(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
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

        const extended = container as HTMLElement & {
          webkitRequestFullscreen?: () => void;
          mozRequestFullScreen?: () => void;
          msRequestFullscreen?: () => void;
        };

        const afterEnter = () => {
          setTimeout(() => {
            if (this.currentFile) {
              void this.renderMarkdown(this.currentFile);
            }
          }, MARKDOWN_FULLSCREEN_FIT_MS);
        };

        if (container.requestFullscreen) {
          container
            .requestFullscreen()
            .then(afterEnter)
            .catch(() => {
              this.isFullscreen = false;
              this.cdr.detectChanges();
            });
        } else if (extended.webkitRequestFullscreen) {
          extended.webkitRequestFullscreen();
          afterEnter();
        } else if (extended.mozRequestFullScreen) {
          extended.mozRequestFullScreen();
          afterEnter();
        } else if (extended.msRequestFullscreen) {
          extended.msRequestFullscreen();
          afterEnter();
        } else {
          container.classList.add('fullscreen-active');
          afterEnter();
        }
      }, MARKDOWN_FULLSCREEN_ENTER_DELAY_MS);
    });
  }

  exitFullscreen(): void {
    this.isFullscreen = false;

    const extended = document as Document & {
      webkitExitFullscreen?: () => void;
      mozCancelFullScreen?: () => void;
      msExitFullscreen?: () => void;
    };

    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => undefined);
    } else if (extended.webkitExitFullscreen) {
      extended.webkitExitFullscreen();
    } else if (extended.mozCancelFullScreen) {
      extended.mozCancelFullScreen();
    } else if (extended.msExitFullscreen) {
      extended.msExitFullscreen();
    }

    if (this.fullscreenContainer?.nativeElement) {
      this.fullscreenContainer.nativeElement.classList.remove('fullscreen-active');
    }

    setTimeout(() => {
      if (this.currentFile) {
        void this.renderMarkdown(this.currentFile);
      }
      this.cdr.detectChanges();
    }, MARKDOWN_FULLSCREEN_FIT_MS);
  }

  onFullscreenChange(): void {
    if (!isFullscreenActive() && this.isFullscreen) {
      this.isFullscreen = false;
      this.cdr.detectChanges();
    }
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

  printFile(): void {
    if (!this.currentFile) {
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${this.currentFile.name}</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                margin: 40px;
                line-height: 1.6;
                color: #333;
              }
              h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
              code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
              pre { background: #f4f4f4; padding: 1em; border-radius: 5px; overflow-x: auto; }
              blockquote { border-left: 4px solid #ddd; padding-left: 1em; margin-left: 0; color: #666; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${this.currentFile.htmlContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  async copyToClipboard(): Promise<void> {
    if (!this.currentFile) {
      return;
    }

    const copied = await fvCopyText(this.toast, this.currentFile.content, 'Markdown source');
    if (!copied) {
      this.errorMessage = 'Failed to copy to clipboard';
      this.cdr.detectChanges();
    }
  }

  formatFileSize(bytes: number): string {
    return formatMarkdownFileSize(bytes);
  }

  closeError(): void {
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }

    if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
    }
  }

  cleanup(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }

    for (const eventName of MARKDOWN_FULLSCREEN_EVENTS) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }

    this.clearAll();
  }
}
