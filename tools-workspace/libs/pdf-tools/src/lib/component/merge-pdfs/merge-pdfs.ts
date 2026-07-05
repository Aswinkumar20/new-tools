import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { PDFDocument } from 'pdf-lib';

interface PdfFile {
  file: File;
  name: string;
  size: number;
  pageCount: number;
  pdfBytes: Uint8Array;
  pdfDoc: PDFDocument | null;
  password?: string;
  needsPassword: boolean;
  passwordError: boolean;
  index?: number; // Track file index for password dialog
}

@Component({
  selector: 'lib-merge-pdfs',
  standalone: true,
  templateUrl: './merge-pdfs.html',
  styleUrls: ['./merge-pdfs.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective]
})
export class MergePdfsComponent implements OnInit {
  readonly assetService = inject(AssetService);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('previewCanvas') previewCanvas?: ElementRef<HTMLCanvasElement>;

  // PDF files
  pdfFiles: PdfFile[] = [];
  totalPages: number = 0;
  
  // UI state
  showDropZone: boolean = false;
  loading: boolean = false;
  loadingMessage: string = 'Processing...';
  errorMessage: string = '';
  successMessage: string = '';
  
  // Password handling
  showPasswordDialog: boolean = false;
  passwordInput: string = '';
  passwordForFile: PdfFile | null = null;
  passwordError: string = '';
  processingPasswordFile: boolean = false;
  
  // Merge options
  preserveBookmarks: boolean = true;
  removeDuplicatePages: boolean = false;
  outputFilename: string = 'merged-document.pdf';
  
  // Preview
  mergedPdfPreview: PDFDocument | null = null;
  previewPage: number = 1;
  private pdfjsLib: any = null;
  private mergedPdfBytes: Uint8Array | null = null;
  private previewRenderRetries: number = 0;
  private readonly maxPreviewRetries: number = 10;
  private cachedPdfDocument: any = null; // Cache PDF.js document
  private currentRenderTask: any = null; // Track current render task to cancel if needed
  
  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadPdfJs();
  }

  async loadPdfJs(): Promise<void> {
    if (globalThis.window === undefined) return;
    
    if ((globalThis as any).pdfjsLib) {
      this.pdfjsLib = (globalThis as any).pdfjsLib;
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    document.head.appendChild(script);

    return new Promise((resolve, reject) => {
      script.onload = () => {
        this.pdfjsLib = (globalThis as any).pdfjsLib;
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
    });
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
    }
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.showDropZone = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.showDropZone = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.showDropZone = false;

    if (event.dataTransfer?.files) {
      const files = Array.from(event.dataTransfer.files).filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      );
      if (files.length > 0) {
        this.processFiles(files);
      } else {
        this.errorMessage = 'Please drop valid PDF files';
      }
    }
  }

  async processFiles(files: File[]): Promise<void> {
    this.loading = true;
    this.loadingMessage = 'Loading PDF files...';
    this.errorMessage = '';

    try {
      for (const file of files) {
        if (file.size > 100 * 1024 * 1024) {
          this.errorMessage = `File "${file.name}" is too large (max 100MB)`;
          continue;
        }

        await this.loadPdfFile(file);
      }

      this.updateTotalPages();
      this.cdr.detectChanges();
    } catch (error) {
      this.errorMessage = `Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async loadPdfFile(file: File, password?: string): Promise<void> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      
      // Try to load PDF with or without password
      let pdfDoc: PDFDocument;
      try {
        // pdf-lib handles encrypted PDFs - try loading without password first
        // If encrypted, it will throw an error we can catch
        const loadOptions: any = {};
        if (password) {
          loadOptions.password = password;
        }
        pdfDoc = await PDFDocument.load(pdfBytes, loadOptions);
      } catch (loadError: unknown) {
        // Check if it's a password/encryption error
        const loadErrorObj = loadError as Error;
        const errorMessage = loadErrorObj?.message || '';
        const isPasswordError = errorMessage.toLowerCase().includes('password') || 
                                errorMessage.toLowerCase().includes('encrypted') ||
                                errorMessage.toLowerCase().includes('decrypt');
        
        if (isPasswordError) {
          if (password === undefined) {
            // Password required - show dialog
            const fileIndex = this.pdfFiles.length;
            const pdfFile: PdfFile = {
              file,
              name: file.name,
              size: file.size,
              pageCount: 0,
              pdfBytes,
              pdfDoc: null,
              password: undefined,
              needsPassword: true,
              passwordError: false,
              index: fileIndex
            };
            
            this.pdfFiles.push(pdfFile);
            this.showPasswordDialogForFile(pdfFile);
            return;
          } else {
            // Incorrect password - show error
            const existingFile = this.pdfFiles.find(f => f.file === file);
            if (existingFile) {
              existingFile.passwordError = true;
              existingFile.needsPassword = true;
              this.showPasswordDialogForFile(existingFile);
              this.passwordError = 'Incorrect password. Please try again.';
              return;
            }
          }
        }
        // Re-throw non-password errors
        throw loadError;
      }
      
      const pageCount = pdfDoc.getPageCount();
      
      // Check if file already exists (from password dialog)
      const existingIndex = this.pdfFiles.findIndex(f => f.file === file);
      if (existingIndex >= 0) {
        // Update existing entry
        this.pdfFiles[existingIndex] = {
          ...this.pdfFiles[existingIndex],
          pdfDoc,
          pageCount,
          password: password || this.pdfFiles[existingIndex].password,
          needsPassword: false,
          passwordError: false
        };
      } else {
        // Add new entry
        this.pdfFiles.push({
          file,
          name: file.name,
          size: file.size,
          pageCount,
          pdfBytes,
          pdfDoc,
          password: password,
          needsPassword: false,
          passwordError: false
        });
      }

      this.updateTotalPages();
      this.cdr.detectChanges();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.errorMessage = `Failed to load PDF "${file.name}": ${errorMessage}`;
      throw error;
    }
  }

  showPasswordDialogForFile(pdfFile: PdfFile): void {
    this.passwordForFile = pdfFile;
    this.passwordInput = pdfFile.password || '';
    this.showPasswordDialog = true;
    this.passwordError = '';
    this.loading = false;
    this.processingPasswordFile = true;
    this.cdr.detectChanges();
  }

  async submitPassword(): Promise<void> {
    if (!this.passwordForFile || !this.passwordInput.trim()) {
      this.passwordError = 'Please enter a password';
      return;
    }

    this.passwordError = '';
    const password = this.passwordInput.trim();
    const pdfFile = this.passwordForFile;
    
    // Hide dialog temporarily
    this.showPasswordDialog = false;
    this.loading = true;
    this.loadingMessage = 'Unlocking PDF...';
    this.cdr.detectChanges();

    try {
      await this.loadPdfFile(pdfFile.file, password);
      
      // Success - close dialog
      this.passwordForFile = null;
      this.passwordInput = '';
      this.passwordError = '';
      this.processingPasswordFile = false;
      this.loading = false;
      this.cdr.detectChanges();
    } catch (error) {
      // Error - show dialog again with error message
      this.passwordError = 'Incorrect password. Please try again.';
      this.passwordInput = '';
      this.showPasswordDialog = true;
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  cancelPassword(): void {
    if (this.passwordForFile) {
      // Remove the file that requires password
      const index = this.pdfFiles.findIndex(f => f.file === this.passwordForFile!.file);
      if (index >= 0) {
        this.pdfFiles.splice(index, 1);
        this.updateTotalPages();
      }
    }
    
    this.showPasswordDialog = false;
    this.passwordForFile = null;
    this.passwordInput = '';
    this.passwordError = '';
    this.processingPasswordFile = false;
    this.loading = false;
    this.cdr.detectChanges();
  }

  onPasswordKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.submitPassword();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelPassword();
    }
  }

  hasFilesNeedingPassword(): boolean {
    return this.pdfFiles.some(file => file.needsPassword && !file.pdfDoc);
  }

  downloadMergedPdf(): void {
    if (!this.mergedPdfBytes) {
      this.errorMessage = 'No merged PDF available to download';
      return;
    }

    try {
      const blob = new Blob([this.mergedPdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.outputFilename || 'merged-document.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      
      this.successMessage = 'Download started!';
      setTimeout(() => {
        this.successMessage = '';
        this.cdr.detectChanges();
      }, 3000);
    } catch (error) {
      this.errorMessage = `Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  removeFile(index: number): void {
    this.pdfFiles.splice(index, 1);
    this.updateTotalPages();
    this.mergedPdfPreview = null;
    this.mergedPdfBytes = null;
    this.cdr.detectChanges();
  }

  clearAll(): void {
    this.pdfFiles = [];
    this.totalPages = 0;
    this.mergedPdfPreview = null;
    this.mergedPdfBytes = null;
    this.previewPage = 1;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();
  }

  moveFileUp(index: number): void {
    if (index > 0) {
      [this.pdfFiles[index - 1], this.pdfFiles[index]] = [this.pdfFiles[index], this.pdfFiles[index - 1]];
      this.mergedPdfPreview = null;
      this.mergedPdfBytes = null;
      this.cdr.detectChanges();
    }
  }

  moveFileDown(index: number): void {
    if (index < this.pdfFiles.length - 1) {
      [this.pdfFiles[index], this.pdfFiles[index + 1]] = [this.pdfFiles[index + 1], this.pdfFiles[index]];
      this.mergedPdfPreview = null;
      this.mergedPdfBytes = null;
      this.cdr.detectChanges();
    }
  }

  isDragging(index: number): boolean {
    return false;
  }

  onFileDragStart(event: DragEvent, index: number): void {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
    (event.currentTarget as HTMLElement).classList.add('dragging');
  }

  onFileDragEnd(event: DragEvent): void {
    (event.currentTarget as HTMLElement).classList.remove('dragging');
  }

  onFileDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onFileDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer) return;

    const sourceIndex = Number.parseInt(event.dataTransfer.getData('text/plain'), 10);
    if (Number.isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const item = this.pdfFiles.splice(sourceIndex, 1)[0];
    this.pdfFiles.splice(targetIndex, 0, item);
    
    this.mergedPdfPreview = null;
    this.mergedPdfBytes = null;
    this.cdr.detectChanges();
  }

  updateTotalPages(): void {
    this.totalPages = this.pdfFiles.reduce((sum, pdfFile) => sum + pdfFile.pageCount, 0);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatTotalSize(): string {
    const totalBytes = this.pdfFiles.reduce((sum, pdfFile) => sum + pdfFile.size, 0);
    return this.formatFileSize(totalBytes);
  }

  async mergePdfs(): Promise<void> {
    if (this.pdfFiles.length < 2) {
      this.errorMessage = 'Please add at least 2 PDF files to merge';
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Merging PDFs...';
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const mergedPdf = await PDFDocument.create();

      // Copy pages from all PDFs in order
      await this.copyPagesToMergedPdf(mergedPdf);

      const mergedBytes = await mergedPdf.save();
      this.mergedPdfBytes = mergedBytes;
      this.mergedPdfPreview = mergedPdf;
      this.previewPage = 1;
      this.totalPages = mergedPdf.getPageCount();
      
      // Clear cached PDF document to force reload
      this.cachedPdfDocument = null;

      // Update view first, then render preview
      this.previewRenderRetries = 0;
      this.cdr.detectChanges();
      
      // Wait for view to update before rendering preview
      setTimeout(async () => {
        await this.renderPreview();
        this.cdr.detectChanges();
      }, 0);

      this.successMessage = 'PDFs merged successfully! Preview is ready below.';
      this.cdr.detectChanges();
    } catch (error) {
      this.errorMessage = `Failed to merge PDFs: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private async copyPagesToMergedPdf(mergedPdf: PDFDocument): Promise<void> {
    const seenPages = new Set<string>();

    for (const pdfFile of this.pdfFiles) {
      // Skip files that don't have a loaded PDF document
      if (!pdfFile.pdfDoc) {
        continue;
      }
      
      const pages = await mergedPdf.copyPages(pdfFile.pdfDoc, 
        pdfFile.pdfDoc.getPageIndices()
      );

      for (const page of pages) {
        if (this.removeDuplicatePages) {
          // Simple hash based on page dimensions as fallback
          const pageSize = page.getSize();
          const contentHash = `${pageSize.width}_${pageSize.height}`;
          
          if (seenPages.has(contentHash)) {
            continue; // Skip potential duplicate page
          }
          seenPages.add(contentHash);
        }

        mergedPdf.addPage(page);
      }
    }
  }

  async renderPreview(): Promise<void> {
    if (!this.pdfjsLib || !this.mergedPdfBytes) return;
    
    // Check if canvas element exists in DOM
    if (!this.previewCanvas?.nativeElement) {
      // Retry after a short delay if canvas is not available yet
      if (this.previewRenderRetries < this.maxPreviewRetries) {
        this.previewRenderRetries++;
        setTimeout(() => this.renderPreview(), 100);
      }
      return;
    }
    
    // Reset retry counter on success
    this.previewRenderRetries = 0;

    const canvas = this.previewCanvas.nativeElement;
    const context = canvas.getContext('2d');
    
    if (!context) return;

    try {
      // Cancel any ongoing render task
      if (this.currentRenderTask) {
        try {
          this.currentRenderTask.cancel();
        } catch {
          // Ignore cancellation errors - task may have already completed
        }
        this.currentRenderTask = null;
      }

      // Load or use cached PDF document
      if (!this.cachedPdfDocument) {
        const loadingTask = this.pdfjsLib.getDocument({ data: this.mergedPdfBytes });
        this.cachedPdfDocument = await loadingTask.promise;
      }

      // Validate page number (PDF.js uses 1-based indexing)
      const numPages = this.cachedPdfDocument.numPages;
      
      if (this.previewPage < 1 || this.previewPage > numPages) {
        console.error(`Invalid page number: ${this.previewPage} (total pages: ${numPages})`);
        return;
      }

      // Get the page (PDF.js uses 1-based page numbers)
      const page = await this.cachedPdfDocument.getPage(this.previewPage);

      const container = canvas.parentElement;
      const containerWidth = container ? container.clientWidth - 32 : 400;
      const maxWidth = containerWidth;

      const viewportAtScale1 = page.getViewport({ scale: 1 });
      const scale = maxWidth / viewportAtScale1.width;
      const viewport = page.getViewport({ scale });

      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.maxWidth = '100%';

      const devicePixelRatio = window.devicePixelRatio || 1;
      const outputScale = devicePixelRatio;
      
      // Set canvas dimensions (this automatically clears the canvas)
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);

      // Reset transform to identity matrix
      context.setTransform(1, 0, 0, 1, 0, 0);
      
      // Clear the canvas (should be cleared by setting width/height, but ensure it's cleared)
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Scale context for high DPI
      context.scale(outputScale, outputScale);

      // Render the page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      // Store render task and await it
      this.currentRenderTask = page.render(renderContext);
      await this.currentRenderTask.promise;
      this.currentRenderTask = null;

    } catch (error) {
      console.error('Error rendering preview:', error);
      this.errorMessage = `Failed to render preview: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async previousPreviewPage(): Promise<void> {
    if (this.previewPage > 1) {
      this.previewPage--;
      await this.renderPreview();
      this.cdr.detectChanges();
    }
  }

  async nextPreviewPage(): Promise<void> {
    if (this.mergedPdfPreview && this.previewPage < this.totalPages) {
      this.previewPage++;
      await this.renderPreview();
      this.cdr.detectChanges();
    }
  }

  async goToPreviewPage(page: number): Promise<void> {
    if (page >= 1 && page <= this.totalPages) {
      this.previewPage = page;
      await this.renderPreview();
      this.cdr.detectChanges();
    }
  }

  get Math(): typeof Math {
    return Math;
  }
}
