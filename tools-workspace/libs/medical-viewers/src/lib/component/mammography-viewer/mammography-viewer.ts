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
  MAMMOGRAPHY_ACCEPT_ATTR,
  MAMMOGRAPHY_FORMATS_HINT,
  MAMMOGRAPHY_FORMATS_LABEL,
  MAMMOGRAPHY_HANGING_SLOTS,
  MAMMOGRAPHY_RELATED_TOOLS,
  MAMMOGRAPHY_SUPPORTED_EXTENSIONS,
  MAMMOGRAPHY_WINDOW_PRESETS
} from '../../constants/mammography-viewer.constants';
import type {
  MammographyExportFormat,
  MammographyHangingCell,
  MammographyLoadedFile,
  MammographyPixelProbe,
  MammographyViewMode
} from '../../types/mammography-viewer.types';
import {
  canvasToPngDataUrl,
  drawImageDataToCanvas,
  pixelsToImageData,
  computeZoomFit,
  rotatePixels90Clockwise
} from '../../utils/medical-image-render.utils';
import {
  buildMammographyHanging,
  canExportMammography,
  createSampleMammographyFile,
  createMammographyFileRecord,
  defaultWindowForMammography,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  enrichMammographyFileRecord,
  exportMammographyMetadataJson,
  exportMammographySummaryJson,
  filterValidMammographyFiles,
  formatMammographyFileSize,
  hangingAssignedCount,
  probeMammographyPixel,
  readMammographyFileBytes,
  resolveMammographySuggestion,
  sortDicomSeries
} from '../../utils/mammography-viewer.utils';

import {
  applyMedicalFullscreenToggle,
  isDocumentFullscreen,
  listenFullscreenChange
} from '../../utils/medical-fullscreen.utils';

