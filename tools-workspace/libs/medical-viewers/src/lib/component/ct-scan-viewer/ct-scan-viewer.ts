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
  CT_ACCEPT_ATTR,
  CT_FORMATS_HINT,
  CT_FORMATS_LABEL,
  CT_RELATED_TOOLS,
  CT_SUPPORTED_EXTENSIONS,
  CT_WINDOW_PRESETS
} from '../../constants/ct-scan-viewer.constants';
import type {
  CtExportFormat,
  CtLoadedFile,
  CtMeasurePoint,
  CtMeasureResult,
  CtPixelProbe
} from '../../types/ct-scan-viewer.types';
import {
  canvasToPngDataUrl,
  drawImageDataToCanvas,
  pixelsToImageData,
  computeZoomFit
} from '../../utils/medical-image-render.utils';
import {
  canExportCt,
  createCtFileRecord,
  createSampleCtFile,
  defaultWindowForCt,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportCtMetadataJson,
  exportCtSummaryJson,
  filterValidCtFiles,
  formatCtFileSize,
  probeCtPixel,
  readCtFileBytes,
  resolveCtSuggestion,
  sortSlices,
  enrichCtFileRecord,
  buildMeasureResult
} from '../../utils/ct-scan-viewer.utils';

import {
  applyMedicalFullscreenToggle,
  isDocumentFullscreen,
  listenFullscreenChange
} from '../../utils/medical-fullscreen.utils';

