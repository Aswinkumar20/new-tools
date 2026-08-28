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
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
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
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GribViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;

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
    this.resizeObserver = null;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (!this.showExportMenu) return;
    this.showExportMenu = false;
    this.cdr.markForCheck();
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
    if (event.key === '+' || event.key === '=') {
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
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid GRIB'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.fitZoom();
      this.renderCanvas();
      if (this.currentFile) {
        this.errorMessage = '';
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no message data — metadata may still be available');
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
    this.selectedMessageIndex = 0;
    this.windowCenter = 0;
    this.windowWidth = 1;
    this.invert = false;
    this.colormap = 'viridis';
    this.zoom = 1;
    this.errorMessage = '';
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
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
    if (index === this.selectedMessageIndex) return;
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
    if (c === this.colormap) return;
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
    const f = this.field;
    const canvas = this.canvasHost?.nativeElement;
    if (!f || !canvas) return;
    this.zoom = computeZoomFit(canvas.clientWidth || 320, canvas.clientHeight || 280, f.ni, f.nj);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetZoom(): void {
    if (this.zoom === 1) return;
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
    if (!this.canExport) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: GribExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    const field = this.field;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportGribSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'messages-json') downloadTextFile(exportGribMessagesJson(file), `${file.name}.messages.json`, 'application/json');
      else if (format === 'field-csv') {
        if (!field) {
          this.toast.info('Select a message field to export CSV');
          this.cdr.markForCheck();
          return;
        }
        downloadTextFile(exportGribFieldCsv(field), `${field.parameterName}.csv`, 'text/csv');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas) {
          this.toast.info('Open a field preview to export a PNG snapshot');
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
    if (!this.field) return;
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  private syncFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed?.messages.length) {
      this.selectedMessageIndex = 0;
      this.windowCenter = 0;
      this.windowWidth = 1;
      return;
    }
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
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, Math.min(520, parent.clientHeight || 420));
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
    if (!this.isBrowser) return;
    const c = this.canvasHost?.nativeElement;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
  }

  private observeCanvasResize(): void {
    const host = this.mapWrap?.nativeElement ?? this.canvasHost?.nativeElement?.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.fitZoom());
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
