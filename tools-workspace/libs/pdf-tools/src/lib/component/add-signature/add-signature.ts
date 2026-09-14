import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { pdfNotifyError, pdfNotifyFailure, pdfNotifySuccess, pdfNotifyWarning } from '../../shared/pdf-feedback.util';
import { PDFDocument } from 'pdf-lib';
import SignaturePad from 'signature_pad';
import { fullscreenPreviewWidth } from '../../shared/pdf-fullscreen.util';
import { downloadBytes } from '../../shared/pdf.utils';
import { PdfJsLoaderService, type PdfJsLib } from '../../services/pdf-js-loader.service';
import { PdfBackendApiService } from '../../api/pdf-backend-api.service';
import { isPdfBackendEnabled } from '../../api/pdf-backend.config';
import { PdfFullscreenOverlayComponent } from '../pdf-fullscreen-overlay/pdf-fullscreen-overlay';

interface SignaturePosition {
  x: number;
  y: number;
  page: number;
  width: number;
  height: number;
}

@Component({
  selector: 'lib-add-signature',
  standalone: true,
  templateUrl: './add-signature.html',
  styleUrls: ['./add-signature.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective, PdfFullscreenOverlayComponent]
})
export class AddSignatureComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly pdfJsLoader = inject(PdfJsLoaderService);
  private readonly pdfBackend = inject(PdfBackendApiService);
  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfPreviewCanvas') pdfPreviewCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;
  @ViewChild('pdfContainer') pdfContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('optionsFlyout') optionsFlyout?: ElementRef<HTMLElement>;
  @ViewChild(PdfFullscreenOverlayComponent) fullscreenOverlay?: PdfFullscreenOverlayComponent;

  previewFullscreen = false;
  optionsPanelOpen = true;

  // PDF state
  pdfFile: File | null = null;
  pdfDoc: PDFDocument | null = null;
  pdfBytes: Uint8Array | null = null;
  currentPage: number = 1;
  totalPages: number = 0;
  pdfPreviewScale: number = 1.5;
  private pdfDocument: any = null; // Cache PDF document
  
  // Signature state
  signaturePad: SignaturePad | null = null;
  signatureImage: string | null = null;
  signatureMode: 'draw' | 'type' | 'upload' = 'draw';
  typedSignature: string = '';
  typedFontSize: number = 48;
  typedFontFamily: string = 'Dancing Script';
  /** Snapshots of SignaturePad stroke data for undo/redo. */
  private signatureStrokeHistory: ReturnType<SignaturePad['toData']>[] = [[]];
  private signatureRedoStack: ReturnType<SignaturePad['toData']>[] = [];
  
  // Signature placement
  signaturePosition: SignaturePosition = {
    x: 100,
    y: 100,
    page: 1,
    width: 200,
    height: 80
  };
  isPlacingSignature: boolean = false;
  isDragging: boolean = false;
  isDraggingSignature: boolean = false;
  dragStart: { x: number; y: number } = { x: 0, y: 0 };
  signatureOffset: { x: number; y: number } = { x: 0, y: 0 };
  
  // UI state
  loading: boolean = false;
  showPreview: boolean = false;

  get needsSignatureConfig(): boolean {
    return !!this.pdfFile && !this.signatureImage;
  }

  get signatureConfigHint(): string {
    if (!this.pdfFile) return '';
    if (!this.signatureImage) {
      return 'Create or upload a signature in Configuration, then click on the PDF to place it.';
    }
    return 'Adjust signature size and placement, then click Save.';
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
  
  // PDF.js for preview
  private pdfjsLib: PdfJsLib | null = null;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadPdfJs();
  }

  ngAfterViewInit(): void {
    this.initSignaturePad();
  }

  ngOnDestroy(): void {
    if (this.signaturePad) {
      this.signaturePad.off();
    }
  }

  async loadPdfJs(): Promise<void> {
    if (globalThis.window === undefined) return;
    this.pdfjsLib = await this.pdfJsLoader.getPdfJs();
  }

  initSignaturePad(): void {
    if (!this.signatureCanvas?.nativeElement) return;
    
    const canvas = this.signatureCanvas.nativeElement;
    this.signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 1,
      maxWidth: 3,
    });

    // Adjust canvas size for high DPI displays
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);
    this.signaturePad.clear();
    this.signatureStrokeHistory = [[]];
    this.signatureRedoStack = [];

    this.signaturePad.addEventListener('endStroke', () => {
      if (!this.signaturePad) return;
      this.signatureStrokeHistory.push(this.signaturePad.toData());
      this.signatureRedoStack = [];
      this.cdr.detectChanges();
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processPdfFile(input.files[0]);
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  async processPdfFile(file: File): Promise<void> {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      pdfNotifyError(this.toast, 'Please select a valid PDF file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      pdfNotifyError(this.toast, 'File size must be less than 50MB');
      return;
    }

    this.loading = true;
    this.pdfFile = file;

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfBytes = new Uint8Array(arrayBuffer);
      this.pdfDoc = await PDFDocument.load(this.pdfBytes);
      this.totalPages = this.pdfDoc.getPageCount();
      this.currentPage = 1;
      this.showPreview = true;
      this.pdfDocument = null; // Reset cached PDF document
      
      await this.renderPdfPreview();
      pdfNotifySuccess(this.toast, 'PDF loaded');
      this.openOptionsPanel();
      this.cdr.detectChanges();
    } catch (error) {
      pdfNotifyFailure(this.toast, error, 'Could not load the PDF');
      this.pdfFile = null;
      this.pdfDoc = null;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async renderPdfPreview(): Promise<void> {
    if (!this.pdfjsLib || !this.pdfBytes) return;

    const canvas = this.previewFullscreen
      ? this.fullscreenOverlay?.canvasElement
      : this.pdfPreviewCanvas?.nativeElement;

    if (!canvas) {
      setTimeout(() => void this.renderPdfPreview(), 50);
      return;
    }

    try {
      // Load PDF document if not cached
      if (!this.pdfDocument) {
        const loadingTask = this.pdfjsLib.getDocument({ data: this.pdfBytes });
        this.pdfDocument = await loadingTask.promise;
      }

      const page = await this.pdfDocument.getPage(this.currentPage);
      const context = canvas.getContext('2d');
      
      if (!context) return;

      const container = canvas.parentElement;
      const containerWidth = this.previewFullscreen
        ? fullscreenPreviewWidth()
        : container
          ? container.clientWidth - 32
          : 800;
      const maxWidth = containerWidth;

      // Get page viewport at scale 1 to calculate proper scale
      const viewportAtScale1 = page.getViewport({ scale: 1 });
      // Calculate scale to fit container width (100% width)
      const scale = maxWidth / viewportAtScale1.width;
      
      const viewport = page.getViewport({ scale });
      this.pdfPreviewScale = scale;

      // Set canvas display size (CSS) - use 100% width
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.maxWidth = '100%';
      
      // Set canvas internal size (for high DPI)
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * devicePixelRatio;
      canvas.height = viewport.height * devicePixelRatio;
      
      // Scale context for high DPI
      context.scale(devicePixelRatio, devicePixelRatio);

      // Clear canvas
      context.clearRect(0, 0, viewport.width, viewport.height);

      // Render PDF page
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Draw signature preview if exists
      if (this.signatureImage && this.signaturePosition.page === this.currentPage) {
        await this.drawSignaturePreview(context);
      }
    } catch (error) {
      console.error('Error rendering PDF preview:', error);
    }
  }

  togglePreviewFullscreen(): void {
    if (!this.showPreview) return;
    this.previewFullscreen = !this.previewFullscreen;
    this.cdr.detectChanges();
    setTimeout(() => void this.renderPdfPreview(), 0);
  }

  closePreviewFullscreen(): void {
    this.previewFullscreen = false;
    this.cdr.detectChanges();
    setTimeout(() => void this.renderPdfPreview(), 0);
  }

  async drawSignaturePreview(context: CanvasRenderingContext2D): Promise<void> {
    if (!this.signatureImage) return;

    const img = new Image();
    return new Promise((resolve, reject) => {
      img.onload = () => {
        const scale = this.pdfPreviewScale;
        context.drawImage(
          img,
          this.signaturePosition.x * scale,
          this.signaturePosition.y * scale,
          this.signaturePosition.width * scale,
          this.signaturePosition.height * scale
        );
        resolve();
      };
      img.onerror = reject;
      if (this.signatureImage) {
        img.src = this.signatureImage;
      } else {
        reject(new Error('No signature image available'));
      }
    });
  }

  clearSignature(): void {
    if (this.signaturePad) {
      this.signaturePad.clear();
    }
    this.signatureStrokeHistory = [[]];
    this.signatureRedoStack = [];
    this.signatureImage = null;
    this.typedSignature = '';
    this.cdr.detectChanges();
  }

  undoSignature(): void {
    if (!this.signaturePad || this.signatureStrokeHistory.length <= 1) return;
    const current = this.signatureStrokeHistory.pop();
    if (current) this.signatureRedoStack.push(current);
    const previous = this.signatureStrokeHistory[this.signatureStrokeHistory.length - 1] ?? [];
    this.signaturePad.fromData(previous);
    this.cdr.detectChanges();
  }

  redoSignature(): void {
    if (!this.signaturePad || !this.signatureRedoStack.length) return;
    const next = this.signatureRedoStack.pop();
    if (!next) return;
    this.signatureStrokeHistory.push(next);
    this.signaturePad.fromData(next);
    this.cdr.detectChanges();
  }

  canUndo(): boolean {
    return this.signatureStrokeHistory.length > 1;
  }

  canRedo(): boolean {
    return this.signatureRedoStack.length > 0;
  }

  saveSignature(): void {
    if (this.signatureMode === 'draw') {
      if (!this.signaturePad || this.signaturePad.isEmpty()) {
        pdfNotifyError(this.toast, 'Please draw a signature first');
        return;
      }
      this.signatureImage = this.signaturePad.toDataURL('image/png');
    } else if (this.signatureMode === 'type') {
      if (!this.typedSignature.trim()) {
        pdfNotifyError(this.toast, 'Please enter your signature text');
        return;
      }
      this.createTypedSignature();
    }
    if (this.showPreview) {
      this.renderPdfPreview();
    }
    this.cdr.detectChanges();
  }

  createTypedSignature(): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 400;
    canvas.height = 150;

    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = 'black';
    context.font = `${this.typedFontSize}px "${this.typedFontFamily}", cursive`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(this.typedSignature, canvas.width / 2, canvas.height / 2);

    this.signatureImage = canvas.toDataURL('image/png');
  }

  onImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        pdfNotifyError(this.toast, 'Please select a valid image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.signatureImage = e.target?.result as string;
        if (this.showPreview) {
          this.renderPdfPreview();
        }
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  openImageDialog(): void {
    this.imageInput?.nativeElement.click();
  }

  togglePlacementMode(): void {
    this.isPlacingSignature = !this.isPlacingSignature;
    this.isDraggingSignature = false;
  }

  getCanvasCoordinates(event: MouseEvent): { x: number; y: number } | null {
    const canvas = this.pdfPreviewCanvas?.nativeElement;
    if (!canvas || !this.pdfDoc) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const page = this.pdfDoc.getPage(this.currentPage - 1);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    // CSS click → PDF points (origin top-left for placement UI; saveSignedPdf flips Y)
    const x = ((event.clientX - rect.left) / rect.width) * pageWidth;
    const y = ((event.clientY - rect.top) / rect.height) * pageHeight;
    return { x, y };
  }

  isPointInSignature(x: number, y: number): boolean {
    return (
      x >= this.signaturePosition.x &&
      x <= this.signaturePosition.x + this.signaturePosition.width &&
      y >= this.signaturePosition.y &&
      y <= this.signaturePosition.y + this.signaturePosition.height &&
      this.signaturePosition.page === this.currentPage
    );
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (!this.signatureImage) return;

    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;

    // Check if clicking on existing signature to drag it
    if (this.isPointInSignature(coords.x, coords.y)) {
      this.isDraggingSignature = true;
      this.dragStart = coords;
      this.signatureOffset = {
        x: coords.x - this.signaturePosition.x,
        y: coords.y - this.signaturePosition.y
      };
      event.preventDefault();
      return;
    }

    // If in placement mode, place new signature
    if (this.isPlacingSignature) {
      this.signaturePosition.x = coords.x - this.signaturePosition.width / 2;
      this.signaturePosition.y = coords.y - this.signaturePosition.height / 2;
      this.signaturePosition.page = this.currentPage;
      this.isPlacingSignature = false;
      this.renderPdfPreview();
      this.cdr.detectChanges();
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.signatureImage) return;

    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;

    // Drag existing signature
    if (this.isDraggingSignature) {
      this.signaturePosition.x = Math.max(0, coords.x - this.signatureOffset.x);
      this.signaturePosition.y = Math.max(0, coords.y - this.signatureOffset.y);
      // Ensure signature stays within canvas bounds
      const canvas = this.pdfPreviewCanvas?.nativeElement;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const maxX = rect.width / this.pdfPreviewScale - this.signaturePosition.width;
        const maxY = rect.height / this.pdfPreviewScale - this.signaturePosition.height;
        this.signaturePosition.x = Math.min(this.signaturePosition.x, Math.max(0, maxX));
        this.signaturePosition.y = Math.min(this.signaturePosition.y, Math.max(0, maxY));
      }
      this.renderPdfPreview();
      return;
    }

    // Update cursor style
    const canvas = this.pdfPreviewCanvas?.nativeElement;
    if (canvas && this.isPointInSignature(coords.x, coords.y)) {
      canvas.style.cursor = 'move';
    } else if (this.isPlacingSignature) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  onCanvasMouseUp(): void {
    if (this.isDraggingSignature) {
      this.isDraggingSignature = false;
      this.cdr.detectChanges();
    }
  }

  onCanvasMouseLeave(): void {
    this.isDraggingSignature = false;
    const canvas = this.pdfPreviewCanvas?.nativeElement;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  }

  async previousPage(): Promise<void> {
    if (this.currentPage > 1) {
      this.currentPage--;
      await this.renderPdfPreview();
      this.cdr.detectChanges();
    }
  }

  async nextPage(): Promise<void> {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      await this.renderPdfPreview();
      this.cdr.detectChanges();
    }
  }

  async goToPage(page: number): Promise<void> {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      await this.renderPdfPreview();
      this.cdr.detectChanges();
    }
  }

  adjustSignatureSize(delta: number): void {
    this.signaturePosition.width = Math.max(50, Math.min(500, this.signaturePosition.width + delta));
    this.signaturePosition.height = Math.max(20, Math.min(200, this.signaturePosition.height + delta * 0.4));
    if (this.showPreview) {
      this.renderPdfPreview();
    }
    this.cdr.detectChanges();
  }

  async saveSignedPdf(): Promise<void> {
    if (!this.pdfDoc || !this.signatureImage) {
      pdfNotifyWarning(this.toast, 'Create a signature in Configuration, then place it on the PDF');
      this.openOptionsPanel();
      return;
    }

    this.loading = true;

    try {
      const pages = this.pdfDoc.getPages();
      const targetPage = pages[this.signaturePosition.page - 1];
      
      if (!targetPage) {
        throw new Error('Invalid page number');
      }

      const pageHeight = targetPage.getHeight();
      const pdfX = this.signaturePosition.x;
      const pdfY = pageHeight - this.signaturePosition.y - this.signaturePosition.height;

      if (isPdfBackendEnabled(this.pdfBackend.settings, 'add-signature') && this.pdfBytes?.length) {
        try {
          const signatureImageBytes = await fetch(this.signatureImage).then((res) => res.arrayBuffer());
          const imageBlob = new Blob([signatureImageBytes], { type: 'image/png' });
          const fileBlob = new Blob([this.pdfBytes as BlobPart], { type: 'application/pdf' });
          const result = await this.pdfBackend.stampImage(fileBlob, imageBlob, {
            page: this.signaturePosition.page,
            x: pdfX,
            y: pdfY,
            width: this.signaturePosition.width,
            height: this.signaturePosition.height,
            fileName: this.pdfFile?.name || 'document.pdf',
            imageName: 'signature.png',
          });
          const pdfBytes = new Uint8Array(await result.arrayBuffer());
          downloadBytes(pdfBytes, this.pdfFile?.name.replace('.pdf', '_signed.pdf') || 'signed_document.pdf');
          pdfNotifySuccess(this.toast, 'Signed on secure server · download ready');
          return;
        } catch {
          /* hybrid: fall through to pdf-lib stamp */
        }
      }

      const signatureImageBytes = await fetch(this.signatureImage).then(res => res.arrayBuffer());
      const signatureImage = await this.pdfDoc.embedPng(signatureImageBytes);

      targetPage.drawImage(signatureImage, {
        x: pdfX,
        y: pdfY,
        width: this.signaturePosition.width,
        height: this.signaturePosition.height,
      });

      const pdfBytes = new Uint8Array(await this.pdfDoc.save());
      downloadBytes(pdfBytes, this.pdfFile?.name.replace('.pdf', '_signed.pdf') || 'signed_document.pdf');
      pdfNotifySuccess(this.toast, 'Signed PDF downloaded');
    } catch (error) {
      pdfNotifyFailure(this.toast, error, 'Could not save the signed PDF');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  reset(): void {
    this.pdfFile = null;
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.pdfDocument = null; // Clear cached PDF
    this.currentPage = 1;
    this.totalPages = 0;
    this.showPreview = false;
    this.signatureImage = null;
    this.clearSignature();
    this.isPlacingSignature = false;
    this.cdr.detectChanges();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getPagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get Math(): typeof Math {
    return Math;
  }
}
