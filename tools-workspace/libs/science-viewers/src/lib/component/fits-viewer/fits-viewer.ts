import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import {
  FITS_ACCEPT_ATTR,
  FITS_FORMATS_HINT,
  FITS_FORMATS_LABEL,
  FITS_RELATED_TOOLS,
  FITS_SUPPORTED_EXTENSIONS
} from '../../constants/fits-viewer.constants';
import type {
  FitsColormap,
  FitsExportFormat,
  FitsHistogramBar,
  FitsHduPreview,
  FitsLoadedFile,
  FitsPlane,
  FitsViewMode
} from '../../types/fits-viewer.types';
import {
  canvasToPngDataUrl,
  computeZoomFit,
  drawImageDataToCanvas,
  drawLineChartToCanvas,
  pixelsToImageData
} from '../../utils/science-image-render.utils';
import {
  buildFitsHistogramBars,
  buildFitsMetadataRows,
  canExportFits,
  createFitsFileRecord,
  createSampleFitsFile,
  defaultWindowForPreview,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportFitsDataCsv,
  exportFitsHeaderJson,
  exportFitsSummaryJson,
  extractFitsSlice,
  filterHeaderCards,
  filterValidFitsFiles,
  formatFitsFileSize,
  getHduPreview,
  maxFitsSliceIndex,
  readFitsFileBytes,
  resolveFitsSuggestion
} from '../../utils/fits-viewer.utils';

