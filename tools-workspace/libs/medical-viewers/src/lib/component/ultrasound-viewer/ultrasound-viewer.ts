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
  ULTRASOUND_ACCEPT_ATTR,
  ULTRASOUND_DEFAULT_FPS,
  ULTRASOUND_FORMATS_HINT,
  ULTRASOUND_FORMATS_LABEL,
  ULTRASOUND_RELATED_TOOLS,
  ULTRASOUND_SUPPORTED_EXTENSIONS,
  ULTRASOUND_WINDOW_PRESETS
} from '../../constants/ultrasound-viewer.constants';
import type {
  UltrasoundCineMode,
  UltrasoundExportFormat,
  UltrasoundLoadedFile,
  UltrasoundPixelProbe,
  UltrasoundSeriesGroup
} from '../../types/ultrasound-viewer.types';
import {
  canvasToPngDataUrl,
  drawImageDataToCanvas,
  pixelsToImageData,
  computeZoomFit
} from '../../utils/medical-image-render.utils';
import {
  canExportUltrasound,
  createUltrasoundFileRecord,
  createSampleUltrasoundFile,
  defaultWindowForUltrasound,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportUltrasoundMetadataJson,
  exportUltrasoundSummaryJson,
  filterValidUltrasoundFiles,
  formatUltrasoundFileSize,
  probeUltrasoundPixel,
  readUltrasoundFileBytes,
  resolveUltrasoundSuggestion,
  resolveUltrasoundCineMode,
  resolveCineFrameCount,
  getCineDisplayPixels,
  groupBySeries,
  sortSlices,
  enrichUltrasoundFileRecord
} from '../../utils/ultrasound-viewer.utils';

import {
  applyMedicalFullscreenToggle,
  isDocumentFullscreen,
  listenFullscreenChange
} from '../../utils/medical-fullscreen.utils';

