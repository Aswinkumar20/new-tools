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
  WORD_ACCEPT_ATTR,
  WORD_DEFAULT_ZOOM,
  WORD_EXIT_RERENDER_MS,
  WORD_FIT_BASE_WIDTH_PX,
  WORD_FULLSCREEN_ENTER_DELAY_MS,
  WORD_FULLSCREEN_EVENTS,
  WORD_FULLSCREEN_FIT_MS,
  WORD_FULLSCREEN_FIT_PADDING_PX,
  WORD_MAX_FILE_SIZE_BYTES,
  WORD_MAX_FILE_SIZE_LABEL,
  WORD_MAX_ZOOM,
  WORD_MIN_ZOOM,
  WORD_NORMAL_FIT_PADDING_PX,
  WORD_RELATED_TOOLS,
  WORD_RENDER_DELAY_MS,
  WORD_RENDER_MAX_ATTEMPTS,
  WORD_RENDER_RETRY_MS,
  WORD_SELECT_DELAY_MS,
  WORD_SUPPORTED_LABEL
} from '../../constants/word-viewer.constants';
import type { WordFile } from '../../types/word-viewer.types';
import { DocumentType } from '../../types/word-viewer.types';
import {
  computeWordFitToWidthZoom,
  createWordFileRecord,
  formatWordFileSize,
  getDocumentTypeLabel,
  isFullscreenActive,
  loadMammothLibrary,
  parseWordDocument,
  resolveWordSuggestion,
  safeRevokeObjectUrl,
  stepWordZoom,
  validateWordFiles
} from '../../utils/word-viewer.utils';

