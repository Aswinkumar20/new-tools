import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { pdfNotifyError, pdfNotifySuccess, pdfNotifyWarning } from '../../shared/pdf-feedback.util';
import { PDFDocument } from 'pdf-lib';
import { validatePageRangeInput } from '../../shared/pdf.validation';
import { fullscreenPreviewWidth } from '../../shared/pdf-fullscreen.util';
import { downloadBytes, downloadBlob, cloneBytes } from '../../shared/pdf.utils';
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
}

interface SplitResult {
  name: string;
  startPage: number;
  endPage: number;
}

@Component({
  selector: 'lib-split-pdfs',
  standalone: true,
  templateUrl: './split-pdfs.html',
  styleUrls: ['./split-pdfs.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective, PdfFullscreenOverlayComponent]
})
export class SplitPdfsComponent implements OnInit {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly preview = inject(PdfPreviewService);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('pdfPreviewCanvas') pdfPreviewCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfPreviewCanvasWrap') pdfPreviewCanvasWrap?: ElementRef<HTMLElement>;
  @ViewChild('optionsFlyout') optionsFlyout?: ElementRef<HTMLElement>;
  @ViewChild(PdfFullscreenOverlayComponent) fullscreenOverlay?: PdfFullscreenOverlayComponent;

  previewFullscreen = false;
  optionsPanelOpen = true;

  // PDF file
  pdfFile: PdfFile | null = null;
  totalPages: number = 0;
  currentPage: number = 1;
  
  // UI state
  showDropZone: boolean = false;
  loading: boolean = false;
  loadingMessage: string = 'Processing...';
  previewRendering = false;
  previewError = '';
  private previewRenderRetries = 0;
  private readonly maxPreviewRenderRetries = 20;
  private previewRenderGeneration = 0;
  
  // Password handling
  showPasswordDialog: boolean = false;
  passwordInput: string = '';
  passwordError: string = '';
  
  // Split options
  splitMode: 'range' | 'every' | 'extract' = 'range';
  pageRanges: string = '';
  pagesPerFile: number = 1;
  extractPages: string = '';
  downloadAsZip: boolean = true;
  outputPrefix: string = 'split';
  
  // Split results
  splitResults: SplitResult[] = [];

  get needsSplitConfig(): boolean {
    return !!this.pdfFile && this.splitResults.length === 0;
  }

  get canSplit(): boolean {
    return !!this.pdfFile?.pdfDoc && !this.loading && this.splitResults.length > 0;
  }

  get canReset(): boolean {
    return !!this.pdfFile && !this.loading;
  }

  get splitConfigHint(): string {
    if (!this.pdfFile) return '';
    return 'Choose a split mode and enter page ranges in Configuration before splitting.';
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
  private pdfPreviewBytes: Uint8Array | null = null;
  
  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadJSZip();
  }

  async loadJSZip(): Promise<void> {
    if (globalThis.window === undefined) return;
    
    if ((globalThis as any).JSZip) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);

    return new Promise((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load JSZip'));
    });
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.loadPdfFile(input.files[0]);
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

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        this.loadPdfFile(file);
      } else {
        pdfNotifyError(this.toast, 'Please drop a valid PDF file');
      }
    }
  }

  async loadPdfFile(file: File, password?: string): Promise<void> {
    if (file.size > 100 * 1024 * 1024) {
      pdfNotifyError(this.toast, `File "${file.name}" is too large (max 100MB)`);
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Loading PDF file...';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      
      let pdfDoc: PDFDocument;
      try {
        const loadOptions: any = {};
        if (password) {
          loadOptions.password = password;
        }
        pdfDoc = await PDFDocument.load(pdfBytes, loadOptions);
      } catch (loadError: unknown) {
        const loadErrorObj = loadError as Error;
        const errorMessage = loadErrorObj?.message || '';
        const isPasswordError = errorMessage.toLowerCase().includes('password') || 
                                errorMessage.toLowerCase().includes('encrypted') ||
                                errorMessage.toLowerCase().includes('decrypt');
        
        if (isPasswordError) {
          if (password === undefined) {
            // Password required
            this.pdfFile = {
              file,
              name: file.name,
              size: file.size,
              pageCount: 0,
              pdfBytes,
              pdfDoc: null,
              password: undefined,
              needsPassword: true,
              passwordError: false
            };
            this.showPasswordDialogForFile();
            this.loading = false;
            return;
          } else {
            // Incorrect password
            this.passwordError = 'Incorrect password. Please try again.';
            this.passwordInput = '';
            this.showPasswordDialogForFile();
            this.loading = false;
            return;
          }
        }
        throw loadError;
      }
      
      const pageCount = pdfDoc.getPageCount();
      this.totalPages = pageCount;
      this.currentPage = 1;
      
      if (this.pdfFile) {
        // Update existing entry
        this.pdfFile = {
          ...this.pdfFile,
          pdfDoc,
          pageCount,
          password: password || this.pdfFile.password,
          needsPassword: false,
          passwordError: false
        };
      } else {
        // Create new entry
        this.pdfFile = {
          file,
          name: file.name,
          size: file.size,
          pageCount,
          pdfBytes,
          pdfDoc,
          password: password,
          needsPassword: false,
          passwordError: false
        };
      }

      this.pdfPreviewBytes = new Uint8Array(pdfBytes);
      this.preview.clearCache();

      this.cdr.detectChanges();
      this.scheduleRenderPreview();
      this.updateSplitResults();
      if (this.needsSplitConfig) {
        this.openOptionsPanel();
      }
      this.cdr.detectChanges();
    } catch (error) {
      pdfNotifyError(this.toast, `Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  showPasswordDialogForFile(): void {
    this.showPasswordDialog = true;
    this.passwordInput = this.pdfFile?.password || '';
    this.passwordError = '';
    this.cdr.detectChanges();
  }

  async submitPassword(): Promise<void> {
    if (!this.pdfFile || !this.passwordInput.trim()) {
      this.passwordError = 'Please enter a password';
      return;
    }

    this.passwordError = '';
    const password = this.passwordInput.trim();
    
    this.showPasswordDialog = false;
    this.loading = true;
    this.loadingMessage = 'Unlocking PDF...';
    this.cdr.detectChanges();

    try {
      await this.loadPdfFile(this.pdfFile.file, password);
      this.passwordInput = '';
    } catch (error) {
      this.passwordError = 'Incorrect password. Please try again.';
      this.passwordInput = '';
      this.showPasswordDialog = true;
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  cancelPassword(): void {
    this.reset();
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

  reset(): void {
    this.pdfFile = null;
    this.totalPages = 0;
    this.currentPage = 1;
    this.splitResults = [];
    this.pageRanges = '';
    this.extractPages = '';
    this.pagesPerFile = 1;
    this.pdfPreviewBytes = null;
    this.preview.clearCache();
    this.showPasswordDialog = false;
    this.passwordInput = '';
    this.passwordError = '';
    this.cdr.detectChanges();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getSplitModeLabel(): string {
    switch (this.splitMode) {
      case 'range':
        return 'By Range';
      case 'every':
        return 'Every N Pages';
      case 'extract':
        return 'Extract Pages';
      default:
        return 'None';
    }
  }

  togglePreviewFullscreen(): void {
    if (!this.pdfFile?.pdfDoc) return;
    this.previewFullscreen = !this.previewFullscreen;
    this.cdr.detectChanges();
    this.scheduleRenderPreview();
  }

  closePreviewFullscreen(): void {
    this.previewFullscreen = false;
    this.cdr.detectChanges();
    this.scheduleRenderPreview();
  }

  parsePageRanges(rangeString: string): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    const parts = rangeString.split(',').map(p => p.trim()).filter(p => p);
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          ranges.push({
            start: Math.max(1, Math.min(start, this.totalPages)),
            end: Math.max(1, Math.min(end, this.totalPages))
          });
        }
      } else {
        const page = parseInt(part, 10);
        if (!Number.isNaN(page)) {
          const validPage = Math.max(1, Math.min(page, this.totalPages));
          ranges.push({ start: validPage, end: validPage });
        }
      }
    }
    
    return ranges;
  }

  updateSplitResults(): void {
    if (!this.pdfFile?.pdfDoc || this.totalPages === 0) {
      this.splitResults = [];
      return;
    }

    const results: SplitResult[] = [];

    switch (this.splitMode) {
      case 'range':
        if (this.pageRanges.trim()) {
          const ranges = this.parsePageRanges(this.pageRanges);
          ranges.forEach((range, index) => {
            const start = Math.min(range.start, range.end);
            const end = Math.max(range.start, range.end);
            results.push({
              name: `${this.outputPrefix}-${index + 1}.pdf`,
              startPage: start,
              endPage: end
            });
          });
        }
        break;

      case 'every':
        if (this.pagesPerFile > 0 && this.pagesPerFile <= this.totalPages) {
          for (let start = 1; start <= this.totalPages; start += this.pagesPerFile) {
            const end = Math.min(start + this.pagesPerFile - 1, this.totalPages);
            results.push({
              name: `${this.outputPrefix}-${Math.floor((start - 1) / this.pagesPerFile) + 1}.pdf`,
              startPage: start,
              endPage: end
            });
          }
        }
        break;

      case 'extract':
        if (this.extractPages.trim()) {
          const ranges = this.parsePageRanges(this.extractPages);
          ranges.forEach((range, index) => {
            const start = Math.min(range.start, range.end);
            const end = Math.max(range.start, range.end);
            results.push({
              name: `${this.outputPrefix}-${index + 1}.pdf`,
              startPage: start,
              endPage: end
            });
          });
        }
        break;
    }

    this.splitResults = results;
    this.cdr.detectChanges();
  }

  scheduleRenderPreview(): void {
    this.previewRenderRetries = 0;
    this.previewError = '';
    this.previewRenderGeneration++;
    requestAnimationFrame(() => {
      this.cdr.detectChanges();
      requestAnimationFrame(() => void this.renderPdfPreview(this.previewRenderGeneration));
    });
  }

  private activePreviewCanvas(): HTMLCanvasElement | undefined {
    if (this.previewFullscreen) {
      return this.fullscreenOverlay?.canvasElement;
    }
    return (
      this.pdfPreviewCanvas?.nativeElement ??
      this.pdfPreviewCanvasWrap?.nativeElement?.querySelector('canvas') ??
      undefined
    );
  }

  async renderPdfPreview(generation = this.previewRenderGeneration): Promise<void> {
    if (generation !== this.previewRenderGeneration) return;

    if (!this.pdfPreviewBytes || !this.pdfFile?.pdfDoc) {
      this.previewRendering = false;
      return;
    }

    const canvas = this.activePreviewCanvas();
    if (!canvas) {
      if (this.previewRenderRetries < this.maxPreviewRenderRetries) {
        this.previewRenderRetries++;
        this.cdr.detectChanges();
        setTimeout(
          () => void this.renderPdfPreview(generation),
          this.previewRenderRetries <= 3 ? 16 : 80,
        );
      } else {
        this.previewError = 'Preview could not be initialized. Try refreshing the page.';
        this.cdr.detectChanges();
      }
      return;
    }

    this.previewRendering = true;
    this.previewError = '';
    this.cdr.detectChanges();

    try {
      const maxWidth = this.previewFullscreen ? fullscreenPreviewWidth() : undefined;
      await this.preview.renderPageToCanvas(
        this.pdfPreviewBytes,
        this.currentPage,
        canvas,
        maxWidth,
      );
      if (generation !== this.previewRenderGeneration) return;
    } catch (error) {
      if (generation !== this.previewRenderGeneration) return;
      const message = error instanceof Error ? error.message : 'Could not render PDF preview';
      if (message.toLowerCase().includes('cancel') || message.toLowerCase().includes('same canvas')) return;
      this.previewError = message;
      pdfNotifyError(this.toast, this.previewError);
    } finally {
      if (generation === this.previewRenderGeneration) {
        this.previewRendering = false;
      }
      this.cdr.detectChanges();
    }
  }

  async previousPage(): Promise<void> {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.scheduleRenderPreview();
    }
  }

  async nextPage(): Promise<void> {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.scheduleRenderPreview();
    }
  }

  async goToPage(page: number): Promise<void> {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.scheduleRenderPreview();
    }
  }

  async splitPdf(): Promise<void> {
    if (!this.pdfFile?.pdfDoc || this.splitResults.length === 0) {
      pdfNotifyWarning(this.toast, 'Please upload a PDF and configure split options in Configuration');
      this.openOptionsPanel();
      return;
    }

    if (this.splitMode === 'range') {
      const rangeErr = validatePageRangeInput(this.pageRanges, this.totalPages);
      if (rangeErr) {
        pdfNotifyWarning(this.toast, rangeErr);
        this.openOptionsPanel();
        return;
      }
    }

    if (this.splitMode === 'every' && (this.pagesPerFile < 1 || this.pagesPerFile > this.totalPages)) {
      pdfNotifyWarning(this.toast, `Pages per file must be between 1 and ${this.totalPages}`);
      this.openOptionsPanel();
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Splitting PDF...';

    try {
      const sourcePdf = this.pdfFile.pdfDoc;
      const files: Array<{ name: string; bytes: Uint8Array }> = [];

      for (const result of this.splitResults) {
        const newPdf = await PDFDocument.create();
        const pageIndices = [];
        
        for (let i = result.startPage - 1; i < result.endPage; i++) {
          pageIndices.push(i);
        }

        const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
        copiedPages.forEach((page) => {
          newPdf.addPage(page);
        });

        const pdfBytes = await newPdf.save();
        files.push({ name: result.name, bytes: cloneBytes(pdfBytes) });
      }

      if (this.downloadAsZip) {
        await this.downloadAsZipFile(files);
      } else {
        await this.downloadFilesIndividually(files);
      }

      pdfNotifySuccess(this.toast, `Successfully split PDF into ${files.length} file(s)!`);
      this.cdr.detectChanges();
    } catch (error) {
      pdfNotifyError(this.toast, `Failed to split PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async downloadAsZipFile(files: Array<{ name: string; bytes: Uint8Array }>): Promise<void> {
    if (!(globalThis as any).JSZip) {
      pdfNotifyError(this.toast, 'JSZip library not loaded');
      return;
    }

    const zip = new (globalThis as any).JSZip();

    for (const file of files) {
      zip.file(file.name, file.bytes);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `${this.outputPrefix || 'split'}-files.zip`);
  }

  async downloadFilesIndividually(files: Array<{ name: string; bytes: Uint8Array }>): Promise<void> {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      downloadBytes(file.bytes, file.name);
    }
  }

  get Math(): typeof Math {
    return Math;
  }
}
