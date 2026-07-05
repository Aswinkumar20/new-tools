import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ViewChild, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

// PDF.js types - using dynamic import to avoid build-time dependency issues
interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  destroy(): void;
}

interface PDFPageProxy {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: any }): { promise: Promise<void>; cancel(): void };
}

declare const pdfjsLib: {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { 
    url: string;
    password?: string;
    passwordCallback?: (updatePassword: (password: string) => void, reason: any) => void;
  }): { promise: Promise<PDFDocumentProxy> };
  PasswordResponses: {
    NEED_PASSWORD: number;
    INCORRECT_PASSWORD: number;
  };
};

// Load PDF.js dynamically from CDN
async function loadPdfJs(): Promise<typeof pdfjsLib> {
  if (globalThis.window === undefined) {
    throw new TypeError('PDF.js can only be loaded in browser environment');
  }

  // Check if already loaded
  if ((globalThis as any).pdfjsLib) {
    return (globalThis as any).pdfjsLib;
  }

  // Load PDF.js from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const pdfjs = (globalThis as any).pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      (globalThis as any).pdfjsLib = pdfjs;
      resolve(pdfjs);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js library'));
  });
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
  errorMessage: string = '';
  showDropZone: boolean = false;
  showPasswordDialog: boolean = false;
  passwordInput: string = '';
  passwordForPdf: PdfFile | null = null;
  passwordError: string = '';
  
  // Drag and drop handlers
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();
  
  // Page rendering
  private renderTask: any = null;
  private isRendering: boolean = false;
  private currentViewport: { width: number; height: number } | null = null;
  
  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    // Initialize PDF.js library
    loadPdfJs().catch(err => {
      console.error('Failed to load PDF.js:', err);
      this.errorMessage = 'Failed to load PDF viewer library. Please refresh the page.';
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

  setupDragAndDrop(): void {
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
    this.errorMessage = '';
    this.loading = true;
    
    // Ensure PDF.js is loaded
    let pdfjs: typeof pdfjsLib;
    try {
      pdfjs = await loadPdfJs();
    } catch (error: unknown) {
      this.loading = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.errorMessage = `Failed to load PDF viewer library: ${message}. Please refresh the page.`;
      console.error('PDF.js load error:', error);
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
      this.errorMessage = errors.join('\n');
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
          passwordError: false
        };
        
        // Try to load the PDF with password callback
        await this.loadPdfWithPassword(pdfFile);
        
        this.pdfFiles.push(pdfFile);
        
        if (this.currentPdfIndex === -1 && pdfFile.pdfDoc) {
          this.currentPdfIndex = this.pdfFiles.length - 1;
          await this.loadPdf(pdfFile);
        }
        
        this.cdr.detectChanges();
      } catch (error) {
        errors.push(`${file.name}: Failed to load PDF - ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const pdfjs = await loadPdfJs();
      
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
      const pdfjsInstance = await loadPdfJs();
      
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
        this.errorMessage = `Failed to load PDF: ${errorMessage}`;
        throw error;
      }
    }
  }

  async loadPdf(pdfFile: PdfFile): Promise<void> {
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
    await this.renderPage();
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
    
    // Try to load PDF with the new password
    this.loadPdfWithPassword(pdfFile, password).then(() => {
      this.loading = false;
      this.passwordForPdf = null;
      this.passwordInput = '';
      this.passwordError = '';
      
      // If this is the current PDF, render it
      if (this.currentPdfIndex === this.pdfFiles.indexOf(pdfFile)) {
        this.loadPdf(pdfFile);
      }
      
      this.cdr.detectChanges();
    }).catch((error: unknown) => {
      this.loading = false;
      // Error handling will show the password dialog again if password is wrong
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
        this.errorMessage = `Failed to render page: ${error.message}`;
      }
    } finally {
      this.isRendering = false;
      this.renderTask = null;
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
        this.renderPage();
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
      this.renderPage();
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
    if (!this.currentPdf) return;
    
    const link = document.createElement('a');
    link.href = this.currentPdf.url;
    link.download = this.currentPdf.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
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
        pdfFile.pdfDoc.destroy();
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
        pdfFile.pdfDoc.destroy();
      }
    }
    
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