@Component({
  selector: 'lib-ultrasound-viewer',
  standalone: true,
  templateUrl: './ultrasound-viewer.html',
  styleUrls: ['./ultrasound-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UltrasoundViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private unlistenFullscreen: (() => void) | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = ULTRASOUND_ACCEPT_ATTR;
  readonly relatedTools = ULTRASOUND_RELATED_TOOLS;
  readonly supportedExtensions = ULTRASOUND_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = ULTRASOUND_FORMATS_LABEL;
  readonly formatsHint = ULTRASOUND_FORMATS_HINT;
  readonly windowPresets = ULTRASOUND_WINDOW_PRESETS;
  readonly defaultFps = ULTRASOUND_DEFAULT_FPS;

  usFiles: UltrasoundLoadedFile[] = [];
  currentFileIndex = -1;
  seriesGroups: UltrasoundSeriesGroup[] = [];
  activeSeriesIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  windowCenter = 128;
  windowWidth = 256;
  invert = false;
  zoom = 1;
  activePresetId: string | null = null;
  probe: UltrasoundPixelProbe | null = null;

  cineFrameIndex = 0;
  cinePlaying = false;
  cineFps = ULTRASOUND_DEFAULT_FPS;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private panX = 0;
  private panY = 0;
  private cineTimer: ReturnType<typeof setInterval> | null = null;

  get currentFile(): UltrasoundLoadedFile | null {
    const files = this.seriesFiles;
    return this.currentFileIndex >= 0 ? files[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportUltrasound(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get primarySuggestion() {
    const suggestion = resolveUltrasoundSuggestion({
      hasFiles: this.usFiles.length > 0,
      hasError: !!this.errorMessage,
      compressed: !!this.currentFile?.parsed?.compressed
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get seriesFiles(): UltrasoundLoadedFile[] {
    return this.seriesGroups[this.activeSeriesIndex]?.files ?? this.usFiles;
  }

  get activeSeries(): UltrasoundSeriesGroup | null {
    return this.seriesGroups[this.activeSeriesIndex] ?? null;
  }

  get seriesDescription(): string {
    return this.parsed?.seriesDescription || this.activeSeries?.description || '';
  }

  get protocolName(): string {
    return this.parsed?.protocolName || this.activeSeries?.protocolName || '';
  }

  get cineMode(): UltrasoundCineMode {
    return resolveUltrasoundCineMode(this.parsed, this.seriesFiles.length);
  }

  get cineFrameCount(): number {
    return resolveCineFrameCount(this.cineMode, this.parsed, this.seriesFiles.length);
  }

  get isCine(): boolean {
    return this.cineMode !== 'single';
  }

  get activeCineFrameIndex(): number {
    return this.cineMode === 'multi-file' ? this.currentFileIndex : this.cineFrameIndex;
  }

  get frameLabel(): string {
    if (!this.parsed) {
      return '';
    }
    if (this.isCine) {
      return `Frame ${this.activeCineFrameIndex + 1} / ${this.cineFrameCount}`;
    }
    return `${this.parsed.rows}×${this.parsed.columns}`;
  }

  get cineModeLabel(): string {
    if (this.cineMode === 'multi-frame') {
      return 'Multi-frame cine';
    }
    if (this.cineMode === 'multi-file') {
      return 'Multi-file cine';
    }
    return 'Single frame';
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
    this.pauseCine();
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
      if (this.isCine) {
        this.selectCineFrame(this.activeCineFrameIndex - 1);
      } else {
        this.selectFile(this.currentFileIndex - 1);
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (this.isCine) {
        this.selectCineFrame(this.activeCineFrameIndex + 1);
      } else {
        this.selectFile(this.currentFileIndex + 1);
      }
    } else if (event.key === ' ') {
      event.preventDefault();
      if (this.isCine) {
        this.toggleCinePlayback();
      }
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: UltrasoundLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatUltrasoundFileSize(bytes);
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
    const { accepted, rejected } = filterValidUltrasoundFiles(files);
    for (const item of rejected) {
      this.toast.error(`${item.name}: ${item.reason}`);
    }
    if (accepted.length === 0) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.pauseCine();
    this.cdr.markForCheck();

    try {
      const loaded: UltrasoundLoadedFile[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readUltrasoundFileBytes(file);
          loaded.push(enrichUltrasoundFileRecord(createUltrasoundFileRecord(file, bytes)));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid ultrasound DICOM';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = sortSlices([...this.usFiles, ...loaded]);
        const byId = new Map<string, UltrasoundLoadedFile>();
        for (const item of merged) {
          byId.set(item.id, item);
        }
        this.usFiles = sortSlices(Array.from(byId.values()));
        this.rebuildSeries(Math.max(0, this.usFiles.length - loaded.length));
        this.cineFrameIndex = 0;
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load ultrasound DICOM';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleUltrasoundFile()]);
  }

  selectFile(index: number): void {
    const files = this.seriesFiles;
    if (index < 0 || index >= files.length || index === this.currentFileIndex) {
      return;
    }
    this.pauseCine();
    this.currentFileIndex = index;
    this.cineFrameIndex = 0;
    this.probe = null;
    this.syncWindowFromCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onSliceSlider(event: Event): void {
    const index = Number((event.target as HTMLInputElement).value);
    if (this.isCine) {
      this.selectCineFrame(index);
    } else {
      this.selectFile(index);
    }
  }

  selectCineFrame(index: number): void {
    const count = this.cineFrameCount;
    if (count <= 0) return;
    const clamped = ((index % count) + count) % count;

    if (this.cineMode === 'multi-file') {
      if (clamped === this.currentFileIndex) return;
      this.currentFileIndex = clamped;
      this.probe = null;
      this.syncWindowFromCurrent();
    } else if (this.cineMode === 'multi-frame') {
      if (clamped === this.cineFrameIndex) return;
      this.cineFrameIndex = clamped;
    }

    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onCineFrameSlider(event: Event): void {
    this.selectCineFrame(Number((event.target as HTMLInputElement).value));
  }

  toggleCinePlayback(): void {
    if (this.cinePlaying) {
      this.pauseCine();
    } else {
      this.playCine();
    }
  }

  playCine(): void {
    if (!this.isCine || this.cineFrameCount <= 1) return;
    this.pauseCine();
    this.cinePlaying = true;
    const intervalMs = Math.max(16, Math.round(1000 / this.cineFps));
    this.cineTimer = setInterval(() => {
      this.advanceCineFrame();
    }, intervalMs);
    this.cdr.markForCheck();
  }

  pauseCine(): void {
    if (this.cineTimer !== null) {
      clearInterval(this.cineTimer);
      this.cineTimer = null;
    }
    this.cinePlaying = false;
    this.cdr.markForCheck();
  }

  onCineFpsChange(event: Event): void {
    this.cineFps = Math.max(1, Math.min(30, Number((event.target as HTMLInputElement).value)));
    if (this.cinePlaying) {
      this.playCine();
    } else {
      this.cdr.markForCheck();
    }
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    const files = this.seriesFiles;
    if (index < 0 || index >= files.length) return;
    const targetId = files[index].id;
    this.pauseCine();
    const next = this.usFiles.filter((f) => f.id !== targetId);
    this.usFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.rebuildSeries(Math.min(index, Math.max(0, this.seriesFiles.length - 1)));
    this.cineFrameIndex = 0;
    this.syncWindowFromCurrent();
    this.renderCanvas();
  }

  clearAll(): void {
    this.pauseCine();
    this.usFiles = [];
    this.seriesGroups = [];
    this.activeSeriesIndex = 0;
    this.currentFileIndex = -1;
    this.cineFrameIndex = 0;
    this.errorMessage = '';
    this.probe = null;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  selectSeries(index: number): void {
    if (index < 0 || index >= this.seriesGroups.length || index === this.activeSeriesIndex) {
      return;
    }
    this.pauseCine();
    this.activeSeriesIndex = index;
    this.currentFileIndex = 0;
    this.cineFrameIndex = 0;
    this.probe = null;
    this.syncWindowFromCurrent();
    this.fitZoom();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onSeriesChange(event: Event): void {
    this.selectSeries(Number((event.target as HTMLSelectElement).value));
  }

  private rebuildSeries(preferredFileIndex = 0): void {
    this.seriesGroups = groupBySeries(this.usFiles);
    if (!this.seriesGroups.length) {
      this.activeSeriesIndex = 0;
      this.currentFileIndex = -1;
      return;
    }
    if (this.activeSeriesIndex >= this.seriesGroups.length) {
      this.activeSeriesIndex = 0;
    }
    const files = this.seriesFiles;
    this.currentFileIndex = Math.min(Math.max(0, preferredFileIndex), Math.max(0, files.length - 1));
  }

  private advanceCineFrame(): void {
    const count = this.cineFrameCount;
    if (count <= 1) {
      this.pauseCine();
      return;
    }
    this.selectCineFrame(this.activeCineFrameIndex + 1);
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

  exportAs(format: UltrasoundExportFormat, event?: Event): void {
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
        downloadTextFile(
          exportUltrasoundMetadataJson(current),
          `${base}-metadata.json`,
          'application/json'
        );
        this.toast.success('Exported metadata JSON');
      } else if (format === 'summary-json') {
        downloadTextFile(
          exportUltrasoundSummaryJson(current),
          `${base}-summary.json`,
          'application/json'
        );
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
    if (this.cineFrameCount > 1) {
      this.selectCineFrame(this.activeCineFrameIndex + step);
      return;
    }
    if (step > 0) this.zoomOut();
    else this.zoomIn();
  }

  onCanvasClick(event: MouseEvent): void {
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
    const frameIdx = this.cineMode === 'multi-frame' ? this.cineFrameIndex : 0;
    const hit = probeUltrasoundPixel(parsed, x, y, frameIdx);
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
    const win = defaultWindowForUltrasound(parsed);
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
          : 'Load an ultrasound DICOM to preview',
        24,
        40
      );
      this.cdr.markForCheck();
      return;
    }

    const frameIdx = this.cineMode === 'multi-file' ? this.currentFileIndex : this.cineFrameIndex;
    const pixels = getCineDisplayPixels(this.cineMode, frameIdx, parsed, this.seriesFiles);
    if (!pixels.length) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      this.cdr.markForCheck();
      return;
    }

    const scaled = new Float32Array(pixels.length);
    const slope = parsed.rescaleSlope;
    const intercept = parsed.rescaleIntercept;
    for (let i = 0; i < pixels.length; i++) {
      scaled[i] = pixels[i] * slope + intercept;
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