@Component({
  selector: 'lib-ct-scan-viewer',
  standalone: true,
  templateUrl: './ct-scan-viewer.html',
  styleUrls: ['./ct-scan-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CtScanViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private unlistenFullscreen: (() => void) | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = CT_ACCEPT_ATTR;
  readonly relatedTools = CT_RELATED_TOOLS;
  readonly supportedExtensions = CT_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = CT_FORMATS_LABEL;
  readonly formatsHint = CT_FORMATS_HINT;
  readonly windowPresets = CT_WINDOW_PRESETS;

  ctFiles: CtLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  windowCenter = 40;
  windowWidth = 400;
  invert = false;
  zoom = 1;
  activePresetId: string | null = null;
  probe: CtPixelProbe | null = null;
  measureMode = false;
  measurePending: CtMeasurePoint | null = null;
  measure: CtMeasureResult | null = null;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private panX = 0;
  private panY = 0;

  get currentFile(): CtLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.ctFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportCt(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get primarySuggestion() {
    const suggestion = resolveCtSuggestion({
      hasFiles: this.ctFiles.length > 0,
      hasError: !!this.errorMessage,
      compressed: !!this.currentFile?.parsed?.compressed
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get sliceLabel(): string {
    if (this.ctFiles.length <= 1) {
      return this.currentFile?.parsed
        ? `${this.currentFile.parsed.rows}×${this.currentFile.parsed.columns}`
        : '';
    }
    return `Slice ${this.currentFileIndex + 1} / ${this.ctFiles.length}`;
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
        this.adjustWindowWidth(50);
      } else {
        this.zoomIn();
      }
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      if (event.shiftKey) {
        this.adjustWindowWidth(-50);
      } else {
        this.zoomOut();
      }
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.selectFile(this.currentFileIndex - 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.selectFile(this.currentFileIndex + 1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (this.measure || this.measurePending) {
        this.measure = null;
        this.measurePending = null;
        this.renderCanvas();
        this.cdr.markForCheck();
      } else if (this.isFullscreen) {
        this.toggleFullscreen();
      }
    }
  }

  trackByFileId(_index: number, file: CtLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatCtFileSize(bytes);
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
    const { accepted, rejected } = filterValidCtFiles(files);
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
      const loaded: CtLoadedFile[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readCtFileBytes(file);
          loaded.push(enrichCtFileRecord(createCtFileRecord(file, bytes)));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid CT DICOM';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = sortSlices([...this.ctFiles, ...loaded]);
        // de-dupe by id
        const byId = new Map<string, CtLoadedFile>();
        for (const item of merged) {
          byId.set(item.id, item);
        }
        this.ctFiles = sortSlices(Array.from(byId.values()));
        this.currentFileIndex = Math.max(0, this.ctFiles.length - loaded.length);
        this.clearMeasure();
        this.syncWindowFromCurrent();
        this.fitZoom();
        this.renderCanvas();
        const current = this.currentFile;
        if (current) {
          this.toast.success(`Loaded ${current.name}`);
          if (current.warnings.length) {
            this.toast.info(`${current.warnings.length} note(s) about this file`);
          }
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load CT DICOM';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleCtFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.ctFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.probe = null;
    this.measurePending = null;
    this.measure = null;
    this.syncWindowFromCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onSliceSlider(event: Event): void {
    const index = Number((event.target as HTMLInputElement).value);
    this.selectFile(index);
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.ctFiles.length) return;
    const next = this.ctFiles.filter((_, i) => i !== index);
    this.ctFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    this.syncWindowFromCurrent();
    this.renderCanvas();
  }

  clearAll(): void {
    this.ctFiles = [];
    this.currentFileIndex = -1;
    this.errorMessage = '';
    this.probe = null;
    this.clearMeasure();
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  toggleMeasureMode(): void {
    this.measureMode = !this.measureMode;
    if (!this.measureMode) {
      this.measurePending = null;
      this.renderCanvas();
    }
    this.cdr.markForCheck();
  }

  clearMeasure(): void {
    this.measurePending = null;
    this.measure = null;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { id: string; path: string }): void {
    if (suggestion.id === 'try-sample' || suggestion.id === 'upload') {
      if (suggestion.id === 'try-sample') {
        void this.loadSample();
      } else {
        this.openFilePicker();
      }
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

  exportAs(format: CtExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.(dcm|dicom|ima)$/i, '') || 'dicom';
    try {
      if (format === 'original') {
        downloadBinaryFile(current.bytes, current.name, 'application/dicom');
        this.toast.success('Exported original file');
      } else if (format === 'metadata-json') {
        downloadTextFile(exportCtMetadataJson(current), `${base}-metadata.json`, 'application/json');
        this.toast.success('Exported metadata JSON');
      } else if (format === 'summary-json') {
        downloadTextFile(exportCtSummaryJson(current), `${base}-summary.json`, 'application/json');
        this.toast.success('Exported summary JSON');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        const url = canvas ? canvasToPngDataUrl(canvas) : null;
        if (!url) {
          this.toast.error('PNG snapshot unavailable');
        } else {
          downloadDataUrl(url, `${base}-snapshot.png`);
          this.toast.success('Exported PNG snapshot');
        }
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  onWindowCenterChange(event: Event): void {
    this.windowCenter = Number((event.target as HTMLInputElement).value);
    this.activePresetId = null;
    this.renderCanvas();
  }

  onWindowWidthChange(event: Event): void {
    this.windowWidth = Math.max(1, Number((event.target as HTMLInputElement).value));
    this.activePresetId = null;
    this.renderCanvas();
  }

  applyPreset(presetId: string): void {
    const preset = this.windowPresets.find((p) => p.id === presetId);
    if (!preset) return;
    this.windowCenter = preset.center;
    this.windowWidth = preset.width;
    this.activePresetId = preset.id;
    this.renderCanvas();
    this.cdr.markForCheck();
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
    const rect = canvas.parentElement?.getBoundingClientRect();
    const vw = Math.max(320, Math.floor(rect?.width ?? 800));
    const vh = Math.max(240, Math.floor(rect?.height ?? 560));
    this.zoom = computeZoomFit(vw, vh, parsed.columns, parsed.rows);
    this.panX = 0;
    this.panY = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetZoom(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
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

  onCanvasClick(event: MouseEvent): void {
    const parsed = this.parsed;
    const canvas = this.canvasHost?.nativeElement;
    if (!parsed || !canvas || parsed.compressed) return;

    const point = this.canvasToImagePoint(event, canvas, parsed.columns, parsed.rows);
    if (!point) {
      this.probe = null;
      this.cdr.markForCheck();
      return;
    }
    const { x, y } = point;

    if (this.measureMode) {
      if (!this.measurePending) {
        this.measurePending = { x, y };
        this.measure = null;
      } else {
        this.measure = buildMeasureResult(this.measurePending, { x, y }, parsed.pixelSpacing);
        this.measurePending = null;
      }
      this.renderCanvas();
      this.cdr.markForCheck();
      return;
    }

    const hit = probeCtPixel(parsed, x, y);
    if (!hit) {
      this.probe = null;
    } else {
      this.probe = { x, y, raw: hit.raw, hu: hit.hu };
    }
    this.cdr.markForCheck();
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.currentFile || !this.parsed) return;
    event.preventDefault();
    const delta = event.deltaY === 0 ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    const step = delta > 0 ? 1 : -1;
    if (event.ctrlKey || event.metaKey) {
      if (step > 0) this.zoomOut();
      else this.zoomIn();
      return;
    }
    if (this.ctFiles.length > 1) {
      this.selectFile(this.currentFileIndex + step);
      return;
    }
    if (step > 0) this.zoomOut();
    else this.zoomIn();
  }

  private canvasToImagePoint(
    event: MouseEvent,
    canvas: HTMLCanvasElement,
    columns: number,
    rows: number
  ): CtMeasurePoint | null {
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const drawW = columns * this.zoom;
    const drawH = rows * this.zoom;
    const ox = (canvas.width - drawW) / 2 + this.panX;
    const oy = (canvas.height - drawH) / 2 + this.panY;
    const x = Math.floor((mx - ox) / this.zoom);
    const y = Math.floor((my - oy) / this.zoom);
    if (x < 0 || y < 0 || x >= columns || y >= rows) return null;
    return { x, y };
  }

  private adjustWindowWidth(delta: number): void {
    this.windowWidth = Math.max(1, this.windowWidth + delta);
    this.activePresetId = null;
    this.renderCanvas();
  }

  private syncWindowFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed) return;
    const win = defaultWindowForCt(parsed);
    this.windowCenter = win.center;
    this.windowWidth = Math.max(1, win.width);
    this.activePresetId = null;
    this.invert = parsed.photometricInterpretation === 'MONOCHROME1';
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

    if (!parsed || current?.softFail || !parsed.pixels.length) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(
        current?.softFail
          ? 'Compressed or unsupported pixel data — metadata only'
          : 'Load a CT DICOM to preview',
        24,
        40
      );
      this.cdr.markForCheck();
      return;
    }

    const scaled = new Float32Array(parsed.pixels.length);
    for (let i = 0; i < parsed.pixels.length; i++) {
      scaled[i] = parsed.pixels[i] * parsed.rescaleSlope + parsed.rescaleIntercept;
    }
    const imageData = pixelsToImageData(scaled, parsed.columns, parsed.rows, {
      center: this.windowCenter,
      width: this.windowWidth,
      invert: this.invert,
      colormap: 'grayscale'
    });
    drawImageDataToCanvas(canvas, imageData, {
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      background: '#0f172a'
    });
    this.drawMeasureOverlay(ctx, parsed.columns, parsed.rows, canvas.width, canvas.height);
    this.cdr.markForCheck();
  }

  private drawMeasureOverlay(
    ctx: CanvasRenderingContext2D,
    columns: number,
    rows: number,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const drawW = columns * this.zoom;
    const drawH = rows * this.zoom;
    const ox = (canvasWidth - drawW) / 2 + this.panX;
    const oy = (canvasHeight - drawH) / 2 + this.panY;
    const toScreen = (x: number, y: number) => ({
      x: ox + (x + 0.5) * this.zoom,
      y: oy + (y + 0.5) * this.zoom
    });

    const points = this.measure
      ? [this.measure.a, this.measure.b]
      : this.measurePending
        ? [this.measurePending]
        : [];
    if (!points.length) return;

    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.fillStyle = '#22d3ee';
    ctx.lineWidth = 2;
    if (this.measure) {
      const a = toScreen(this.measure.a.x, this.measure.a.y);
      const b = toScreen(this.measure.b.x, this.measure.b.y);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const point of points) {
      const screen = toScreen(point.x, point.y);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.measure) {
      const mid = toScreen(
        (this.measure.a.x + this.measure.b.x) / 2,
        (this.measure.a.y + this.measure.b.y) / 2
      );
      const label =
        this.measure.distanceMm != null
          ? `${this.measure.distanceMm.toFixed(1)} mm`
          : `${this.measure.distancePx.toFixed(1)} px`;
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#ecfeff';
      ctx.fillText(label, mid.x + 8, mid.y - 8);
    }
    ctx.restore();
  }

  private clearCanvas(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || typeof canvas.getContext !== 'function') return;
    // jsdom implements getContext but throws "not implemented" — skip in Jest.
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