@Component({
  selector: 'lib-fits-viewer',
  standalone: true,
  templateUrl: './fits-viewer.html',
  styleUrls: ['./fits-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FitsViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;
  @ViewChild('headerSearchInput') headerSearchInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = FITS_ACCEPT_ATTR;
  readonly relatedTools = FITS_RELATED_TOOLS;
  readonly supportedExtensions = FITS_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = FITS_FORMATS_LABEL;
  readonly formatsHint = FITS_FORMATS_HINT;
  readonly planes: FitsPlane[] = ['axial', 'coronal', 'sagittal'];
  readonly colormaps: FitsColormap[] = ['grayscale', 'hot', 'viridis'];
  readonly viewModes: ReadonlyArray<{ id: FitsViewMode; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'header', label: 'Header' },
    { id: 'wcs', label: 'WCS' }
  ];

  files: FitsLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: FitsViewMode = 'preview';
  selectedHduIndex = 0;
  headerQuery = '';
  plane: FitsPlane = 'axial';
  sliceIndex = 0;
  windowCenter = 0;
  windowWidth = 1;
  invert = false;
  colormap: FitsColormap = 'hot';
  zoom = 1;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): FitsLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get preview(): FitsHduPreview | null {
    const file = this.currentFile;
    if (!file?.parsed) return null;
    return getHduPreview(file, this.selectedHduIndex);
  }

  get canExport(): boolean {
    return canExportFits(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get maxSlice(): number {
    const preview = this.preview;
    if (!preview || preview.naxis < 3) return 0;
    return maxFitsSliceIndex(preview.viewDims, this.plane);
  }

  get planeLabel(): string {
    const preview = this.preview;
    if (!preview) return '';
    if (preview.naxis === 1) return '1D profile';
    if (preview.naxis === 2) return `2D · ${preview.shape.join('×')}`;
    return `${this.plane} · ${this.sliceIndex + 1}/${this.maxSlice + 1}`;
  }

  get histogramBars(): FitsHistogramBar[] {
    const preview = this.preview;
    return preview?.data.length ? buildFitsHistogramBars(preview) : [];
  }

  get metadataRows() {
    return this.parsed ? buildFitsMetadataRows(this.parsed, this.selectedHduIndex) : [];
  }

  get filteredHeaderCards() {
    const hdu = this.parsed?.hdus.find((h) => h.index === this.selectedHduIndex);
    return hdu ? filterHeaderCards(hdu.cards, this.headerQuery) : [];
  }

  get wcsInfo() {
    return this.parsed?.hdus.find((h) => h.index === this.selectedHduIndex)?.wcs ?? null;
  }

  get primarySuggestion() {
    const s = resolveFitsSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth += 1;
    this.showDropZone = true;
    this.cdr.markForCheck();
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (this.isFileDrag(event)) event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    if (event.dataTransfer?.files?.length) await this.handleFiles(Array.from(event.dataTransfer.files));
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentFile || this.isTypingTarget(event.target)) return;
    if (event.key === '/' && this.viewMode === 'header') {
      event.preventDefault();
      this.headerSearchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setSlice(this.sliceIndex - 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.setSlice(this.sliceIndex + 1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    }
  }

  trackByFileId(_i: number, f: FitsLoadedFile): string {
    return f.id;
  }

  trackByWarning(_i: number, w: string): string {
    return w;
  }

  trackByHdu(_i: number, h: { index: number }): number {
    return h.index;
  }

  formatSize(bytes: number): string {
    return formatFitsFileSize(bytes);
  }

  setViewMode(mode: FitsViewMode): void {
    this.viewMode = mode;
    if (mode === 'preview') setTimeout(() => this.renderCanvas(), 0);
    this.cdr.markForCheck();
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.handleFiles(Array.from(input.files));
    input.value = '';
  }

  async handleFiles(files: File[]): Promise<void> {
    const { accepted, rejected } = filterValidFitsFiles(files);
    rejected.forEach((r) => this.toast.error(`${r.name}: ${r.reason}`));
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    try {
      for (const file of accepted) {
        const bytes = await readFitsFileBytes(file);
        const record = createFitsFileRecord(file, bytes);
        const existing = this.files.findIndex((f) => f.id === record.id);
        if (existing >= 0) {
          this.files[existing] = record;
          this.currentIndex = existing;
        } else {
          this.files = [...this.files, record];
          this.currentIndex = this.files.length - 1;
        }
        this.syncFromCurrent();
      }
      this.fitZoom();
      this.renderCanvas();
      if (this.currentFile) this.toast.success(`Loaded ${this.currentFile.name}`);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleFitsFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.syncFromCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    this.files = this.files.filter((_, i) => i !== index);
    if (!this.files.length) {
      this.clearAll();
      return;
    }
    this.currentIndex = Math.min(index, this.files.length - 1);
    this.syncFromCurrent();
    this.renderCanvas();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.errorMessage = '';
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(s: { action: string }): void {
    if (s.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  selectHdu(index: number): void {
    this.selectedHduIndex = index;
    const preview = this.preview;
    if (preview) {
      const win = defaultWindowForPreview(preview);
      this.windowCenter = win.center;
      this.windowWidth = win.width;
      this.sliceIndex = 0;
    }
    this.fitZoom();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setPlane(plane: FitsPlane): void {
    this.plane = plane;
    this.sliceIndex = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setSlice(index: number): void {
    this.sliceIndex = Math.max(0, Math.min(this.maxSlice, index));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setColormap(c: FitsColormap): void {
    this.colormap = c;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleInvert(): void {
    this.invert = !this.invert;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomIn(): void {
    this.zoom = Math.min(8, this.zoom * 1.15);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomOut(): void {
    this.zoom = Math.max(0.1, this.zoom / 1.15);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fitZoom(): void {
    const preview = this.preview;
    const canvas = this.canvasHost?.nativeElement;
    if (!preview || !canvas) return;
    const dims = this.getSliceDims(preview);
    this.zoom = computeZoomFit(canvas.clientWidth, canvas.clientHeight, dims.width, dims.height);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetZoom(): void {
    this.zoom = 1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.fitZoom(), 0);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: FitsExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    const preview = this.preview;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/fits');
      else if (format === 'summary-json') downloadTextFile(exportFitsSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'header-json') downloadTextFile(exportFitsHeaderJson(file, this.selectedHduIndex), `${file.name}.header.json`, 'application/json');
      else if (format === 'data-csv' && preview) downloadTextFile(exportFitsDataCsv(preview), `${preview.name}.csv`, 'text/csv');
      else if (format === 'png') {
        const url = canvasToPngDataUrl(this.canvasHost.nativeElement);
        if (url) downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.preview) return;
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  private syncFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed) return;
    this.selectedHduIndex = parsed.defaultHduIndex;
    const preview = this.preview;
    if (preview) {
      const win = defaultWindowForPreview(preview);
      this.windowCenter = win.center;
      this.windowWidth = win.width;
    }
  }

  private getSliceDims(preview: FitsHduPreview): { width: number; height: number } {
    if (preview.naxis === 1) return { width: preview.data.length, height: 1 };
    if (preview.naxis === 2) return { width: preview.viewDims[0], height: preview.viewDims[1] };
    const slice = extractFitsSlice(preview.data, preview.viewDims, this.plane, this.sliceIndex);
    return { width: slice.width, height: slice.height };
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode !== 'preview') return;
    const canvas = this.canvasHost?.nativeElement;
    const preview = this.preview;
    if (!canvas || !preview) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    if (preview.naxis === 1) {
      drawLineChartToCanvas(canvas, preview.data, { color: '#f59e0b' });
      return;
    }
    let pixels: Float32Array;
    let width: number;
    let height: number;
    if (preview.naxis === 2) {
      width = preview.viewDims[0];
      height = preview.viewDims[1];
      pixels = preview.data;
    } else {
      const slice = extractFitsSlice(preview.data, preview.viewDims, this.plane, this.sliceIndex);
      pixels = slice.pixels;
      width = slice.width;
      height = slice.height;
    }
    const imageData = pixelsToImageData(pixels, width, height, {
      center: this.windowCenter,
      width: this.windowWidth,
      invert: this.invert,
      colormap: this.colormap
    });
    drawImageDataToCanvas(canvas, imageData, { zoom: this.zoom });
  }

  private clearCanvas(): void {
    const ctx = this.canvasHost?.nativeElement?.getContext('2d');
    const c = this.canvasHost?.nativeElement;
    if (ctx && c) ctx.clearRect(0, 0, c.width, c.height);
  }

  private observeCanvasResize(): void {
    const parent = this.canvasHost?.nativeElement?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.fitZoom());
    this.resizeObserver.observe(parent);
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types?.includes('Files');
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }
}
