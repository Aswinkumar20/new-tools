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
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  NRRD_ACCEPT_ATTR,
  NRRD_FORMATS_HINT,
  NRRD_FORMATS_LABEL,
  NRRD_RELATED_TOOLS,
  NRRD_SUPPORTED_EXTENSIONS
} from '../../constants/nrrd-viewer.constants';
import type {
  NrrdColormap,
  NrrdExportFormat,
  NrrdHistogramBar,
  NrrdLoadedFile,
  NrrdPlane
} from '../../types/nrrd-viewer.types';
import {
  canvasToPngDataUrl,
  computeZoomFit,
  drawImageDataToCanvas,
  pixelsToImageData
} from '../../utils/medical-image-render.utils';
import {
  buildNrrdHistogramBars,
  canExportNrrd,
  createNrrdFileRecord,
  createSampleNrrdFile,
  defaultWindowForNrrd,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportNrrdHeaderJson,
  exportNrrdSummaryJson,
  extractNrrdSlice,
  filterValidNrrdFiles,
  formatNrrdFileSize,
  maxNrrdSliceIndex,
  readNrrdFileBytes,
  resolveNrrdSuggestion
} from '../../utils/nrrd-viewer.utils';

import {
  applyMedicalFullscreenToggle,
  isDocumentFullscreen,
  listenFullscreenChange
} from '../../utils/medical-fullscreen.utils';

