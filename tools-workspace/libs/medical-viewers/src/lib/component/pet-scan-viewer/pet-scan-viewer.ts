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
  PET_SCAN_ACCEPT_ATTR,
  PET_SCAN_FORMATS_HINT,
  PET_SCAN_FORMATS_LABEL,
  PET_SCAN_RELATED_TOOLS,
  PET_SCAN_SUPPORTED_EXTENSIONS,
  PET_SCAN_WINDOW_PRESETS
} from '../../constants/pet-scan-viewer.constants';
import type {
  PetScanColormap,
  PetScanExportFormat,
  PetScanFusionPair,
  PetScanLoadedFile,
  PetScanPixelProbe
} from '../../types/pet-scan-viewer.types';
import {
  canvasToPngDataUrl,
  drawImageDataToCanvas,
  pixelsToImageData,
  computeZoomFit
} from '../../utils/medical-image-render.utils';
import {
  canExportPetScan,
  createPetScanFileRecord,
  createSamplePetScanFile,
  defaultWindowForPetScan,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  enrichPetScanFileRecord,
  exportPetScanMetadataJson,
  exportPetScanSummaryJson,
  filterValidPetScanFiles,
  formatPetScanFileSize,
  groupBySeries,
  petActivityValue,
  petUnitsLabel,
  probePetScanPixel,
  readPetScanFileBytes,
  resolvePetFusionPair,
  resolvePetScanSuggestion,
  sortSlices
} from '../../utils/pet-scan-viewer.utils';

import {
  applyMedicalFullscreenToggle,
  isDocumentFullscreen,
  listenFullscreenChange
} from '../../utils/medical-fullscreen.utils';