@Component({
  selector: 'lib-mammography-viewer',
  standalone: true,
  templateUrl: './mammography-viewer.html',
  styleUrls: ['./mammography-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MammographyViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private unlistenFullscreen: (() => void) | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = MAMMOGRAPHY_ACCEPT_ATTR;
  readonly relatedTools = MAMMOGRAPHY_RELATED_TOOLS;
  readonly supportedExtensions = MAMMOGRAPHY_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = MAMMOGRAPHY_FORMATS_LABEL;
  readonly formatsHint = MAMMOGRAPHY_FORMATS_HINT;
  readonly windowPresets = MAMMOGRAPHY_WINDOW_PRESETS;
  readonly hangingSlots = MAMMOGRAPHY_HANGING_SLOTS;

  mgFiles: MammographyLoadedFile[] = [];
  currentFileIndex = -1;
  viewMode: MammographyViewMode = 'single';
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  windowCenter = 2048;
  windowWidth = 4096;
  invert = false;
  zoom = 1;
  activePresetId: string | null = null;
  probe: MammographyPixelProbe | null = null;
  probeSlot: string | null = null;

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

  get currentFile(): MammographyLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.mgFiles[this.currentFileIndex] ?? null : null;
  }

  get hangingCells(): MammographyHangingCell[] {
    return buildMammographyHanging(this.mgFiles);
  }

  get assignedHangingCount(): number {
    return hangingAssignedCount(this.hangingCells);
  }

  get canExport(): boolean {
    return canExportMammography(this.currentFile);
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
    const suggestion = resolveMammographySuggestion({
      hasFiles: this.mgFiles.length > 0,
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
    const files = this.mgFiles;
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
    if (!this.currentFile && this.mgFiles.length === 0) return;
    if (this.isTypingTarget(event.target)) return;

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
      if (this.viewMode === 'single' && this.mgFiles.length > 1) {
        event.preventDefault();
        this.selectFile(this.currentFileIndex - 1);
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      if (this.viewMode === 'single' && this.mgFiles.length > 1) {
        event.preventDefault();
        this.selectFile(this.currentFileIndex + 1);
      }
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key.toLowerCase() === 'h') {
      event.preventDefault();
      this.setViewMode(this.viewMode === 'hanging' ? 'single' : 'hanging');
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: MammographyLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackBySlot(_index: number, cell: MammographyHangingCell): string {
    return cell.slot;
  }

  formatSize(bytes: number): string {
    return formatMammographyFileSize(bytes);
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
    const { accepted, rejected } = filterValidMammographyFiles(files);
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
      const loaded: MammographyLoadedFile[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readMammographyFileBytes(file);
          loaded.push(enrichMammographyFileRecord(createMammographyFileRecord(file, bytes)));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid mammography DICOM';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = sortDicomSeries([...this.mgFiles, ...loaded]);
        const byId = new Map<string, MammographyLoadedFile>();
        for (const item of merged) {
          byId.set(item.id, item);
        }
        this.mgFiles = sortDicomSeries(Array.from(byId.values()));
        this.currentFileIndex = Math.min(
          Math.max(0, this.mgFiles.length - loaded.length),
          this.mgFiles.length - 1
        );
        if (this.mgFiles.length >= 2 && this.viewMode === 'single' && this.assignedHangingCount > 0) {
          this.viewMode = 'hanging';
        }
        this.syncWindowFromCurrent();
        this.fitZoom();
        this.renderCanvas();
        const current = this.currentFile;
        if (current) {
          this.toast.success(`Loaded ${loaded.length} file(s)`);
          const warnCount = loaded.reduce((n, f) => n + f.warnings.length, 0);
          if (warnCount) {
            this.toast.info(`${warnCount} modality note(s) — MG preferred`);
          }
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load mammography DICOM';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleMammographyFile()]);
  }

  setViewMode(mode: MammographyViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.probe = null;
    this.probeSlot = null;
    this.probeSlot = null;
    this.fitZoom();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.mgFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.probe = null;
    this.probeSlot = null;
    this.syncWindowFromCurrent();
    if (this.viewMode === 'single') {
      this.fitZoom();
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFileSlider(event: Event): void {
    const index = Number((event.target as HTMLInputElement).value);
    this.selectFile(index);
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.mgFiles.length) return;
    const next = this.mgFiles.filter((_, i) => i !== index);
    this.mgFiles = next;
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
    this.mgFiles = [];
    this.currentFileIndex = -1;
    this.errorMessage = '';
    this.probe = null;
    this.probeSlot = null;
    this.viewMode = 'single';
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

  exportAs(format: MammographyExportFormat, event?: Event): void {
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
        downloadTextFile(exportMammographyMetadataJson(current), `${base}-metadata.json`, 'application/json');
        this.toast.success('Exported metadata JSON');
      } else if (format === 'summary-json') {
        downloadTextFile(exportMammographySummaryJson(current), `${base}-summary.json`, 'application/json');
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
    if (!canvas) {
      this.zoom = 1;
      this.fitZoomLevel = 1;
      return;
    }

    const rect = canvas.parentElement?.getBoundingClientRect();
    const vw = Math.max(320, Math.floor(rect?.width ?? 800));
    const vh = Math.max(240, Math.floor(rect?.height ?? 560));

    if (this.viewMode === 'hanging') {
      const cells = this.hangingCells;
      const cellW = vw / 2;
      const cellH = vh / 2;
      let minFit = Infinity;
      let hasImage = false;
      for (const cell of cells) {
        const parsed = cell.file?.parsed;
        if (!parsed || cell.file?.softFail || !parsed.pixels.length) continue;
        hasImage = true;
        const fit = computeZoomFit(cellW - 20, cellH - 28, parsed.columns, parsed.rows, 8);
        minFit = Math.min(minFit, fit);
      }
      this.zoom = hasImage && Number.isFinite(minFit) ? minFit : 1;
      this.fitZoomLevel = this.zoom;
    } else {
      const parsed = this.parsed;
      if (!parsed) {
        this.zoom = 1;
        this.fitZoomLevel = 1;
        return;
      }
      this.zoom = computeZoomFit(vw, vh, parsed.columns, parsed.rows);
      this.fitZoomLevel = this.zoom;
    }

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

  rotate90(): void {
    if (this.viewMode === 'hanging') return;
    const current = this.currentFile;
    const parsed = current?.parsed;
    if (!current || !parsed || current.softFail || parsed.compressed || !parsed.pixels.length) {
      return;
    }
    const rotated = rotatePixels90Clockwise(parsed.pixels, parsed.columns, parsed.rows);
    const updated: MammographyLoadedFile = {
      ...current,
      parsed: {
        ...parsed,
        pixels: rotated.pixels,
        columns: rotated.width,
        rows: rotated.height
      }
    };
    this.mgFiles = this.mgFiles.map((f) => (f.id === current.id ? updated : f));
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
    if (!this.canPan) return;
    if (this.viewMode === 'single' && !this.currentFile) return;
    if (this.viewMode === 'hanging' && this.mgFiles.length === 0) return;
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
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;

    if (this.viewMode === 'single') {
      this.probeSingleClick(event, canvas);
    } else {
      this.probeHangingClick(event, canvas);
    }
    this.cdr.markForCheck();
  }

  private probeSingleClick(event: MouseEvent, canvas: HTMLCanvasElement): void {
    const parsed = this.parsed;
    if (!parsed || parsed.compressed) return;

    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const drawW = parsed.columns * this.zoom;
    const drawH = parsed.rows * this.zoom;
    const ox = (canvas.width - drawW) / 2 + this.panX;
    const oy = (canvas.height - drawH) / 2 + this.panY;
    const x = Math.floor((mx - ox) / this.zoom);
    const y = Math.floor((my - oy) / this.zoom);
    const hit = probeMammographyPixel(parsed, x, y);
    if (!hit) {
      this.probe = null;
      this.probeSlot = null;
    } else {
      this.probe = { x, y, raw: hit.raw, hu: hit.hu };
      this.probeSlot = null;
    }
  }

  private probeHangingClick(event: MouseEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = mx * scaleX;
    const cy = my * scaleY;

    const width = canvas.width;
    const height = canvas.height;
    const gridW = width;
    const gridH = height;
    const originX = (width - gridW) / 2 + this.panX;
    const originY = (height - gridH) / 2 + this.panY;
    const cellW = gridW / 2;
    const cellH = gridH / 2;

    const col = Math.floor((cx - originX) / cellW);
    const row = Math.floor((cy - originY) / cellH);
    if (col < 0 || col > 1 || row < 0 || row > 1) {
      this.probe = null;
      this.probeSlot = null;
      return;
    }

    const cellIndex = row * 2 + col;
    const cell = this.hangingCells[cellIndex];
    const file = cell?.file;
    const parsed = file?.parsed;
    if (!parsed || file?.softFail || parsed.compressed) {
      this.probe = null;
      this.probeSlot = null;
      return;
    }

    const innerPad = 10;
    const labelH = 18;
    const innerW = cellW - innerPad * 2;
    const innerH = cellH - innerPad * 2 - labelH;
    const cellZoom = this.zoom;
    const drawW = parsed.columns * cellZoom;
    const drawH = parsed.rows * cellZoom;
    const cellOx = originX + col * cellW + innerPad + (innerW - drawW) / 2;
    const cellOy = originY + row * cellH + innerPad + labelH + (innerH - drawH) / 2;
    const x = Math.floor((cx - cellOx) / cellZoom);
    const y = Math.floor((cy - cellOy) / cellZoom);
    const hit = probeMammographyPixel(parsed, x, y);
    if (!hit) {
      this.probe = null;
      this.probeSlot = null;
    } else {
      this.probe = { x, y, raw: hit.raw, hu: hit.hu };
      this.probeSlot = cell.slot;
    }
  }

  private adjustWindowWidth(delta: number): void {
    this.windowWidth = Math.max(1, this.windowWidth + delta);
    this.activePresetId = null;
    this.renderCanvas();
  }

  private syncWindowFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed) return;
    const win = defaultWindowForMammography(parsed);
    this.windowCenter = win.center;
    this.windowWidth = Math.max(1, win.width);
    this.activePresetId = null;
    this.invert = parsed.photometricInterpretation === 'MONOCHROME1';
  }

  private renderCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
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

    if (this.viewMode === 'hanging') {
      this.renderHangingCanvas(ctx, canvas, width, height);
    } else {
      this.renderSingleCanvas(ctx, canvas, width, height);
    }
    this.cdr.markForCheck();
  }

  private renderSingleCanvas(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): void {
    const current = this.currentFile;
    const parsed = current?.parsed;

    if (!parsed || current?.softFail || !parsed.pixels.length) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(
        current?.softFail
          ? 'Compressed or unsupported pixel data — metadata only'
          : 'Load mammography DICOM to preview',
        24,
        40
      );
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
  }

  private renderHangingCanvas(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): void {
    const cells = this.hangingCells;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    if (this.mgFiles.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Load mammography DICOM files for hanging layout', 24, 40);
      return;
    }

    const gridW = width;
    const gridH = height;
    const originX = (width - gridW) / 2 + this.panX;
    const originY = (height - gridH) / 2 + this.panY;
    const cellW = gridW / 2;
    const cellH = gridH / 2;
    const innerPad = 10;
    const labelH = 18;
    const gap = 2;

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = originX + col * cellW + gap;
      const cy = originY + row * cellH + gap;
      const cw = cellW - gap * 2;
      const ch = cellH - gap * 2;

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, cy, cw, ch);

      ctx.fillStyle = '#be185d';
      ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(cell.slot, cx + 8, cy + 14);

      const file = cell.file;
      const parsed = file?.parsed;
      const innerW = cw - innerPad * 2;
      const innerH = ch - innerPad * 2 - labelH;

      if (!file) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText('Empty slot', cx + cw / 2 - 28, cy + ch / 2);
        continue;
      }

      if (!parsed || file.softFail || !parsed.pixels.length) {
        ctx.fillStyle = '#64748b';
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(file.name, cx + 8, cy + 30);
        ctx.fillText('No decodable pixels', cx + 8, cy + ch / 2);
        continue;
      }

      const scaled = new Float32Array(parsed.pixels.length);
      for (let j = 0; j < parsed.pixels.length; j++) {
        scaled[j] = parsed.pixels[j] * parsed.rescaleSlope + parsed.rescaleIntercept;
      }
      const imageData = pixelsToImageData(scaled, parsed.columns, parsed.rows, {
        center: this.windowCenter,
        width: this.windowWidth,
        invert: this.invert,
        colormap: 'grayscale'
      });

      const drawW = parsed.columns * this.zoom;
      const drawH = parsed.rows * this.zoom;
      const ix = cx + innerPad + Math.max(0, (innerW - drawW) / 2);
      const iy = cy + innerPad + labelH + Math.max(0, (innerH - drawH) / 2);

      const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      if (!off) continue;
      off.width = imageData.width;
      off.height = imageData.height;
      const offCtx = off.getContext('2d');
      if (!offCtx) continue;
      offCtx.putImageData(imageData, 0, 0);

      ctx.imageSmoothingEnabled = this.zoom < 1;
      ctx.drawImage(off, ix, iy, drawW, drawH);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      const shortName = file.name.length > 18 ? `${file.name.slice(0, 15)}…` : file.name;
      ctx.fillText(shortName, cx + 8, cy + ch - 6);
    }
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
