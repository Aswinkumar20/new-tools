import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { pdfNotifyError, pdfNotifySuccess, pdfNotifyWarning } from '../../shared/pdf-feedback.util';
import { PDFDocument } from 'pdf-lib';
import { validateOutputFilename } from '../../shared/pdf.validation';
import { fullscreenPreviewWidth } from '../../shared/pdf-fullscreen.util';
import { downloadBytes, downloadBlob } from '../../shared/pdf.utils';
import { PdfPreviewService } from '../../services/pdf-preview.service';
import { PdfFullscreenOverlayComponent } from '../pdf-fullscreen-overlay/pdf-fullscreen-overlay';

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
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective, PdfFullscreenOverlayComponent]
})
export class MergePdfsComponent implements OnInit {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly preview = inject(PdfPreviewService);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('previewCanvas') previewCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('optionsFlyout') optionsFlyout?: ElementRef<HTMLElement>;
  @ViewChild(PdfFullscreenOverlayComponent) fullscreenOverlay?: PdfFullscreenOverlayComponent;

  previewFullscreen = false;
  optionsPanelOpen = true;

  // PDF files
  pdfFiles: PdfFile[] = [];
  totalPages: number = 0;
  
  // UI state
  showDropZone: boolean = false;
  loading: boolean = false;
  loadingMessage: string = 'Processing...';
  
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

  get needsMoreFiles(): boolean {
    return this.pdfFiles.length > 0 && this.pdfFiles.length < 2;
  }

  get canClearAll(): boolean {
    return this.pdfFiles.length > 0 && !this.loading;
  }

  get canMerge(): boolean {
    return this.pdfFiles.length >= 2 && !this.hasFilesNeedingPassword() && !this.loading;
  }

  get canDownloadMerged(): boolean {
    return this.canMerge;
  }

  get mergeSetupHint(): string {
    if (!this.pdfFiles.length) return 'Add at least two PDF files to merge.';
    if (this.needsMoreFiles) return 'Add one more PDF file, then review merge options in Configuration.';
    return 'Review output filename and merge options in Configuration before downloading.';
  }

  openOptionsPanel(): void {
    this.optionsPanelOpen = true;
    this.optionsFlyout?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this.cdr.detectChanges();
  }

  toggleOptionsPanel(): void {
    this.optionsPanelOpen = !this.optionsPanelOpen;
    this.cdr.detectChanges();
  }
  
