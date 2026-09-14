import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ViewChild, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService, ToastService, toUserFacingError } from '@tools-workspace/features-home';
import { pdfNotifyError, pdfNotifyFailure, pdfNotifySuccess, pdfNotifyWarning } from '../../shared/pdf-feedback.util';
import { downloadBytes } from '../../shared/pdf.utils';
import { PdfJsLoaderService, type PdfJsLib } from '../../services/pdf-js-loader.service';
import { PdfBackendApiService } from '../../api/pdf-backend-api.service';

interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  destroy?: () => void;
}

interface PDFPageProxy {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: any }): { promise: Promise<void>; cancel?: () => void };
}

interface PdfFile {
  name: string;
  file: File;
  url: string;
  size: number;
  pdfDoc: PDFDocumentProxy | null;
  totalPages: number;
  password?: string;
  needsPassword: boolean;
  passwordError: boolean;
  /** Slice 13 — server-rendered preview for large / hard-to-open PDFs */
  previewSource: 'client' | 'server';
  serverSessionId?: string | null;
}

@Component({
  selector: 'lib-pdf-viewer',
  standalone: true,
  templateUrl: './pdf-viewer.html',
  styleUrls: ['./pdf-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation, NgIf, NgForOf, TooltipDirective]
})
export class PdfViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly pdfJsLoader = inject(PdfJsLoaderService);
  private readonly pdfBackend = inject(PdfBackendApiService);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('pdfContainer') pdfContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenCanvasContainer') fullscreenCanvasContainer!: ElementRef<HTMLDivElement>;
  
  pdfFiles: PdfFile[] = [];
  currentPdfIndex: number = -1;
  currentPage: number = 1;
  totalPages: number = 0;
  zoomLevel: number = 100;
  isFullscreen: boolean = false;
  loading: boolean = false;
  showDropZone: boolean = false;
  showPasswordDialog: boolean = false;
  passwordInput: string = '';
  passwordForPdf: PdfFile | null = null;
  passwordError: string = '';
  serverPreviewActive = false;
  
  // Drag and drop handlers
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();
  
  // Page rendering
  private renderTask: any = null;
  private isRendering: boolean = false;
  private currentViewport: { width: number; height: number } | null = null;
  private serverPageCache = new Map<string, string>(); // sessionId:page -> object URL
  
  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    // Initialize PDF.js library
    this.pdfJsLoader.getPdfJs().catch(err => {
      console.error('Failed to load PDF.js:', err);
      pdfNotifyError(this.toast, 'Failed to load PDF viewer library. Please refresh the page.');
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  get currentPdf(): PdfFile | null {
    return this.currentPdfIndex >= 0 && this.currentPdfIndex < this.pdfFiles.length
      ? this.pdfFiles[this.currentPdfIndex]
      : null;
  }

  get serverPreviewEnabled(): boolean {
    return !!this.pdfBackend.settings.enabled;
  }

  private preferServerPreview(file: File): boolean {
    if (!this.serverPreviewEnabled) return false;
    const thresholdMb = this.pdfBackend.settings.largeFileThresholdMb || 8;
    return file.size >= thresholdMb * 1024 * 1024;
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

  setupFullscreenListeners(): void {
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    for (const eventName of events) {
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
      this.processFiles(Array.from(files));
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
    }
  }

  async processFiles(files: File[]): Promise<void> {
    this.loading = true;
    
    // Ensure PDF.js is loaded
    let pdfjs: PdfJsLib;
    try {
      pdfjs = await this.pdfJsLoader.getPdfJs();
    } catch (error: unknown) {
      this.loading = false;
      pdfNotifyFailure(this.toast, error, 'Could not load the PDF viewer. Please refresh the page.');
      return;
    }
    
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        errors.push(`${file.name}: Not a PDF file`);
        continue;
      }
      
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        errors.push(`${file.name}: File too large (max 100MB)`);
        continue;
      }
      
      validFiles.push(file);
    }

    if (errors.length > 0) {
      pdfNotifyError(this.toast, errors.join('\n'));
    }

    for (const file of validFiles) {
      try {
        const url = URL.createObjectURL(file);
        
        const pdfFile: PdfFile = {
          name: file.name,
          file: file,
          url: url,
          size: file.size,
          pdfDoc: null,
          totalPages: 0,
          needsPassword: false,
          passwordError: false,
          previewSource: 'client',
          serverSessionId: null,
        };

        if (this.preferServerPreview(file)) {
          try {
            await this.openServerPreview(pdfFile);
            pdfNotifyWarning(this.toast, `${file.name}: using secure server preview (large file)`);
          } catch (serverErr) {
            // Fall back to client if server unavailable
            await this.loadPdfWithPassword(pdfFile);
          }
        } else {
          try {
            await this.loadPdfWithPassword(pdfFile);
          } catch (clientErr) {
            if (this.serverPreviewEnabled && !pdfFile.needsPassword) {
              try {
                await this.openServerPreview(pdfFile);
                pdfNotifyWarning(this.toast, `${file.name}: opened with server preview`);
              } catch {
                throw clientErr;
              }
            } else {
              throw clientErr;
            }
          }
        }
        
        this.pdfFiles.push(pdfFile);
        
        if (this.currentPdfIndex === -1 && (pdfFile.pdfDoc || pdfFile.serverSessionId)) {
          this.currentPdfIndex = this.pdfFiles.length - 1;
          this.totalPages = pdfFile.totalPages;
          this.currentPage = 1;
          this.serverPreviewActive = pdfFile.previewSource === 'server';
        }
        
        this.cdr.detectChanges();
      } catch (error) {
        errors.push(`${file.name}: ${toUserFacingError(error, 'Could not load this PDF')}`);
      }
    }

    this.loading = false;
    if (errors.length > 0) {
      pdfNotifyError(this.toast, errors.join('\n'));
    }

    this.cdr.detectChanges();

    if (this.currentPdf?.pdfDoc || this.currentPdf?.serverSessionId) {
      await this.scheduleRenderPage();
    }
    
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  async openServerPreview(pdfFile: PdfFile, password?: string): Promise<void> {
    if (!this.serverPreviewEnabled) {
      throw new Error('Server preview is unavailable');
    }
    const session = await this.pdfBackend.openPreviewSession(pdfFile.file, {
      password: password || pdfFile.password,
      fileName: pdfFile.name,
    });
    if (!session.sessionId || !session.pageCount) {
      throw new Error('Server did not return a preview session');
    }
    pdfFile.previewSource = 'server';
    pdfFile.serverSessionId = session.sessionId;
    pdfFile.totalPages = session.pageCount;
    pdfFile.pdfDoc = null;
    pdfFile.needsPassword = false;
    pdfFile.passwordError = false;
    if (password) {
      pdfFile.password = password;
    }
  }

  async loadPdfWithPassword(pdfFile: PdfFile, password?: string): Promise<void> {
    try {
      const pdfjs = await this.pdfJsLoader.getPdfJs();
      
      // If password is provided, use it
      if (password) {
        pdfFile.password = password;
        pdfFile.passwordError = false;
      }
      
      const loadingTask = pdfjs.getDocument({
        url: pdfFile.url,
        password: pdfFile.password,
        passwordCallback: (updatePassword: (password: string) => void, reason: any) => {
          // PDF.js needs a password
          pdfFile.needsPassword = true;
          pdfFile.passwordError = false;
          
          // Show password dialog
          this.passwordForPdf = pdfFile;
          this.passwordInput = pdfFile.password || '';
          this.showPasswordDialog = true;
          this.passwordError = '';
          this.cdr.detectChanges();
          
          // Return a promise that resolves when user enters password
          return new Promise<string>((resolve) => {
            // Store resolve function to be called when password is submitted
            (pdfFile as any).passwordResolver = (pwd: string) => {
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
      const pdfjsInstance = await this.pdfJsLoader.getPdfJs();
      
      // Check if it's a password error
      const isPasswordError = errorMessage.toLowerCase().includes('password') || 
                              (error as any)?.code === pdfjsInstance.PasswordResponses?.INCORRECT_PASSWORD ||
                              (error as any)?.name === 'PasswordException';
      
      if (isPasswordError) {
        pdfFile.passwordError = true;
        pdfFile.needsPassword = true;
        this.passwordForPdf = pdfFile;
        this.showPasswordDialog = true;
        this.passwordError = 'Incorrect password. Please try again.';
        this.passwordInput = '';
        this.cdr.detectChanges();
        throw error;
      } else {
        pdfNotifyFailure(this.toast, error, 'Could not load the PDF');
        throw error;
      }
    }
  }

  async loadPdf(pdfFile: PdfFile): Promise<void> {
    if (pdfFile.previewSource === 'server' && pdfFile.serverSessionId) {
      this.totalPages = pdfFile.totalPages;
      this.currentPage = 1;
      this.serverPreviewActive = true;
      await this.scheduleRenderPage();
      return;
    }
    if (!pdfFile.pdfDoc) {
      try {
        await this.loadPdfWithPassword(pdfFile);
      } catch (error) {
        // Error handling is done in loadPdfWithPassword
        return;
      }
    }
    
    this.totalPages = pdfFile.totalPages;
    this.currentPage = 1;
    this.serverPreviewActive = false;
    await this.scheduleRenderPage();
  }

  submitPassword(): void {
    if (!this.passwordForPdf || !this.passwordInput.trim()) {
      this.passwordError = 'Please enter a password';
      return;
    }
    
    const pdfFile = this.passwordForPdf;
    const password = this.passwordInput.trim();
    
    // Close dialog temporarily
    this.showPasswordDialog = false;
    this.loading = true;
    this.cdr.detectChanges();
    
    // Resolve the password callback if it exists
    if ((pdfFile as any).passwordResolver) {
      (pdfFile as any).passwordResolver(password);
    }
    
    const finishOk = () => {
      this.loading = false;
      this.passwordForPdf = null;
      this.passwordInput = '';
      this.passwordError = '';
      if (this.currentPdfIndex === this.pdfFiles.indexOf(pdfFile)) {
        void this.loadPdf(pdfFile);
      }
      this.cdr.detectChanges();
    };

    // Prefer client unlock; fall back to server preview for encrypted/large files.
    this.loadPdfWithPassword(pdfFile, password).then(finishOk).catch(() => {
      if (!this.serverPreviewEnabled) {
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }
      this.openServerPreview(pdfFile, password)
        .then(() => {
          pdfNotifySuccess(this.toast, 'Opened with secure server preview');
          finishOk();
        })
        .catch((error: unknown) => {
          this.loading = false;
          this.passwordError = toUserFacingError(error, 'Incorrect password or server preview failed');
          this.showPasswordDialog = true;
          this.cdr.detectChanges();
        });
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
      this.serverPreviewActive = this.pdfFiles[index].previewSource === 'server';
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

  private async scheduleRenderPage(): Promise<void> {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    await this.renderPage();
  }

  async renderPage(): Promise<void> {
    if (!this.currentPdf || this.isRendering) {
      return;
    }
    if (this.currentPdf.previewSource === 'server' && this.currentPdf.serverSessionId) {
      await this.renderServerPage();
      return;
    }
    if (!this.currentPdf.pdfDoc) {
      return;
    }

    this.isRendering = true;
    
    // Cancel previous render task
    if (this.renderTask) {
      this.renderTask.cancel();
    }

    try {
      const page = await this.currentPdf.pdfDoc.getPage(this.currentPage);
      
      // Get base viewport at 100% scale to store for fit-to-width calculations
      const baseViewport = page.getViewport({ scale: 1 });
      this.currentViewport = { width: baseViewport.width, height: baseViewport.height };
      
      // Get device pixel ratio for high-DPI displays (Retina, 4K, etc.)
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Use a higher scale for better quality rendering
      const outputScale = devicePixelRatio;
      const zoomScale = this.zoomLevel / 100;
      
      // Calculate viewport at the display scale
      const viewport = page.getViewport({ scale: zoomScale });
      
      // Create canvas with higher resolution for better quality
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Set canvas internal size with device pixel ratio for crisp rendering
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.width = Math.floor(viewport.width * outputScale);
      
      // Set CSS size to match the viewport (for display)
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';
      
      // Scale the context to match device pixel ratio
      if (outputScale !== 1) {
        context.scale(outputScale, outputScale);
      }
      
      // Render to appropriate container based on fullscreen state
      if (this.isFullscreen && this.fullscreenCanvasContainer?.nativeElement) {
        this.fullscreenCanvasContainer.nativeElement.innerHTML = '';
        this.fullscreenCanvasContainer.nativeElement.appendChild(canvas);
      } else if (this.canvasContainer?.nativeElement) {
        this.canvasContainer.nativeElement.innerHTML = '';
        this.canvasContainer.nativeElement.appendChild(canvas);
      }
      
      // Create render context
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      this.renderTask = page.render(renderContext);
      await this.renderTask.promise;
      
      this.cdr.detectChanges();
    } catch (error) {
      if (error instanceof Error && error.name !== 'RenderingCancelledException') {
        pdfNotifyFailure(this.toast, error, 'Could not render this page');
      }
    } finally {
      this.isRendering = false;
      this.renderTask = null;
    }
  }

  private async renderServerPage(): Promise<void> {
    const pdf = this.currentPdf;
    if (!pdf?.serverSessionId) return;
    this.isRendering = true;
    this.serverPreviewActive = true;
    try {
      const cacheKey = `${pdf.serverSessionId}:${this.currentPage}:${this.zoomLevel}`;
      let objectUrl = this.serverPageCache.get(cacheKey);
      if (!objectUrl) {
        const dpi = Math.min(200, Math.max(96, Math.round(120 * (this.zoomLevel / 100))));
        const blob = await this.pdfBackend.fetchPreviewPage(pdf.serverSessionId, this.currentPage, dpi);
        objectUrl = URL.createObjectURL(blob);
        this.serverPageCache.set(cacheKey, objectUrl);
      }
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not load preview image'));
        img.src = objectUrl!;
      });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Could not get canvas context');
      const zoomScale = this.zoomLevel / 100;
      const displayW = Math.floor(img.naturalWidth * (zoomScale > 1 ? 1 : zoomScale));
      const displayH = Math.floor(img.naturalHeight * (zoomScale > 1 ? 1 : zoomScale));
      // When zoom > 100%, server already rendered higher DPI; show natural size scaled by CSS
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.width = (this.zoomLevel >= 100 ? Math.floor(img.naturalWidth * (this.zoomLevel / 100)) : displayW) + 'px';
      canvas.style.height = (this.zoomLevel >= 100 ? Math.floor(img.naturalHeight * (this.zoomLevel / 100)) : displayH) + 'px';
      context.drawImage(img, 0, 0);
      this.currentViewport = { width: img.naturalWidth, height: img.naturalHeight };

      if (this.isFullscreen && this.fullscreenCanvasContainer?.nativeElement) {
        this.fullscreenCanvasContainer.nativeElement.innerHTML = '';
        this.fullscreenCanvasContainer.nativeElement.appendChild(canvas);
      } else if (this.canvasContainer?.nativeElement) {
        this.canvasContainer.nativeElement.innerHTML = '';
        this.canvasContainer.nativeElement.appendChild(canvas);
      }
      this.cdr.detectChanges();
    } catch (error) {
      pdfNotifyFailure(this.toast, error, 'Could not render server preview page');
    } finally {
      this.isRendering = false;
    }
  }

  zoomIn(): void {
    if (this.zoomLevel < 300) {
      this.zoomLevel = Math.min(this.zoomLevel + 25, 300);
      this.renderPage();
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 50) {
      this.zoomLevel = Math.max(this.zoomLevel - 25, 50);
      this.renderPage();
    }
  }

  fitToWidth(): void {
    if (this.canvasContainer?.nativeElement && this.currentPdf && this.currentViewport) {
      const container = this.canvasContainer.nativeElement;
      const containerWidth = container.clientWidth - 128;
      
      if (this.currentViewport.width > 0) {
        const scale = containerWidth / this.currentViewport.width;
        this.zoomLevel = Math.max(50, Math.min(300, Math.round(scale * 100)));
        this.renderPage();
      }
    }
  }

  resetZoom(): void {
    this.zoomLevel = 100;
    this.renderPage();
  }

  enterFullscreen(): void {
    if (!this.currentPdf) return;
    
    this.isFullscreen = true;
    this.cdr.detectChanges();
    
    setTimeout(() => {
      const container = this.fullscreenContainer?.nativeElement;
      if (!container) {
        console.error('Fullscreen container not found');
        this.isFullscreen = false;
        this.cdr.detectChanges();
        return;
      }

      if (container.requestFullscreen) {
        container.requestFullscreen().catch((err: Error) => {
          console.error('Error attempting to enable fullscreen:', err);
          this.isFullscreen = false;
          this.cdr.detectChanges();
        });
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        (container as any).mozRequestFullScreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      } else {
        container.classList.add('fullscreen-active');
        this.isFullscreen = true;
      }
      
      setTimeout(() => {
        void this.scheduleRenderPage();
      }, 100);
    }, 0);
  }

  exitFullscreen(): void {
    this.isFullscreen = false;
    
    if (document.exitFullscreen) {
      document.exitFullscreen().catch((err: Error) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
    
    if (this.fullscreenContainer?.nativeElement) {
      this.fullscreenContainer.nativeElement.classList.remove('fullscreen-active');
    }
    
    setTimeout(() => {
      void this.scheduleRenderPage();
    }, 100);
    
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
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    
    if (!isCurrentlyFullscreen && this.isFullscreen) {
      this.isFullscreen = false;
      this.cdr.detectChanges();
      void this.scheduleRenderPage();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
    } else if (e.key === 'ArrowLeft' && !this.isFullscreen) {
      this.previousPage();
    } else if (e.key === 'ArrowRight' && !this.isFullscreen) {
      this.nextPage();
    }
  }

  downloadPdf(): void {
    void this.downloadPdfAsync();
  }

  private async downloadPdfAsync(): Promise<void> {
    if (!this.currentPdf) return;

    try {
      const buffer = await this.currentPdf.file.arrayBuffer();
      downloadBytes(new Uint8Array(buffer), this.currentPdf.name);
      pdfNotifySuccess(this.toast, 'Download started');
    } catch (error) {
      pdfNotifyFailure(this.toast, error, 'Could not download the PDF');
    }
  }

  printPdf(): void {
    if (!this.currentPdf) return;
    
    const printWindow = window.open(this.currentPdf.url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  removePdf(index: number): void {
    if (index >= 0 && index < this.pdfFiles.length) {
      const pdfFile = this.pdfFiles[index];
      
      if (pdfFile.url) {
        URL.revokeObjectURL(pdfFile.url);
      }
      
      if (pdfFile.pdfDoc) {
        pdfFile.pdfDoc.destroy?.();
      }
      
      this.pdfFiles.splice(index, 1);
      
      if (this.currentPdfIndex === index) {
        if (this.pdfFiles.length > 0) {
          this.currentPdfIndex = Math.min(index, this.pdfFiles.length - 1);
          this.loadPdf(this.pdfFiles[this.currentPdfIndex]);
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
  }

  clearAll(): void {
    for (const pdfFile of this.pdfFiles) {
      if (pdfFile.url) {
        URL.revokeObjectURL(pdfFile.url);
      }
      if (pdfFile.pdfDoc) {
        pdfFile.pdfDoc.destroy?.();
      }
    }
    for (const url of this.serverPageCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.serverPageCache.clear();
    this.serverPreviewActive = false;
    
    this.pdfFiles = [];
    this.currentPdfIndex = -1;
    this.totalPages = 0;
    this.currentPage = 1;
    
    if (this.canvasContainer?.nativeElement) {
      this.canvasContainer.nativeElement.innerHTML = '';
    }
    
    this.cdr.detectChanges();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  cleanup(): void {
    // Cleanup drag and drop
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
    
    // Cleanup fullscreen listeners
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    for (const eventName of events) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }
    
    // Cancel render task
    if (this.renderTask) {
      this.renderTask.cancel();
    }
    
    // Cleanup PDFs
    this.clearAll();
  }
}