@Component({
  selector: 'lib-word-viewer',
  standalone: true,
  templateUrl: './word-viewer.html',
  styleUrls: ['./word-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class FileViewerWordViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('documentContainer') documentContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenDocumentContainer') fullscreenDocumentContainer!: ElementRef<HTMLDivElement>;

  readonly acceptAttr = WORD_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = WORD_RELATED_TOOLS;
  readonly minZoom = WORD_MIN_ZOOM;
  readonly maxZoom = WORD_MAX_ZOOM;
  readonly maxFileSizeLabel = WORD_MAX_FILE_SIZE_LABEL;
  readonly supportedLabel = WORD_SUPPORTED_LABEL;

  wordFiles: WordFile[] = [];
  currentWordIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  zoomLevel = WORD_DEFAULT_ZOOM;
  isFullscreenView = false;
  dismissedSuggestionId: string | null = null;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    loadMammothLibrary().catch(() => {
      this.errorMessage = 'Failed to load Word viewer library. Please refresh the page.';
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  get currentWord(): WordFile | null {
    return this.currentWordIndex >= 0 && this.currentWordIndex < this.wordFiles.length
      ? this.wordFiles[this.currentWordIndex]
      : null;
  }

  get primarySuggestion() {
    const suggestion = resolveWordSuggestion({
      hasFiles: this.wordFiles.length > 0,
      hasError: !!this.errorMessage,
      documentType: this.currentWord?.documentType ?? null,
      textLength: this.currentWord?.textContent?.length ?? 0
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
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  setupFullscreenListeners(): void {
    for (const eventName of WORD_FULLSCREEN_EVENTS) {
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

    let mammothLib;
    try {
      mammothLib = await loadMammothLibrary();
    } catch (error: unknown) {
      this.loading = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.errorMessage = `Failed to load Word viewer library: ${message}. Please refresh the page.`;
      return;
    }

    const { validFiles, errors } = validateWordFiles(files, {
      maxFileSize: WORD_MAX_FILE_SIZE_BYTES,
      maxFileSizeLabel: WORD_MAX_FILE_SIZE_LABEL
    });

    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    for (const file of validFiles) {
      try {
        const url = URL.createObjectURL(file);
        const parsed = await parseWordDocument(file, mammothLib);

        // Preserve prior behavior: mammoth warnings were console-only (now silent)
        void parsed.warnings;

        const wordFile = createWordFileRecord(
          file,
          url,
          parsed.htmlContent,
          parsed.textContent
        );

        this.wordFiles.push(wordFile);
        this.cdr.detectChanges();

        if (this.currentWordIndex === -1) {
          this.currentWordIndex = this.wordFiles.length - 1;
          requestAnimationFrame(() => {
            setTimeout(() => {
              void this.loadWord(wordFile);
            }, WORD_SELECT_DELAY_MS);
          });
        }
      } catch (error) {
        errors.push(
          `${file.name}: Failed to load document - ${error instanceof Error ? error.message : 'Unknown error'}`
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

  closeError(): void {
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  onFullscreenChange(): void {
    if (!isFullscreenActive() && this.isFullscreenView) {
      this.isFullscreenView = false;
      setTimeout(() => {
        this.updateZoom();
      }, WORD_EXIT_RERENDER_MS);
      this.cdr.detectChanges();
    }
  }

  toggleFullscreenView(): void {
    if (this.isFullscreenView) {
      this.exitFullscreenView();
    } else {
      this.enterFullscreenView();
    }
  }

  enterFullscreenView(): void {
    if (!this.currentWord) {
      return;
    }

    this.isFullscreenView = true;
    this.cdr.detectChanges();

    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = this.fullscreenContainer?.nativeElement;
        if (!container) {
          this.isFullscreenView = false;
          this.cdr.detectChanges();
          return;
        }

        const afterEnter = () => {
          setTimeout(() => this.renderDocumentInFullscreen(), WORD_FULLSCREEN_FIT_MS);
        };

        const extended = container as HTMLElement & {
          webkitRequestFullscreen?: () => void;
          mozRequestFullScreen?: () => void;
          msRequestFullscreen?: () => void;
        };

        if (container.requestFullscreen) {
          container
            .requestFullscreen()
            .then(afterEnter)
            .catch(() => {
              this.isFullscreenView = false;
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
          this.isFullscreenView = true;
          afterEnter();
        }
      }, WORD_FULLSCREEN_ENTER_DELAY_MS);
    });
  }

  exitFullscreenView(): void {
    this.isFullscreenView = false;

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
      this.updateZoom();
    }, WORD_EXIT_RERENDER_MS);

    this.cdr.detectChanges();
  }

  private renderDocumentInFullscreen(): void {
    if (!this.currentWord || !this.fullscreenDocumentContainer?.nativeElement) {
      return;
    }

    const container = this.fullscreenDocumentContainer.nativeElement;
    container.innerHTML = this.currentWord.htmlContent || '';
    container.style.height = 'auto';
    container.style.minHeight = 'auto';
    this.updateZoom();
  }

  async loadWord(wordFile: WordFile): Promise<void> {
    if (!wordFile.htmlContent) {
      this.errorMessage = 'Word document content not available';
      this.cdr.detectChanges();
      return;
    }

    this.cdr.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, WORD_RENDER_DELAY_MS));

    const getContainer = (): HTMLDivElement | null => {
      if (this.documentContainer?.nativeElement) {
        return this.documentContainer.nativeElement;
      }
      return document.querySelector('.document-content-wrapper') as HTMLDivElement;
    };

    let attempts = 0;

    const tryRender = (): void => {
      attempts++;
      const container = getContainer();

      if (container) {
        container.innerHTML = wordFile.htmlContent || '';
        container.style.zoom = `${this.zoomLevel}%`;
        container.style.height = 'auto';
        container.style.minHeight = '500px';
        this.cdr.detectChanges();
        return;
      }

      if (attempts < WORD_RENDER_MAX_ATTEMPTS) {
        this.cdr.detectChanges();
        setTimeout(tryRender, WORD_RENDER_RETRY_MS);
      } else {
        this.errorMessage =
          'Failed to render document: container not available. Please try uploading again.';
        this.cdr.detectChanges();
      }
    };

    tryRender();
  }

  selectWord(index: number): Promise<void> {
    if (index >= 0 && index < this.wordFiles.length) {
      this.currentWordIndex = index;
      this.dismissedSuggestionId = null;
      return this.loadWord(this.wordFiles[index]);
    }
    return Promise.resolve();
  }

  zoomIn(): void {
    if (this.zoomLevel < WORD_MAX_ZOOM) {
      this.zoomLevel = stepWordZoom(this.zoomLevel, 1);
      this.updateZoom();
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > WORD_MIN_ZOOM) {
      this.zoomLevel = stepWordZoom(this.zoomLevel, -1);
      this.updateZoom();
    }
  }

  resetZoom(): void {
    this.zoomLevel = WORD_DEFAULT_ZOOM;
    this.updateZoom();
  }

  fitToWidth(): void {
    if (!this.currentWord) {
      return;
    }

    const container = this.isFullscreenView
      ? this.fullscreenDocumentContainer?.nativeElement
      : this.documentContainer?.nativeElement;

    if (!container) {
      return;
    }

    const containerWidth =
      container.clientWidth -
      (this.isFullscreenView ? WORD_FULLSCREEN_FIT_PADDING_PX : WORD_NORMAL_FIT_PADDING_PX);

    this.zoomLevel = computeWordFitToWidthZoom(containerWidth, WORD_FIT_BASE_WIDTH_PX);
    this.updateZoom();
  }

  updateZoom(): void {
    const normalContainer =
      this.documentContainer?.nativeElement ||
      (document.querySelector('.document-content-wrapper') as HTMLDivElement);
    const fullscreenContainer = this.fullscreenDocumentContainer?.nativeElement;

    if (normalContainer) {
      normalContainer.style.zoom = `${this.zoomLevel}%`;
    }

    if (fullscreenContainer) {
      fullscreenContainer.style.zoom = `${this.zoomLevel}%`;
    }

    this.cdr.detectChanges();
  }

  downloadWord(): void {
    if (!this.currentWord) {
      return;
    }

    const link = document.createElement('a');
    link.href = this.currentWord.url;
    link.download = this.currentWord.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.toast.info(`Downloaded ${this.currentWord.name}`);
  }

  printWord(): void {
    if (!this.currentWord) {
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow && this.currentWord.htmlContent) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${this.currentWord.name}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${this.currentWord.htmlContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  removeWord(index: number): void {
    if (index < 0 || index >= this.wordFiles.length) {
      return;
    }

    const wordFile = this.wordFiles[index];
    safeRevokeObjectUrl(wordFile.url);
    this.wordFiles.splice(index, 1);

    if (this.currentWordIndex === index) {
      if (this.wordFiles.length > 0) {
        this.currentWordIndex = Math.min(index, this.wordFiles.length - 1);
        void this.loadWord(this.wordFiles[this.currentWordIndex]);
      } else {
        this.currentWordIndex = -1;
        if (this.documentContainer?.nativeElement) {
          this.documentContainer.nativeElement.innerHTML = '';
        }
      }
    } else if (this.currentWordIndex > index) {
      this.currentWordIndex--;
    }

    this.cdr.detectChanges();
  }

  clearAll(): void {
    if (this.isFullscreenView) {
      this.exitFullscreenView();
    }

    for (const wordFile of this.wordFiles) {
      safeRevokeObjectUrl(wordFile.url);
    }

    this.wordFiles = [];
    this.currentWordIndex = -1;
    this.dismissedSuggestionId = null;

    if (this.documentContainer?.nativeElement) {
      this.documentContainer.nativeElement.innerHTML = '';
    }

    if (this.fullscreenDocumentContainer?.nativeElement) {
      this.fullscreenDocumentContainer.nativeElement.innerHTML = '';
    }

    this.cdr.detectChanges();
  }

  async copyTextContent(): Promise<void> {
    if (!this.currentWord?.textContent) {
      return;
    }
    await fvCopyText(this.toast, this.currentWord.textContent, 'Extracted text');
  }

  formatFileSize(bytes: number): string {
    return formatWordFileSize(bytes);
  }

  getDocumentTypeLabel(type: DocumentType): string {
    return getDocumentTypeLabel(type);
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

    if (e.key === 'Escape' && this.isFullscreenView) {
      this.exitFullscreenView();
    }
  }

  cleanup(): void {
    if (this.isFullscreenView) {
      this.exitFullscreenView();
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }

    for (const eventName of WORD_FULLSCREEN_EVENTS) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }

    this.clearAll();
  }
}
