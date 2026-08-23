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
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import {
  GRIB_ACCEPT_ATTR,
  GRIB_FORMATS_HINT,
  GRIB_FORMATS_LABEL,
  GRIB_RELATED_TOOLS,
  GRIB_SUPPORTED_EXTENSIONS
} from '../../constants/grib-viewer.constants';
import type {
  GribColormap,
  GribExportFormat,
  GribHistogramBar,
  GribLoadedFile,
  GribMessageField
} from '../../types/grib-viewer.types';
import {
  canvasToPngDataUrl,
  computeZoomFit,
  drawImageDataToCanvas,
  pixelsToImageData
} from '../../utils/science-image-render.utils';
import {
  buildGribHistogramBars,
  buildGribMetadataRows,
  canExportGrib,
  createGribFileRecord,
  createSampleGribFile,
  defaultWindowForField,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportGribFieldCsv,
  exportGribMessagesJson,
  exportGribSummaryJson,
  filterValidGribFiles,
  formatGribFileSize,
  getMessageField,
  readGribFileBytes,
  resolveGribSuggestion
} from '../../utils/grib-viewer.utils';

@Component({
  selector: 'lib-grib-viewer',
  standalone: true,
  templateUrl: './grib-viewer.html',
  styleUrls: ['./grib-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GribViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = GRIB_ACCEPT_ATTR;
  readonly relatedTools = GRIB_RELATED_TOOLS;
  readonly supportedExtensions = GRIB_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = GRIB_FORMATS_LABEL;
  readonly formatsHint = GRIB_FORMATS_HINT;
  readonly colormaps: GribColormap[] = ['grayscale', 'hot', 'viridis'];

  files: GribLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  selectedMessageIndex = 0;
  windowCenter = 0;
  windowWidth = 1;
  invert = false;
  colormap: GribColormap = 'viridis';
  zoom = 1;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): GribLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get field(): GribMessageField | null {
    const file = this.currentFile;
    if (!file?.parsed) return null;
    return getMessageField(file, this.selectedMessageIndex);
  }

  get canExport(): boolean {
    return canExportGrib(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get fieldLabel(): string {
    const f = this.field;
    return f ? `${f.parameterName} · ${f.ni}×${f.nj}` : '';
  }

  get histogramBars(): GribHistogramBar[] {
    const f = this.field;
    return f ? buildGribHistogramBars(f) : [];
  }

  get metadataRows() {
    return this.field ? buildGribMetadataRows(this.field) : [];
  }

  get primarySuggestion() {
    const s = resolveGribSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomOut();
    }
  }

  trackByFileId(_i: number, f: GribLoadedFile): string {
    return f.id;
  }

  trackByWarning(_i: number, w: string): string {
    return w;
  }

  trackByMessage(_i: number, m: GribMessageField): number {
    return m.index;
  }

  formatSize(bytes: number): string {
    return formatGribFileSize(bytes);
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
    const { accepted, rejected } = filterValidGribFiles(files);
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
        const bytes = await readGribFileBytes(file);
        const record = createGribFileRecord(file, bytes);
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
    await this.handleFiles([createSampleGribFile()]);
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

  selectMessage(index: number): void {
    this.selectedMessageIndex = index;
    const f = this.field;
    if (f) {
      const win = defaultWindowForField(f);
      this.windowCenter = win.center;
      this.windowWidth = win.width;
    }
    this.fitZoom();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setColormap(c: GribColormap): void {
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
    const f = this.field;
    const canvas = this.canvasHost?.nativeElement;
    if (!f || !canvas) return;
    this.zoom = computeZoomFit(canvas.clientWidth, canvas.clientHeight, f.ni, f.nj);
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

  exportAs(format: GribExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    const field = this.field;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportGribSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'messages-json') downloadTextFile(exportGribMessagesJson(file), `${file.name}.messages.json`, 'application/json');
      else if (format === 'field-csv' && field) downloadTextFile(exportGribFieldCsv(field), `${field.parameterName}.csv`, 'text/csv');
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
    if (!this.field) return;
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  private syncFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed) return;
    this.selectedMessageIndex = parsed.defaultMessageIndex;
    const f = this.field;
    if (f) {
      const win = defaultWindowForField(f);
      this.windowCenter = win.center;
      this.windowWidth = win.width;
    }
  }

  private renderCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    const field = this.field;
    if (!canvas || !field) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    const imageData = pixelsToImageData(field.data, field.ni, field.nj, {
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
