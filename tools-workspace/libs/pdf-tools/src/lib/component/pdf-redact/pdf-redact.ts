import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { PdfBackendApiService, isPdfAdvancedBackendEnabled } from '../../api';
import { PdfJsLoaderService, type PdfJsDocument } from '../../services/pdf-js-loader.service';
import { downloadBlob, formatFileSize, PDF_MAX_BYTES } from '../../shared/pdf.utils';
import { pdfNotifyError, pdfNotifyFailure, pdfNotifySuccess, pdfNotifyWarning } from '../../shared/pdf-feedback.util';

export interface RedactRegion {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'lib-pdf-redact',
  standalone: true,
  templateUrl: './pdf-redact.html',
  styleUrls: ['./pdf-redact.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfRedactComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly pdfBackend = inject(PdfBackendApiService);
  private readonly pdfJs = inject(PdfJsLoaderService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('previewCanvas') previewCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;

  file: File | null = null;
  query = '';
  dpi = 150;
  regions: RedactRegion[] = [];
  currentPage = 1;
  totalPages = 0;

  loading = false;
  loadingMessage = 'Processing…';
  resultBlob: Blob | null = null;
  outputFilename = 'redacted.pdf';
  lastActionCompleted = false;

  private pdfDoc: PdfJsDocument | null = null;
  private pageWidthPt = 612;
  private pageHeightPt = 792;
  private drawing = false;
  private drawStart: { x: number; y: number } | null = null;
  private drawCurrent: { x: number; y: number } | null = null;
  private fileBytes: Uint8Array | null = null;

  get showServerPrivacyBanner(): boolean {
    return isPdfAdvancedBackendEnabled(this.pdfBackend.settings);
  }

  get canRun(): boolean {
    if (this.loading || !this.file) return false;
    if (!isPdfAdvancedBackendEnabled(this.pdfBackend.settings)) return false;
    return !!this.query.trim() || this.regions.length > 0;
  }

  get canDownload(): boolean {
    return !this.loading && !!this.resultBlob?.size;
  }

  formatFileSize = formatFileSize;

  ngOnDestroy(): void {
    this.destroyDoc();
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0] ?? null;
    input.value = '';
    if (!picked) return;
    const maxBytes = Math.min(
      PDF_MAX_BYTES,
      (this.pdfBackend.settings.maxUploadMb || 50) * 1024 * 1024
    );
    if (picked.size > maxBytes) {
      pdfNotifyError(this.toast, `${picked.name} exceeds size limit`);
      return;
    }
    if (picked.type !== 'application/pdf' && !picked.name.toLowerCase().endsWith('.pdf')) {
      pdfNotifyError(this.toast, 'Please upload a PDF file');
      return;
    }
    this.clearResult();
    this.regions = [];
    this.file = picked;
    this.outputFilename = picked.name.replace(/\.pdf$/i, '') + '-redacted.pdf';
    try {
      await this.loadPreview(picked);
      pdfNotifySuccess(this.toast, `Loaded ${picked.name}`);
    } catch (error) {
      pdfNotifyFailure(this.toast, error, 'Could not open the PDF for preview');
      this.file = null;
    }
    this.cdr.markForCheck();
  }

  async prevPage(): Promise<void> {
    if (this.currentPage <= 1) return;
    this.currentPage -= 1;
    await this.renderPreview();
  }

  async nextPage(): Promise<void> {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage += 1;
    await this.renderPreview();
  }

  removeRegion(index: number): void {
    this.regions = this.regions.filter((_, i) => i !== index);
    this.drawOverlay();
    this.clearResult();
    this.cdr.markForCheck();
  }

  clearRegionsOnPage(): void {
    this.regions = this.regions.filter((r) => r.pageIndex !== this.currentPage - 1);
    this.drawOverlay();
    this.clearResult();
    this.cdr.markForCheck();
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.file || this.loading) return;
    const canvas = this.overlayCanvas?.nativeElement;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const pt = this.cssToCanvas(event, canvas);
    this.drawing = true;
    this.drawStart = pt;
    this.drawCurrent = pt;
    this.drawOverlay();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drawing || !this.drawStart) return;
    const canvas = this.overlayCanvas?.nativeElement;
    if (!canvas) return;
    this.drawCurrent = this.cssToCanvas(event, canvas);
    this.drawOverlay();
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.drawing || !this.drawStart || !this.drawCurrent) {
      this.drawing = false;
      return;
    }
    const canvas = this.overlayCanvas?.nativeElement;
    if (!canvas) return;
    const end = this.cssToCanvas(event, canvas);
    const left = Math.min(this.drawStart.x, end.x);
    const top = Math.min(this.drawStart.y, end.y);
    const width = Math.abs(end.x - this.drawStart.x);
    const height = Math.abs(end.y - this.drawStart.y);
    this.drawing = false;
    this.drawStart = null;
    this.drawCurrent = null;

    // Ignore tiny drags (accidental clicks)
    if (width < 4 || height < 4) {
      this.drawOverlay();
      return;
    }

    const region = this.canvasRectToPdfRegion(left, top, width, height, canvas);
    this.regions = [...this.regions, region];
    this.clearResult();
    this.drawOverlay();
    pdfNotifySuccess(this.toast, `Region added on page ${this.currentPage}`);
    this.cdr.markForCheck();
  }

  async runRedact(): Promise<void> {
    if (!this.canRun || !this.file) {
      pdfNotifyWarning(this.toast, 'Upload a PDF and add text to redact and/or draw regions');
      return;
    }
    this.loading = true;
    this.loadingMessage = 'Redacting on secure server…';
    this.cdr.markForCheck();
    try {
      const form = new FormData();
      form.append('file', this.file, this.file.name);
      if (this.query.trim()) form.append('query', this.query.trim());
      if (this.regions.length) form.append('regions', JSON.stringify(this.regions));
      form.append('dpi', String(this.dpi || 150));
      this.resultBlob = await this.pdfBackend.advanced('/redact', form);
      this.lastActionCompleted = true;
      pdfNotifySuccess(this.toast, 'Redaction completed — download when ready');
    } catch (error) {
      pdfNotifyFailure(this.toast, error, 'Could not redact the PDF');
    } finally {
      this.loading = false;
      this.loadingMessage = 'Processing…';
      this.cdr.markForCheck();
    }
  }

  downloadResult(): void {
    if (!this.resultBlob) return;
    downloadBlob(this.resultBlob, this.outputFilename || 'redacted.pdf');
    pdfNotifySuccess(this.toast, 'Download started');
  }

  clearAll(): void {
    this.file = null;
    this.query = '';
    this.regions = [];
    this.currentPage = 1;
    this.totalPages = 0;
    this.destroyDoc();
    this.clearResult();
    this.cdr.markForCheck();
  }

  private clearResult(): void {
    this.resultBlob = null;
    this.lastActionCompleted = false;
  }

  private destroyDoc(): void {
    try {
      this.pdfDoc?.destroy?.();
    } catch {
      /* ignore */
    }
    this.pdfDoc = null;
    this.fileBytes = null;
  }

  private async loadPreview(file: File): Promise<void> {
    this.destroyDoc();
    const buffer = await file.arrayBuffer();
    this.fileBytes = new Uint8Array(buffer);
    const pdfjs = await this.pdfJs.getPdfJs();
    const data = new Uint8Array(this.fileBytes);
    this.pdfDoc = await pdfjs.getDocument({ data }).promise;
    this.totalPages = this.pdfDoc.numPages;
    this.currentPage = 1;
    await this.renderPreview();
  }

  private async renderPreview(): Promise<void> {
    if (!this.pdfDoc) return;
    const page = await this.pdfDoc.getPage(this.currentPage);
    const viewport = page.getViewport({ scale: 1 });
    this.pageWidthPt = viewport.width;
    this.pageHeightPt = viewport.height;

    const base = this.previewCanvas?.nativeElement;
    const overlay = this.overlayCanvas?.nativeElement;
    if (!base || !overlay) return;

    const maxWidth = Math.min(720, (typeof window !== 'undefined' ? window.innerWidth - 48 : 720));
    const scale = Math.min(1.25, maxWidth / viewport.width);
    const display = page.getViewport({ scale });

    base.width = Math.floor(display.width);
    base.height = Math.floor(display.height);
    overlay.width = base.width;
    overlay.height = base.height;
    base.style.width = `${base.width}px`;
    base.style.height = `${base.height}px`;
    overlay.style.width = `${overlay.width}px`;
    overlay.style.height = `${overlay.height}px`;

    const ctx = base.getContext('2d', { alpha: false });
    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport: display }).promise;
    this.drawOverlay();
    this.cdr.markForCheck();
  }

  private drawOverlay(): void {
    const overlay = this.overlayCanvas?.nativeElement;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const scaleX = overlay.width / this.pageWidthPt;
    const scaleY = overlay.height / this.pageHeightPt;
    const pageIndex = this.currentPage - 1;

    for (const region of this.regions) {
      if (region.pageIndex !== pageIndex) continue;
      const x = region.x * scaleX;
      const h = region.height * scaleY;
      const w = region.width * scaleX;
      const y = overlay.height - (region.y + region.height) * scaleY;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(220,38,38,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }

    if (this.drawing && this.drawStart && this.drawCurrent) {
      const left = Math.min(this.drawStart.x, this.drawCurrent.x);
      const top = Math.min(this.drawStart.y, this.drawCurrent.y);
      const w = Math.abs(this.drawCurrent.x - this.drawStart.x);
      const h = Math.abs(this.drawCurrent.y - this.drawStart.y);
      ctx.fillStyle = 'rgba(220,38,38,0.25)';
      ctx.fillRect(left, top, w, h);
      ctx.strokeStyle = 'rgba(220,38,38,0.95)';
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(left, top, w, h);
      ctx.setLineDash([]);
    }
  }

  private cssToCanvas(event: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return {
      x: Math.max(0, Math.min(canvas.width, x)),
      y: Math.max(0, Math.min(canvas.height, y)),
    };
  }

  private canvasRectToPdfRegion(
    left: number,
    top: number,
    width: number,
    height: number,
    canvas: HTMLCanvasElement
  ): RedactRegion {
    const scaleX = this.pageWidthPt / canvas.width;
    const scaleY = this.pageHeightPt / canvas.height;
    const pdfWidth = width * scaleX;
    const pdfHeight = height * scaleY;
    const pdfX = left * scaleX;
    // canvas top-left → PDF bottom-left
    const pdfY = this.pageHeightPt - (top + height) * scaleY;
    return {
      pageIndex: this.currentPage - 1,
      x: Math.round(pdfX * 100) / 100,
      y: Math.round(pdfY * 100) / 100,
      width: Math.round(pdfWidth * 100) / 100,
      height: Math.round(pdfHeight * 100) / 100,
    };
  }
}
