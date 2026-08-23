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
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  PDF_ACCEPT_ATTR,
  PDF_DEFAULT_ZOOM,
  PDF_EXIT_RERENDER_MS,
  PDF_FULLSCREEN_ENTER_DELAY_MS,
  PDF_FULLSCREEN_EVENTS,
  PDF_FULLSCREEN_FIT_MS,
  PDF_FULLSCREEN_FIT_PADDING_PX,
  PDF_MAX_FILE_SIZE_BYTES,
  PDF_MAX_FILE_SIZE_LABEL,
  PDF_MAX_ZOOM,
  PDF_MIN_ZOOM,
  PDF_NORMAL_FIT_PADDING_PX,
  PDF_RELATED_TOOLS
} from '../../constants/pdf-viewer.constants';
import type { PdfFile, PdfRenderTask, PdfViewportSize } from '../../types/pdf-viewer.types';
import {
  computeFitToWidthZoom,
  createPdfFileRecord,
  formatPdfFileSize,
  isFullscreenActive,
  isPdfPasswordError,
  loadPdfJsLibrary,
  resolvePdfSuggestion,
  safeDestroyPdfDoc,
  safeRevokeObjectUrl,
  stepPdfZoom,
  validatePdfFiles
} from '../../utils/pdf-viewer.utils';

