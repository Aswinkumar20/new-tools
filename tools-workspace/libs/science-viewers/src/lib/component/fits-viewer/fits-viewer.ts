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
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
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
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FitsViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('headerSearchInput') headerSearchInput?: ElementRef<HTMLInputElement>;

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

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

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

  get canUseCanvasExport(): boolean {
    return this.viewMode === 'preview';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Host listeners
  // ---------------------------------------------------------------------------

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
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
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
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    if (event.key === 'Escape' && this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    if (!this.currentFile) return;
    if (event.key === '/' && this.viewMode === 'header') {
      event.preventDefault();
      this.headerSearchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setSlice(this.sliceIndex - 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.setSlice(this.sliceIndex + 1);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      this.toggleInvert();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy / formatters
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // File load / clear
  // ---------------------------------------------------------------------------

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
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    try {
      for (const file of accepted) {
        try {
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
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid FITS'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.fitZoom();
      this.renderCanvas();
      if (this.currentFile) {
        this.errorMessage = '';
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with incomplete HDUs — preview may be limited');
        } else if (this.currentFile.warnings.length) {
          this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
        }
      }
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
    if (index < 0 || index >= this.files.length) return;
    const next = this.files.filter((_, i) => i !== index);
    this.files = next;
    if (!next.length) {
      this.clearAll();
      return;
    }
    this.currentIndex = Math.min(index, next.length - 1);
    this.syncFromCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedHduIndex = 0;
    this.errorMessage = '';
    this.headerQuery = '';
    this.plane = 'axial';
    this.sliceIndex = 0;
    this.windowCenter = 0;
    this.windowWidth = 1;
    this.invert = false;
    this.colormap = 'hot';
    this.zoom = 1;
    this.viewMode = 'preview';
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Selection / filters / view controls
  // ---------------------------------------------------------------------------

  setViewMode(mode: FitsViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.cdr.markForCheck();
    if (mode === 'preview') setTimeout(() => this.renderCanvas(), 0);
  }

  selectHdu(index: number): void {
    if (this.selectedHduIndex === index) return;
    this.selectedHduIndex = index;
    this.headerQuery = '';
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
    if (this.plane === plane) return;
    this.plane = plane;
    this.sliceIndex = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setSlice(index: number): void {
    const next = Math.max(0, Math.min(this.maxSlice, Math.round(index)));
    if (next === this.sliceIndex) return;
    this.sliceIndex = next;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setColormap(c: FitsColormap): void {
    if (this.colormap === c) return;
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
    const next = Math.min(8, this.zoom * 1.15);
    if (next === this.zoom) return;
    this.zoom = next;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomOut(): void {
    const next = Math.max(0.1, this.zoom / 1.15);
    if (next === this.zoom) return;
    this.zoom = next;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fitZoom(): void {
    const preview = this.preview;
    const canvas = this.canvasHost?.nativeElement;
    if (!preview || !canvas) return;
    const dims = this.getSliceDims(preview);
    const next = computeZoomFit(canvas.clientWidth || 320, canvas.clientHeight || 280, dims.width, dims.height);
    if (next === this.zoom) {
      this.renderCanvas();
      return;
    }
    this.zoom = next;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetZoom(): void {
    if (this.zoom === 1) return;
    this.zoom = 1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onHeaderQueryChange(): void {
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Suggestions / chrome / export
  // ---------------------------------------------------------------------------

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(s: { action: string }): void {
    if (s.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.fitZoom(), 0);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    if (!this.canExport) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: FitsExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    const preview = this.preview;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/fits');
      else if (format === 'summary-json') downloadTextFile(exportFitsSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'header-json') downloadTextFile(exportFitsHeaderJson(file, this.selectedHduIndex), `${file.name}.header.json`, 'application/json');
      else if (format === 'data-csv') {
        if (!preview) {
          this.toast.info('No image data available for CSV export');
          this.cdr.markForCheck();
          return;
        }
        downloadTextFile(exportFitsDataCsv(preview), `${preview.name}.csv`, 'text/csv');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || !this.canUseCanvasExport) {
          this.toast.info('Open Preview view to export a PNG snapshot');
          this.cdr.markForCheck();
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (!url) {
          this.toast.error('Could not capture PNG snapshot');
          this.cdr.markForCheck();
          return;
        }
        downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.preview || !this.canUseCanvasExport) return;
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private syncFromCurrent(): void {
    const parsed = this.parsed;
    this.headerQuery = '';
    this.plane = 'axial';
    this.sliceIndex = 0;
    this.invert = false;
    this.colormap = 'hot';
    this.zoom = 1;
    if (!parsed) {
      this.selectedHduIndex = 0;
      this.windowCenter = 0;
      this.windowWidth = 1;
      return;
    }
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
    if (!this.isBrowser || !this.canUseCanvasExport) return;
    const canvas = this.canvasHost?.nativeElement;
    const preview = this.preview;
    if (!canvas || !preview) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
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
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private observeCanvasResize(): void {
    const host = this.mapWrap?.nativeElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.canUseCanvasExport) this.fitZoom();
    });
    this.resizeObserver.observe(host);
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
