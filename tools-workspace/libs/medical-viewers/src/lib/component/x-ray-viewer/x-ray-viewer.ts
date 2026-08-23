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
  XRAY_ACCEPT_ATTR,
  XRAY_FORMATS_HINT,
  XRAY_FORMATS_LABEL,
  XRAY_RELATED_TOOLS,
  XRAY_SUPPORTED_EXTENSIONS,
  XRAY_WINDOW_PRESETS
} from '../../constants/x-ray-viewer.constants';
import type {
  XRayExportFormat,
  XRayLoadedFile,
  XRayPixelProbe
} from '../../types/x-ray-viewer.types';
import {
  canvasToPngDataUrl,
  drawImageDataToCanvas,
  pixelsToImageData,
  computeZoomFit,
  rotatePixels90Clockwise
} from '../../utils/medical-image-render.utils';
import {
  canExportXRay,
  createSampleXRayFile,
  createXRayFileRecord,
  defaultWindowForXRay,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  enrichXRayFileRecord,
  exportXRayMetadataJson,
  exportXRaySummaryJson,
  filterValidXRayFiles,
  formatXRayFileSize,
  probeXRayPixel,
  readXRayFileBytes,
  resolveXRaySuggestion,
  sortDicomSeries
} from '../../utils/x-ray-viewer.utils';

import {
  applyMedicalFullscreenToggle,
  isDocumentFullscreen,
  listenFullscreenChange
} from '../../utils/medical-fullscreen.utils';