@Component({
  selector: 'lib-pdf-viewer',
  standalone: true,
  templateUrl: './pdf-viewer.html',
  styleUrls: ['./pdf-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class FileViewerPdfViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('pdfContainer') pdfContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenCanvasContainer') fullscreenCanvasContainer!: ElementRef<HTMLDivElement>;

  readonly acceptAttr = PDF_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = PDF_RELATED_TOOLS;
  readonly minZoom = PDF_MIN_ZOOM;
  readonly maxZoom = PDF_MAX_ZOOM;
  readonly maxFileSizeLabel = PDF_MAX_FILE_SIZE_LABEL;

  pdfFiles: PdfFile[] = [];
  currentPdfIndex = -1;
  currentPage = 1;
  totalPages = 0;
  zoomLevel = PDF_DEFAULT_ZOOM;
  isFullscreen = false;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showPasswordDialog = false;
  passwordInput = '';
  passwordForPdf: PdfFile | null = null;
  passwordError = '';
  dismissedSuggestionId: string | null = null;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();

  private renderTask: PdfRenderTask = null;
  private isRendering = false;
  private currentViewport: PdfViewportSize | null = null;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  get currentPdf(): PdfFile | null {
    return this.currentPdfIndex >= 0 && this.currentPdfIndex < this.pdfFiles.length
      ? this.pdfFiles[this.currentPdfIndex]
      : null;
  }

  get primarySuggestion() {
    const suggestion = resolvePdfSuggestion({
      hasFiles: this.pdfFiles.length > 0,
      hasError: !!this.errorMessage,
      pdfCount: this.pdfFiles.length,
      currentSize: this.currentPdf?.size ?? 0,
      totalPages: this.currentPdf?.totalPages || this.totalPages,
      needsPassword: !!this.currentPdf?.needsPassword
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
    loadPdfJsLibrary().catch(() => {
      this.errorMessage = 'Failed to load PDF viewer library. Please refresh the page.';
      this.cdr.detectChanges();
    });
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
    for (const eventName of PDF_FULLSCREEN_EVENTS) {
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

    try {
      await loadPdfJsLibrary();
    } catch (error: unknown) {
      this.loading = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.errorMessage = `Failed to load PDF viewer library: ${message}. Please refresh the page.`;
      return;
    }

    const { validFiles, errors } = validatePdfFiles(files, {
      maxFileSize: PDF_MAX_FILE_SIZE_BYTES,
      maxFileSizeLabel: PDF_MAX_FILE_SIZE_LABEL
    });

    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    for (const file of validFiles) {
      try {
        const url = URL.createObjectURL(file);
        const pdfFile = createPdfFileRecord(file, url);

        await this.loadPdfWithPassword(pdfFile);

        this.pdfFiles.push(pdfFile);

        if (this.currentPdfIndex === -1 && pdfFile.pdfDoc) {
          this.currentPdfIndex = this.pdfFiles.length - 1;
          await this.loadPdf(pdfFile);
        }

        this.cdr.detectChanges();
      } catch (error) {
        errors.push(
          `${file.name}: Failed to load PDF - ${error instanceof Error ? error.message : 'Unknown error'}`
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

  async loadPdfWithPassword(pdfFile: PdfFile, password?: string): Promise<void> {
    try {
      const pdfjs = await loadPdfJsLibrary();

      if (password) {
        pdfFile.password = password;
        pdfFile.passwordError = false;
      }

      const loadingTask = pdfjs.getDocument({
        url: pdfFile.url,
        password: pdfFile.password,
        passwordCallback: (updatePassword: (pwd: string) => void) => {
          pdfFile.needsPassword = true;
          pdfFile.passwordError = false;

          this.passwordForPdf = pdfFile;
          this.passwordInput = pdfFile.password || '';
          this.showPasswordDialog = true;
          this.passwordError = '';
          this.cdr.detectChanges();

          return new Promise<string>((resolve) => {
            pdfFile.passwordResolver = (pwd: string) => {
              updatePassword(pwd);
              resolve(pwd);
            };
          });
        }
      });

      const pdfDoc = await loadingTask.promise;
      pdfFile.pdfDoc = pdfDoc;
      pdfFile.totalPages = pdfDoc.numPages;
      pdfFile.needsPassword = false;
      pdfFile.passwordError = false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const pdfjsInstance = await loadPdfJsLibrary();

      if (isPdfPasswordError(error, pdfjsInstance)) {
        pdfFile.passwordError = true;
        pdfFile.needsPassword = true;
        this.passwordForPdf = pdfFile;
        this.showPasswordDialog = true;
        this.passwordError = 'Incorrect password. Please try again.';
        this.passwordInput = '';
        this.cdr.detectChanges();
        throw error;
      }

      this.errorMessage = `Failed to load PDF: ${errorMessage}`;
      throw error;
    }
  }

  async loadPdf(pdfFile: PdfFile): Promise<void> {
    if (!pdfFile.pdfDoc) {
      try {
        await this.loadPdfWithPassword(pdfFile);
      } catch {
        return;
      }
    }

    this.totalPages = pdfFile.totalPages;
    this.currentPage = 1;
    await this.renderPage();
  }

  submitPassword(): void {
    if (!this.passwordForPdf || !this.passwordInput.trim()) {
      this.passwordError = 'Please enter a password';
      return;
    }

    const pdfFile = this.passwordForPdf;
    const password = this.passwordInput.trim();

    this.showPasswordDialog = false;
    this.loading = true;
    this.cdr.detectChanges();

    if (pdfFile.passwordResolver) {
      pdfFile.passwordResolver(password);
    }

    this.loadPdfWithPassword(pdfFile, password)
      .then(() => {
        this.loading = false;
        this.passwordForPdf = null;
        this.passwordInput = '';
        this.passwordError = '';

        if (this.currentPdfIndex === this.pdfFiles.indexOf(pdfFile)) {
          void this.loadPdf(pdfFile);
        }

        this.cdr.detectChanges();
      })
      .catch(() => {
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  cancelPassword(): void {
    this.showPasswordDialog = false;
    this.passwordForPdf = null;
    this.passwordInput = '';
    this.passwordError = '';
    this.cdr.detectChanges();
  }

  onPasswordKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.submitPassword();
    } else if (event.key === 'Escape') {
      this.cancelPassword();
    }
  }

  async selectPdf(index: number): Promise<void> {
    if (index >= 0 && index < this.pdfFiles.length) {
      this.currentPdfIndex = index;
      await this.loadPdf(this.pdfFiles[index]);
      this.cdr.detectChanges();
    }
  }

  async previousPage(): Promise<void> {
    if (this.currentPage > 1) {
      this.currentPage--;
      await this.renderPage();
    }
  }

  async nextPage(): Promise<void> {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      await this.renderPage();
    }
  }

  async goToPage(page: number): Promise<void> {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      await this.renderPage();
    }
  }

  async renderPage(): Promise<void> {
    if (!this.currentPdf || !this.currentPdf.pdfDoc || this.isRendering) {
      return;
    }

    this.isRendering = true;

    if (this.renderTask) {
      this.renderTask.cancel();
    }

    try {
      const page = await this.currentPdf.pdfDoc.getPage(this.currentPage);

      const baseViewport = page.getViewport({ scale: 1 });
      this.currentViewport = { width: baseViewport.width, height: baseViewport.height };

      const devicePixelRatio = window.devicePixelRatio || 1;
      const outputScale = devicePixelRatio;
      const zoomScale = this.zoomLevel / 100;
      const viewport = page.getViewport({ scale: zoomScale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });

      if (!context) {
        throw new Error('Could not get canvas context');
      }

      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';

      if (outputScale !== 1) {
        context.scale(outputScale, outputScale);
      }

      if (this.isFullscreen && this.fullscreenCanvasContainer?.nativeElement) {
        this.fullscreenCanvasContainer.nativeElement.innerHTML = '';
        this.fullscreenCanvasContainer.nativeElement.appendChild(canvas);
      } else if (this.canvasContainer?.nativeElement) {
        this.canvasContainer.nativeElement.innerHTML = '';
        this.canvasContainer.nativeElement.appendChild(canvas);
      }

      this.renderTask = page.render({
        canvasContext: context,
        viewport
      });
      await this.renderTask.promise;

      this.cdr.detectChanges();
    } catch (error) {
      if (error instanceof Error && error.name !== 'RenderingCancelledException') {
        this.errorMessage = `Failed to render page: ${error.message}`;
      }
    } finally {
      this.isRendering = false;
      this.renderTask = null;
    }
  }

  zoomIn(): void {
    if (this.zoomLevel < PDF_MAX_ZOOM) {
      this.zoomLevel = stepPdfZoom(this.zoomLevel, 1);
      void this.renderPage();
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > PDF_MIN_ZOOM) {
      this.zoomLevel = stepPdfZoom(this.zoomLevel, -1);
      void this.renderPage();
    }
  }

  fitToWidth(): void {
    if (!this.currentPdf || !this.currentViewport) {
      return;
    }

    const container = this.isFullscreen
      ? this.fullscreenCanvasContainer?.nativeElement
      : this.canvasContainer?.nativeElement;

    if (!container) {
      return;
    }

    const containerWidth = this.isFullscreen
      ? container.clientWidth - PDF_FULLSCREEN_FIT_PADDING_PX
      : container.clientWidth - PDF_NORMAL_FIT_PADDING_PX;

    this.zoomLevel = computeFitToWidthZoom(this.currentViewport.width, containerWidth);
    void this.renderPage();
  }

  resetZoom(): void {
    this.zoomLevel = PDF_DEFAULT_ZOOM;
    void this.renderPage();
  }

  enterFullscreen(): void {
    if (!this.currentPdf) {
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

        const fitAfterEnter = () => {
          setTimeout(() => this.fitToWidth(), PDF_FULLSCREEN_FIT_MS);
        };

        const extended = container as HTMLElement & {
          webkitRequestFullscreen?: () => void;
          mozRequestFullScreen?: () => void;
          msRequestFullscreen?: () => void;
        };

        if (container.requestFullscreen) {
          container
            .requestFullscreen()
            .then(fitAfterEnter)
            .catch(() => {
              this.isFullscreen = false;
              this.cdr.detectChanges();
            });
        } else if (extended.webkitRequestFullscreen) {
          extended.webkitRequestFullscreen();
          fitAfterEnter();
        } else if (extended.mozRequestFullScreen) {
          extended.mozRequestFullScreen();
          fitAfterEnter();
        } else if (extended.msRequestFullscreen) {
          extended.msRequestFullscreen();
          fitAfterEnter();
        } else {
          container.classList.add('fullscreen-active');
          this.isFullscreen = true;
          fitAfterEnter();
        }
      }, PDF_FULLSCREEN_ENTER_DELAY_MS);
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
      void this.renderPage();
    }, PDF_EXIT_RERENDER_MS);

    this.cdr.detectChanges();
  }

  toggleFullscreen(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  onFullscreenChange(): void {
    const currentlyFullscreen = isFullscreenActive();

    if (!currentlyFullscreen && this.isFullscreen) {
      this.isFullscreen = false;
      setTimeout(() => {
        void this.renderPage();
      }, PDF_EXIT_RERENDER_MS);
      this.cdr.detectChanges();
    } else if (currentlyFullscreen && this.isFullscreen) {
      setTimeout(() => {
        this.fitToWidth();
      }, PDF_FULLSCREEN_FIT_MS);
    }
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
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      void this.previousPage();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      void this.nextPage();
    }
  }

  downloadPdf(): void {
    if (!this.currentPdf) {
      return;
    }

    const link = document.createElement('a');
    link.href = this.currentPdf.url;
    link.download = this.currentPdf.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.toast.info(`Downloaded ${this.currentPdf.name}`);
  }

  printPdf(): void {
    if (!this.currentPdf) {
      return;
    }

    const printWindow = window.open(this.currentPdf.url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  removePdf(index: number): void {
    if (index < 0 || index >= this.pdfFiles.length) {
      return;
    }

    const pdfFile = this.pdfFiles[index];
    safeRevokeObjectUrl(pdfFile.url);
    safeDestroyPdfDoc(pdfFile.pdfDoc);

    this.pdfFiles.splice(index, 1);

    if (this.currentPdfIndex === index) {
      if (this.pdfFiles.length > 0) {
        this.currentPdfIndex = Math.min(index, this.pdfFiles.length - 1);
        void this.loadPdf(this.pdfFiles[this.currentPdfIndex]);
      } else {
        this.currentPdfIndex = -1;
        this.totalPages = 0;
        this.currentPage = 1;
        if (this.canvasContainer?.nativeElement) {
          this.canvasContainer.nativeElement.innerHTML = '';
        }
      }
    } else if (this.currentPdfIndex > index) {
      this.currentPdfIndex--;
    }

    this.cdr.detectChanges();
  }

  clearAll(): void {
    for (const pdfFile of this.pdfFiles) {
      safeRevokeObjectUrl(pdfFile.url);
      safeDestroyPdfDoc(pdfFile.pdfDoc);
    }

    this.pdfFiles = [];
    this.currentPdfIndex = -1;
    this.totalPages = 0;
    this.currentPage = 1;
    this.dismissedSuggestionId = null;

    if (this.canvasContainer?.nativeElement) {
      this.canvasContainer.nativeElement.innerHTML = '';
    }

    this.cdr.detectChanges();
  }

  formatFileSize(bytes: number): string {
    return formatPdfFileSize(bytes);
  }

  cleanup(): void {
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }

    for (const eventName of PDF_FULLSCREEN_EVENTS) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }

    if (this.renderTask) {
      this.renderTask.cancel();
    }

    this.clearAll();
  }
}