  // Preview
  mergedPdfPreview: PDFDocument | null = null;
  previewPage: number = 1;
  private mergedPdfBytes: Uint8Array | null = null;
  private previewRenderRetries: number = 0;
  private readonly maxPreviewRetries: number = 10;
  private previewRenderGeneration = 0;
  
  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    /* PDF preview uses PdfPreviewService */
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
        pdfNotifyError(this.toast, 'Please drop valid PDF files');
      }
    }
  }

  async processFiles(files: File[]): Promise<void> {
    this.loading = true;
    this.loadingMessage = 'Loading PDF files...';

    try {
      for (const file of files) {
        if (file.size > 100 * 1024 * 1024) {
          pdfNotifyError(this.toast, `File "${file.name}" is too large (max 100MB)`);
          continue;
        }

        await this.loadPdfFile(file);
      }

      this.updateTotalPages();
      this.cdr.detectChanges();
    } catch (error) {
      pdfNotifyError(this.toast, `Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      pdfNotifyError(this.toast, `Failed to load PDF "${file.name}": ${errorMessage}`);
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
    void this.downloadMergedPdfAsync();
  }

  private async buildMergedBytes(): Promise<Uint8Array | null> {
    if (this.pdfFiles.length < 2) return null;
    if (this.hasFilesNeedingPassword()) return null;

    const mergedPdf = await PDFDocument.create();
    await this.copyPagesToMergedPdf(mergedPdf);
    return this.buildMergedBytesFromDoc(mergedPdf);
  }

  private async buildMergedBytesFromDoc(mergedPdf: PDFDocument): Promise<Uint8Array> {
    return new Uint8Array(await mergedPdf.save());
  }

  private async downloadMergedPdfAsync(): Promise<void> {
    const filenameErr = validateOutputFilename(this.outputFilename || 'merged-document.pdf');
    if (filenameErr) {
      pdfNotifyError(this.toast, filenameErr);
      return;
    }

    if (this.pdfFiles.length < 2) {
      pdfNotifyWarning(this.toast, 'Add at least two PDF files before downloading');
      return;
    }

    if (this.hasFilesNeedingPassword()) {
      pdfNotifyWarning(this.toast, 'Unlock password-protected PDFs before downloading');
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Preparing download…';
    this.cdr.detectChanges();

    try {
      const bytes = await this.buildMergedBytes();
      if (!bytes?.length) {
        pdfNotifyError(this.toast, 'No merged PDF available to download');
        return;
      }
      this.mergedPdfBytes = bytes;
      downloadBytes(bytes, this.outputFilename || 'merged-document.pdf');
      pdfNotifySuccess(this.toast, 'Download started!');
    } catch (error) {
      pdfNotifyError(this.toast, `Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
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

  togglePreviewFullscreen(): void {
    if (!this.mergedPdfPreview) return;
    this.previewFullscreen = !this.previewFullscreen;
    this.cdr.detectChanges();
    this.scheduleRenderPreview();
  }

  closePreviewFullscreen(): void {
    this.previewFullscreen = false;
    this.cdr.detectChanges();
    this.scheduleRenderPreview();
  }

  scheduleRenderPreview(): void {
    this.previewRenderRetries = 0;
    this.previewRenderGeneration++;
    requestAnimationFrame(() => {
      this.cdr.detectChanges();
      requestAnimationFrame(() => void this.renderPreview(this.previewRenderGeneration));
    });
  }

  async mergePdfs(): Promise<void> {
    if (this.pdfFiles.length < 2) {
      pdfNotifyWarning(this.toast, 'Please add at least 2 PDF files to merge');
      return;
    }

    const filenameErr = validateOutputFilename(this.outputFilename);
    if (filenameErr) {
      pdfNotifyWarning(this.toast, filenameErr);
      this.openOptionsPanel();
      return;
    }

    if (this.hasFilesNeedingPassword()) {
      pdfNotifyWarning(this.toast, 'Unlock password-protected PDFs before merging');
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Merging PDFs...';

    try {
      const mergedPdf = await PDFDocument.create();

      // Copy pages from all PDFs in order
      await this.copyPagesToMergedPdf(mergedPdf);

      const mergedBytes = await this.buildMergedBytesFromDoc(mergedPdf);
      if (!mergedBytes?.length) {
        throw new Error('Merged PDF is empty');
      }
      this.mergedPdfBytes = mergedBytes;
      this.mergedPdfPreview = mergedPdf;
      this.previewPage = 1;
      this.totalPages = mergedPdf.getPageCount();
      this.preview.clearCache();

      this.previewRenderRetries = 0;
      this.cdr.detectChanges();
      this.scheduleRenderPreview();

      pdfNotifySuccess(this.toast, 'PDFs merged successfully! Preview is ready below.');
      this.cdr.detectChanges();
    } catch (error) {
      pdfNotifyError(this.toast, `Failed to merge PDFs: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  async renderPreview(generation = this.previewRenderGeneration): Promise<void> {
    if (generation !== this.previewRenderGeneration || !this.mergedPdfBytes) return;

    const canvas = this.previewFullscreen
      ? this.fullscreenOverlay?.canvasElement
      : this.previewCanvas?.nativeElement;

    if (!canvas) {
      if (this.previewRenderRetries < this.maxPreviewRetries) {
        this.previewRenderRetries++;
        setTimeout(() => void this.renderPreview(generation), 100);
      }
      return;
    }

    try {
      const maxWidth = this.previewFullscreen ? fullscreenPreviewWidth() : undefined;
      await this.preview.renderPageToCanvas(
        this.mergedPdfBytes,
        this.previewPage,
        canvas,
        maxWidth,
      );
      if (generation !== this.previewRenderGeneration) return;
    } catch (error) {
      if (generation !== this.previewRenderGeneration) return;
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.toLowerCase().includes('cancel') || message.toLowerCase().includes('same canvas')) return;
      pdfNotifyError(this.toast, `Failed to render preview: ${message}`);
    }
  }

  async previousPreviewPage(): Promise<void> {
    if (this.previewPage > 1) {
      this.previewPage--;
      this.scheduleRenderPreview();
    }
  }

  async nextPreviewPage(): Promise<void> {
    if (this.mergedPdfPreview && this.previewPage < this.totalPages) {
      this.previewPage++;
      this.scheduleRenderPreview();
    }
  }

  async goToPreviewPage(page: number): Promise<void> {
    if (page >= 1 && page <= this.totalPages) {
      this.previewPage = page;
      this.scheduleRenderPreview();
    }
  }

  get Math(): typeof Math {
    return Math;
  }
}