@Component({
  selector: 'lib-x-ray-viewer',
  standalone: true,
  templateUrl: './x-ray-viewer.html',
  styleUrls: ['./x-ray-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class XRayViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private unlistenFullscreen: (() => void) | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = XRAY_ACCEPT_ATTR;
  readonly relatedTools = XRAY_RELATED_TOOLS;
  readonly supportedExtensions = XRAY_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = XRAY_FORMATS_LABEL;
  readonly formatsHint = XRAY_FORMATS_HINT;
  readonly windowPresets = XRAY_WINDOW_PRESETS;

  xrayFiles: XRayLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  windowCenter = 400;
  windowWidth = 1500;
  invert = false;
  zoom = 1;
  activePresetId: string | null = null;
  probe: XRayPixelProbe | null = null;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private panX = 0;
  private panY = 0;
  private fitZoomLevel = 1;
  panning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private panDidMove = false;

  get currentFile(): XRayLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.xrayFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportXRay(this.currentFile);
  }

  get canPan(): boolean {
    return this.zoom > this.fitZoomLevel * 1.001;
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get primarySuggestion() {
    const suggestion = resolveXRaySuggestion({
      hasFiles: this.xrayFiles.length > 0,
      hasError: !!this.errorMessage,
      compressed: !!this.currentFile?.parsed?.compressed
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get seriesDescription(): string {
    return this.parsed?.seriesDescription || '';
  }

  get fileLabel(): string {
    const files = this.xrayFiles;
    if (files.length <= 1) {
      return this.currentFile?.parsed
        ? `${this.currentFile.parsed.rows}×${this.currentFile.parsed.columns}`
        : '';
    }
    return `File ${this.currentFileIndex + 1} / ${files.length}`;
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
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: XRayLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatXRayFileSize(bytes);
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
    const { accepted, rejected } = filterValidXRayFiles(files);
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
      const loaded: XRayLoadedFile[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readXRayFileBytes(file);
          loaded.push(enrichXRayFileRecord(createXRayFileRecord(file, bytes)));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid X-ray DICOM';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = sortDicomSeries([...this.xrayFiles, ...loaded]);
        const byId = new Map<string, XRayLoadedFile>();
        for (const item of merged) {
          byId.set(item.id, item);
        }
        this.xrayFiles = sortDicomSeries(Array.from(byId.values()));
        this.currentFileIndex = Math.min(
          Math.max(0, this.xrayFiles.length - loaded.length),
          this.xrayFiles.length - 1
        );
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load X-ray DICOM';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleXRayFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.xrayFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.probe = null;
    this.syncWindowFromCurrent();
    this.fitZoom();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFileSlider(event: Event): void {
    const index = Number((event.target as HTMLInputElement).value);
    this.selectFile(index);
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.xrayFiles.length) return;
    const next = this.xrayFiles.filter((_, i) => i !== index);
    this.xrayFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    if (this.currentFileIndex >= next.length) {
      this.currentFileIndex = next.length - 1;
    } else if (index < this.currentFileIndex) {
      this.currentFileIndex -= 1;
    }
    this.syncWindowFromCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.xrayFiles = [];
    this.currentFileIndex = -1;
    this.errorMessage = '';
    this.probe = null;
    this.clearCanvas();
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

  exportAs(format: XRayExportFormat, event?: Event): void {
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
        downloadTextFile(exportXRayMetadataJson(current), `${base}-metadata.json`, 'application/json');
        this.toast.success('Exported metadata JSON');
      } else if (format === 'summary-json') {
        downloadTextFile(exportXRaySummaryJson(current), `${base}-summary.json`, 'application/json');
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
      this.fitZoomLevel = 1;
      return;
    }
    const rect = canvas.parentElement?.getBoundingClientRect();
    const vw = Math.max(320, Math.floor(rect?.width ?? 800));
    const vh = Math.max(240, Math.floor(rect?.height ?? 560));
    this.zoom = computeZoomFit(vw, vh, parsed.columns, parsed.rows);
    this.fitZoomLevel = this.zoom;
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

  onCanvasWheel(event: WheelEvent): void {
    if (!this.currentFile || !this.parsed) return;
    event.preventDefault();
    const delta = event.deltaY === 0 ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    const step = delta > 0 ? 1 : -1;
    if (this.xrayFiles.length > 1 && !event.ctrlKey && !event.metaKey) {
      this.selectFile(this.currentFileIndex + step);
      return;
    }
    if (step > 0) this.zoomOut();
    else this.zoomIn();
  }

  rotate90(): void {
    const current = this.currentFile;
    const parsed = current?.parsed;
    if (!current || !parsed || current.softFail || parsed.compressed || !parsed.pixels.length) {
      return;
    }
    const rotated = rotatePixels90Clockwise(parsed.pixels, parsed.columns, parsed.rows);
    const updated: XRayLoadedFile = {
      ...current,
      parsed: {
        ...parsed,
        pixels: rotated.pixels,
        columns: rotated.width,
        rows: rotated.height
      }
    };
    this.xrayFiles = this.xrayFiles.map((f) => (f.id === current.id ? updated : f));
    this.probe = null;
    this.fitZoom();
    this.cdr.markForCheck();
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

  onCanvasMouseDown(event: MouseEvent): void {
    if (!this.currentFile || !this.canPan) return;
    event.preventDefault();
    this.panning = true;
    this.panDidMove = false;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panOriginX = this.panX;
    this.panOriginY = this.panY;
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.panning) return;
    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      this.panDidMove = true;
    }
    this.panX = this.panOriginX + dx;
    this.panY = this.panOriginY + dy;
    this.renderCanvas();
  }

  onCanvasMouseUp(): void {
    this.panning = false;
  }

  onCanvasMouseLeave(): void {
    this.panning = false;
  }

  onCanvasClick(event: MouseEvent): void {
    if (this.panDidMove) {
      this.panDidMove = false;
      return;
    }
    const parsed = this.parsed;
    const canvas = this.canvasHost?.nativeElement;
    if (!parsed || !canvas || parsed.compressed) return;

    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const drawW = parsed.columns * this.zoom;
    const drawH = parsed.rows * this.zoom;
    const ox = (canvas.width - drawW) / 2 + this.panX;
    const oy = (canvas.height - drawH) / 2 + this.panY;
    const x = Math.floor((mx - ox) / this.zoom);
    const y = Math.floor((my - oy) / this.zoom);
    const hit = probeXRayPixel(parsed, x, y);
    if (!hit) {
      this.probe = null;
    } else {
      this.probe = { x, y, raw: hit.raw, hu: hit.hu };
    }
    this.cdr.markForCheck();
  }

  private adjustWindowWidth(delta: number): void {
    this.windowWidth = Math.max(1, this.windowWidth + delta);
    this.activePresetId = null;
    this.renderCanvas();
  }

  private syncWindowFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed) return;
    const win = defaultWindowForXRay(parsed);
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
          : 'Load an X-ray DICOM to preview',
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