@Component({
  selector: 'lib-pet-scan-viewer',
  standalone: true,
  templateUrl: './pet-scan-viewer.html',
  styleUrls: ['./pet-scan-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PetScanViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private unlistenFullscreen: (() => void) | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = PET_SCAN_ACCEPT_ATTR;
  readonly relatedTools = PET_SCAN_RELATED_TOOLS;
  readonly supportedExtensions = PET_SCAN_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PET_SCAN_FORMATS_LABEL;
  readonly formatsHint = PET_SCAN_FORMATS_HINT;
  readonly windowPresets = PET_SCAN_WINDOW_PRESETS;

  petFiles: PetScanLoadedFile[] = [];
  currentFileIndex = -1;
  seriesGroups: ReturnType<typeof groupBySeries> = [];
  activeSeriesIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  windowCenter = 5;
  windowWidth = 10;
  invert = false;
  zoom = 1;
  activePresetId: string | null = null;
  colormap: PetScanColormap = 'hot';
  fuseEnabled = false;
  fuseOpacity = 60;
  probe: PetScanPixelProbe | null = null;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private panX = 0;
  private panY = 0;

  get currentFile(): PetScanLoadedFile | null {
    const files = this.seriesFiles;
    return this.currentFileIndex >= 0 ? files[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportPetScan(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get fusionPair(): PetScanFusionPair | null {
    return resolvePetFusionPair(this.seriesGroups);
  }

  get canFuse(): boolean {
    return this.fusionPair != null;
  }

  get primarySuggestion() {
    const suggestion = resolvePetScanSuggestion({
      hasFiles: this.petFiles.length > 0,
      hasError: !!this.errorMessage,
      compressed: !!this.currentFile?.parsed?.compressed,
      canFuse: this.canFuse
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get seriesFiles(): PetScanLoadedFile[] {
    return this.seriesGroups[this.activeSeriesIndex]?.files ?? this.petFiles;
  }

  get activeSeries() {
    return this.seriesGroups[this.activeSeriesIndex] ?? null;
  }

  get seriesDescription(): string {
    return this.parsed?.seriesDescription || this.activeSeries?.description || '';
  }

  get protocolName(): string {
    return this.parsed?.protocolName || this.activeSeries?.protocolName || '';
  }

  get sliceLabel(): string {
    const files = this.seriesFiles;
    if (files.length <= 1) {
      return this.currentFile?.parsed
        ? `${this.currentFile.parsed.rows}×${this.currentFile.parsed.columns}`
        : '';
    }
    return `Slice ${this.currentFileIndex + 1} / ${files.length}`;
  }

  get wlCenterMin(): number {
    const span = Math.max(Math.abs(this.windowWidth), 1) * 2;
    return this.windowCenter - span;
  }

  get wlCenterMax(): number {
    const span = Math.max(Math.abs(this.windowWidth), 1) * 2;
    return this.windowCenter + span;
  }

  get wlWidthMax(): number {
    return Math.max(1, Math.abs(this.windowWidth) * 4);
  }

  petUnitsLabel(): string {
    return petUnitsLabel(this.parsed);
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
        this.adjustWindowWidth(1);
      } else {
        this.zoomIn();
      }
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      if (event.shiftKey) {
        this.adjustWindowWidth(-1);
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
    } else if (event.key.toLowerCase() === 'c') {
      event.preventDefault();
      this.toggleColormap();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: PetScanLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatPetScanFileSize(bytes);
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
    const { accepted, rejected } = filterValidPetScanFiles(files);
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
      const loaded: PetScanLoadedFile[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readPetScanFileBytes(file);
          loaded.push(enrichPetScanFileRecord(createPetScanFileRecord(file, bytes)));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid PET DICOM';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = sortSlices([...this.petFiles, ...loaded]);
        const byId = new Map<string, PetScanLoadedFile>();
        for (const item of merged) {
          byId.set(item.id, item);
        }
        this.petFiles = sortSlices(Array.from(byId.values()));
        this.rebuildSeries(Math.max(0, this.petFiles.length - loaded.length));
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load PET DICOM';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSamplePetScanFile()]);
  }

  selectFile(index: number): void {
    const files = this.seriesFiles;
    if (index < 0 || index >= files.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.probe = null;
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
    const files = this.seriesFiles;
    if (index < 0 || index >= files.length) return;
    const targetId = files[index].id;
    const next = this.petFiles.filter((f) => f.id !== targetId);
    this.petFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.rebuildSeries(Math.min(index, Math.max(0, this.seriesFiles.length - 1)));
    if (!this.canFuse) {
      this.fuseEnabled = false;
    }
    this.syncWindowFromCurrent();
    this.renderCanvas();
  }

  clearAll(): void {
    this.petFiles = [];
    this.seriesGroups = [];
    this.activeSeriesIndex = 0;
    this.currentFileIndex = -1;
    this.errorMessage = '';
    this.probe = null;
    this.fuseEnabled = false;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  selectSeries(index: number): void {
    if (index < 0 || index >= this.seriesGroups.length || index === this.activeSeriesIndex) {
      return;
    }
    this.activeSeriesIndex = index;
    this.currentFileIndex = 0;
    this.probe = null;
    this.syncWindowFromCurrent();
    this.fitZoom();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onSeriesChange(event: Event): void {
    this.selectSeries(Number((event.target as HTMLSelectElement).value));
  }

  toggleFuse(): void {
    if (!this.canFuse) return;
    this.fuseEnabled = !this.fuseEnabled;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFuseToggle(event: Event): void {
    if (!this.canFuse) return;
    this.fuseEnabled = (event.target as HTMLInputElement).checked;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFuseOpacityChange(event: Event): void {
    this.fuseOpacity = Number((event.target as HTMLInputElement).value);
    if (this.fuseEnabled) {
      this.renderCanvas();
    }
  }

  toggleColormap(): void {
    this.colormap = this.colormap === 'hot' ? 'grayscale' : 'hot';
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { id: string; path: string }): void {
    if (suggestion.id === 'try-sample') {
      void this.loadSample();
    } else if (suggestion.id === 'upload' || suggestion.id === 'fuse-hint') {
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

  exportAs(format: PetScanExportFormat, event?: Event): void {
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
        downloadTextFile(exportPetScanMetadataJson(current), `${base}-metadata.json`, 'application/json');
        this.toast.success('Exported metadata JSON');
      } else if (format === 'summary-json') {
        downloadTextFile(exportPetScanSummaryJson(current), `${base}-summary.json`, 'application/json');
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
    this.windowWidth = Math.max(0.1, Number((event.target as HTMLInputElement).value));
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

    const hit = probePetScanPixel(parsed, x, y);
    if (!hit) {
      this.probe = null;
    } else {
      const suv =
        parsed.modality === 'PT' ? petActivityValue(parsed, hit.raw) : null;
      this.probe = { x, y, raw: hit.raw, hu: hit.hu, suv };
    }
    this.cdr.markForCheck();
  }

  onCanvasWheel(event: WheelEvent): void {
    if (this.seriesFiles.length <= 1) return;
    event.preventDefault();
    const delta = event.deltaY === 0 ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    const step = delta > 0 ? 1 : -1;
    this.selectFile(this.currentFileIndex + step);
  }

  private rebuildSeries(preferredFileIndex = 0): void {
    this.seriesGroups = groupBySeries(this.petFiles);
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

  private getFusionFiles(pair: PetScanFusionPair): {
    anatomy: PetScanLoadedFile | null;
    pt: PetScanLoadedFile | null;
  } {
    const anatomyFiles = this.seriesGroups[pair.anatomySeriesIndex]?.files ?? [];
    const ptFiles = this.seriesGroups[pair.ptSeriesIndex]?.files ?? [];
    const idx = Math.max(0, this.currentFileIndex);
    return {
      anatomy: anatomyFiles[Math.min(idx, anatomyFiles.length - 1)] ?? null,
      pt: ptFiles[Math.min(idx, ptFiles.length - 1)] ?? null
    };
  }

  private canvasToImagePoint(
    event: MouseEvent,
    canvas: HTMLCanvasElement,
    columns: number,
    rows: number
  ): { x: number; y: number } | null {
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
    this.windowWidth = Math.max(0.1, this.windowWidth + delta);
    this.activePresetId = null;
    this.renderCanvas();
  }

  private syncWindowFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed) return;
    const win = defaultWindowForPetScan(parsed);
    this.windowCenter = win.center;
    this.windowWidth = Math.max(0.1, win.width);
    this.activePresetId = null;
    this.invert = parsed.photometricInterpretation === 'MONOCHROME1';
  }

  private scalePixels(parsed: NonNullable<PetScanLoadedFile['parsed']>): Float32Array {
    const scaled = new Float32Array(parsed.pixels.length);
    for (let i = 0; i < parsed.pixels.length; i++) {
      scaled[i] = parsed.pixels[i] * parsed.rescaleSlope + parsed.rescaleIntercept;
    }
    return scaled;
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

    const pair = this.fuseEnabled ? this.fusionPair : null;
    if (pair) {
      this.renderFusedCanvas(canvas, pair);
      this.cdr.markForCheck();
      return;
    }

    if (!parsed || current?.softFail || !parsed.pixels.length) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(
        current?.softFail
          ? 'Compressed or unsupported pixel data — metadata only'
          : 'Load a PET DICOM to preview',
        24,
        40
      );
      this.cdr.markForCheck();
      return;
    }

    const scaled = this.scalePixels(parsed);
    const imageData = pixelsToImageData(scaled, parsed.columns, parsed.rows, {
      center: this.windowCenter,
      width: this.windowWidth,
      invert: this.invert,
      colormap: this.colormap
    });
    drawImageDataToCanvas(canvas, imageData, {
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      background: '#0f172a'
    });
    this.cdr.markForCheck();
  }

  private renderFusedCanvas(canvas: HTMLCanvasElement, pair: PetScanFusionPair): void {
    const { anatomy, pt } = this.getFusionFiles(pair);
    const anatomyParsed = anatomy?.parsed;
    const ptParsed = pt?.parsed;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    if (
      !anatomyParsed ||
      !ptParsed ||
      anatomy?.softFail ||
      pt?.softFail ||
      !anatomyParsed.pixels.length ||
      !ptParsed.pixels.length
    ) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Fusion pair unavailable — check PT + CT series', 24, 40);
      return;
    }

    const anatomyWin = defaultWindowForPetScan(anatomyParsed);
    const anatomyScaled = this.scalePixels(anatomyParsed);
    const anatomyImage = pixelsToImageData(anatomyScaled, anatomyParsed.columns, anatomyParsed.rows, {
      center: anatomyWin.center,
      width: anatomyWin.width,
      invert: anatomyParsed.photometricInterpretation === 'MONOCHROME1',
      colormap: 'grayscale'
    });
    drawImageDataToCanvas(canvas, anatomyImage, {
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      background: '#0f172a'
    });

    const ptScaled = this.scalePixels(ptParsed);
    const ptImage = pixelsToImageData(ptScaled, ptParsed.columns, ptParsed.rows, {
      center: this.windowCenter,
      width: this.windowWidth,
      invert: this.invert,
      colormap: 'hot'
    });
    this.drawOverlayOnCanvas(canvas, ptImage, this.fuseOpacity / 100);
  }

  private drawOverlayOnCanvas(
    canvas: HTMLCanvasElement,
    imageData: ImageData,
    opacity: number
  ): void {
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx || typeof document === 'undefined') return;

    const zoom = Math.max(0.05, this.zoom);
    const drawW = imageData.width * zoom;
    const drawH = imageData.height * zoom;
    const ox = (canvas.width - drawW) / 2 + this.panX;
    const oy = (canvas.height - drawH) / 2 + this.panY;

    const off = document.createElement('canvas');
    off.width = imageData.width;
    off.height = imageData.height;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    offCtx.putImageData(imageData, 0, 0);

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.imageSmoothingEnabled = zoom < 1;
    ctx.drawImage(off, ox, oy, drawW, drawH);
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