@Component({
  selector: 'lib-nrrd-viewer',
  standalone: true,
  templateUrl: './nrrd-viewer.html',
  styleUrls: ['./nrrd-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NrrdViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private unlistenFullscreen: (() => void) | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = NRRD_ACCEPT_ATTR;
  readonly relatedTools = NRRD_RELATED_TOOLS;
  readonly supportedExtensions = NRRD_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = NRRD_FORMATS_LABEL;
  readonly formatsHint = NRRD_FORMATS_HINT;
  readonly planes: NrrdPlane[] = ['axial', 'coronal', 'sagittal'];
  readonly colormaps: NrrdColormap[] = ['grayscale', 'hot'];

  nrrdFiles: NrrdLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  plane: NrrdPlane = 'axial';
  sliceIndex = 0;
  windowCenter = 0;
  windowWidth = 1;
  invert = false;
  colormap: NrrdColormap = 'grayscale';
  zoom = 1;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): NrrdLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.nrrdFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportNrrd(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get maxSlice(): number {
    const parsed = this.parsed;
    if (!parsed) return 0;
    return maxNrrdSliceIndex(parsed.dims, this.plane);
  }

  get planeLabel(): string {
    return `${this.plane} · ${this.sliceIndex + 1} / ${this.maxSlice + 1}`;
  }

  get histogramBars(): NrrdHistogramBar[] {
    const parsed = this.parsed;
    if (!parsed?.data.length || this.currentFile?.softFail) {
      return [];
    }
    return buildNrrdHistogramBars(parsed);
  }

  get primarySuggestion() {
    const suggestion = resolveNrrdSuggestion({
      hasFiles: this.nrrdFiles.length > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.observeCanvasResize();
    this.unlistenFullscreen = listenFullscreenChange(() => {
      if (!isDocumentFullscreen() && this.isFullscreen) {
        this.isFullscreen = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.unlistenFullscreen?.();
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
    const files = event.dataTransfer?.files;
    if (files?.length) {
      await this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentFile || this.isTypingTarget(event.target)) return;

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      if (event.shiftKey) {
        this.windowWidth = Math.max(1, this.windowWidth * 1.1);
        this.renderCanvas();
      } else {
        this.zoomIn();
      }
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      if (event.shiftKey) {
        this.windowWidth = Math.max(1, this.windowWidth / 1.1);
        this.renderCanvas();
      } else {
        this.zoomOut();
      }
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setSlice(this.sliceIndex - 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.setSlice(this.sliceIndex + 1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: NrrdLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByHistogramBar(_index: number, bar: NrrdHistogramBar): string {
    return bar.label;
  }

  formatSize(bytes: number): string {
    return formatNrrdFileSize(bytes);
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
    const { accepted, rejected } = filterValidNrrdFiles(files);
    for (const item of rejected) {
      this.toast.error(`${item.name}: ${item.reason}`);
    }
    if (accepted.length === 0) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      for (const file of accepted) {
        try {
          const bytes = await readNrrdFileBytes(file);
          const record = createNrrdFileRecord(file, bytes);
          const existing = this.nrrdFiles.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.nrrdFiles[existing] = record;
            this.currentFileIndex = existing;
          } else {
            this.nrrdFiles = [...this.nrrdFiles, record];
            this.currentFileIndex = this.nrrdFiles.length - 1;
          }
          this.syncFromCurrent();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid NRRD';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.fitZoom();
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.warnings.length) {
          this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load NRRD';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleNrrdFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.nrrdFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.syncFromCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.nrrdFiles.length) return;
    const next = this.nrrdFiles.filter((_, i) => i !== index);
    this.nrrdFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    this.syncFromCurrent();
    this.renderCanvas();
  }

  clearAll(): void {
    this.nrrdFiles = [];
    this.currentFileIndex = -1;
    this.errorMessage = '';
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { id: string }): void {
    if (suggestion.id === 'try-sample') {
      void this.loadSample();
    } else {
      this.openFilePicker();
    }
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 220);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: NrrdExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    let base = current.name;
    if (base.toLowerCase().endsWith('.nhdr')) {
      base = base.slice(0, -5);
    } else if (base.toLowerCase().endsWith('.nrrd')) {
      base = base.slice(0, -5);
    }
    base = base || 'nrrd';
    try {
      if (format === 'original') {
        downloadBinaryFile(current.bytes, current.name, 'application/octet-stream');
        this.toast.success('Exported original file');
      } else if (format === 'header-json') {
        downloadTextFile(exportNrrdHeaderJson(current), `${base}-header.json`, 'application/json');
        this.toast.success('Exported header JSON');
      } else if (format === 'summary-json') {
        downloadTextFile(exportNrrdSummaryJson(current), `${base}-summary.json`, 'application/json');
        this.toast.success('Exported summary JSON');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        const url = canvas ? canvasToPngDataUrl(canvas) : null;
        if (!url) {
          this.toast.error('PNG snapshot unavailable');
        } else {
          downloadDataUrl(url, `${base}-${this.plane}-slice.png`);
          this.toast.success('Exported PNG snapshot');
        }
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  setPlane(plane: NrrdPlane): void {
    this.plane = plane;
    this.sliceIndex = Math.min(this.sliceIndex, this.maxSlice);
    this.fitZoom();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onPlaneChange(event: Event): void {
    this.setPlane((event.target as HTMLSelectElement).value as NrrdPlane);
  }

  setSlice(index: number): void {
    this.sliceIndex = Math.max(0, Math.min(this.maxSlice, index));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onSliceChange(event: Event): void {
    this.setSlice(Number((event.target as HTMLInputElement).value));
  }

  onWindowCenterChange(event: Event): void {
    this.windowCenter = Number((event.target as HTMLInputElement).value);
    this.renderCanvas();
  }

  onWindowWidthChange(event: Event): void {
    this.windowWidth = Math.max(1e-6, Number((event.target as HTMLInputElement).value));
    this.renderCanvas();
  }

  onColormapChange(event: Event): void {
    this.colormap = (event.target as HTMLSelectElement).value as NrrdColormap;
    this.renderCanvas();
  }

  toggleInvert(): void {
    this.invert = !this.invert;
    this.renderCanvas();
  }

  zoomIn(): void {
    this.zoom = Math.min(8, this.zoom * 1.15);
    this.renderCanvas();
  }

  zoomOut(): void {
    this.zoom = Math.max(0.1, this.zoom / 1.15);
    this.renderCanvas();
  }

  fitZoom(): void {
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas || !parsed) {
      this.zoom = 1;
      return;
    }
    const slice = extractNrrdSlice(parsed.data, parsed.dims, this.plane, this.sliceIndex);
    const rect = canvas.parentElement?.getBoundingClientRect();
    const vw = Math.max(320, Math.floor(rect?.width ?? 800));
    const vh = Math.max(240, Math.floor(rect?.height ?? 560));
    this.zoom = computeZoomFit(vw, vh, slice.width, slice.height);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetZoom(): void {
    this.zoom = 1;
    this.renderCanvas();
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.isBrowser) {
      this.isFullscreen = !this.isFullscreen;
      this.cdr.markForCheck();
      return;
    }
    const result = await applyMedicalFullscreenToggle(this.hostEl.nativeElement, this.isFullscreen);
    this.isFullscreen = result.active;
    this.cdr.markForCheck();
    setTimeout(() => this.fitZoom(), 80);
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.currentFile || !this.parsed) return;
    event.preventDefault();
    const delta = event.deltaY === 0 ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    const step = delta > 0 ? 1 : -1;
    this.setSlice(this.sliceIndex + step);
  }

  private syncFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed) return;
    const win = defaultWindowForNrrd(parsed);
    this.windowCenter = win.center;
    this.windowWidth = Math.max(1e-6, win.width);
    this.sliceIndex = Math.min(this.sliceIndex, this.maxSlice);
    if (this.plane === 'axial') {
      this.sliceIndex = Math.floor(this.maxSlice / 2);
    }
  }

  private renderCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    const current = this.currentFile;
    const parsed = current?.parsed;
    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect?.width ?? 800));
    const height = Math.max(240, Math.floor(rect?.height ?? 560));
    canvas.width = width;
    canvas.height = height;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    if (!parsed || current?.softFail || !parsed.data.length) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(
        current?.softFail ? 'Unsupported NRRD datatype' : 'Load an NRRD volume to preview',
        24,
        40
      );
      this.cdr.markForCheck();
      return;
    }

    const slice = extractNrrdSlice(parsed.data, parsed.dims, this.plane, this.sliceIndex);
    const imageData = pixelsToImageData(slice.pixels, slice.width, slice.height, {
      center: this.windowCenter,
      width: this.windowWidth,
      invert: this.invert,
      colormap: this.colormap
    });
    drawImageDataToCanvas(canvas, imageData, {
      zoom: this.zoom,
      background: '#0f172a'
    });

    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(12, 12, 160, 28);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(this.planeLabel, 20, 30);

    this.cdr.markForCheck();
  }

  private clearCanvas(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || typeof canvas.getContext !== 'function') return;
    if (typeof process !== 'undefined' && process.env['JEST_WORKER_ID']) {
      return;
    }
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width || 1, canvas.height || 1);
  }

  private observeCanvasResize(): void {
    const host = this.canvasHost?.nativeElement?.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.renderCanvas());
    this.resizeObserver.observe(host);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private isFileDrag(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }
}
