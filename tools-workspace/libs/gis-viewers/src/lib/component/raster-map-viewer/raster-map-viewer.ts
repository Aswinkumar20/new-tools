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
import type { ImageOverlay, Map as LeafletMap, TileLayer } from 'leaflet';
import {
  RASTER_MAP_ACCEPT_ATTR,
  RASTER_MAP_COLORMAPS,
  RASTER_MAP_FORMATS_HINT,
  RASTER_MAP_FORMATS_LABEL,
  RASTER_MAP_RELATED_TOOLS,
  RASTER_MAP_SUPPORTED_EXTENSIONS
} from '../../constants/raster-map-viewer.constants';
import type {
  RasterMapColormap,
  RasterMapExportFormat,
  RasterMapLoadedFile,
  RasterMapMetadataRow,
  RasterMapStretchMode
} from '../../types/raster-map-viewer.types';
import {
  bandOptions,
  canExportRasterMap,
  configureLeafletDefaultIcons,
  createOrUpdateImageOverlay,
  createRasterMapFileRecord,
  createSampleRasterMapFile,
  downloadBinaryFile,
  downloadTextFile,
  ensureRasterMapStylesheet,
  exportMetadataJson,
  exportSummaryJson,
  filterValidRasterMapFiles,
  fitMapToRaster,
  formatBounds,
  formatRasterMapFileSize,
  getRasterMapFileExtension,
  loadLeaflet,
  metadataRows,
  openAndParseRaster,
  rasterLegendGradientCss,
  readRasterMapFileBytes,
  reRenderRasterPreview,
  resolveRasterMapSuggestion
} from '../../utils/raster-map-viewer.utils';

@Component({
  selector: 'lib-raster-map-viewer',
  standalone: true,
  templateUrl: './raster-map-viewer.html',
  styleUrls: ['./raster-map-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RasterMapViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = RASTER_MAP_ACCEPT_ATTR;
  readonly relatedTools = RASTER_MAP_RELATED_TOOLS;
  readonly supportedExtensions = RASTER_MAP_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = RASTER_MAP_FORMATS_LABEL;
  readonly formatsHint = RASTER_MAP_FORMATS_HINT;
  readonly colormaps = RASTER_MAP_COLORMAPS;
  readonly stretchModes: RasterMapStretchMode[] = ['none', 'minmax', 'percentile'];

  rasterFiles: RasterMapLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  libraryReady = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  zoomPercent = 100;
  metaRows: RasterMapMetadataRow[] = [];

  colormap: RasterMapColormap = 'viridis';
  stretch: RasterMapStretchMode = 'minmax';
  bandIndex = 0;
  rgbMode = false;
  opacity = 0.9;

  private map: LeafletMap | null = null;
  private baseLayer: TileLayer | null = null;
  private imageOverlay: ImageOverlay | null = null;
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private renderToken = 0;
  private leafletMod: typeof import('leaflet') | null = null;

  get currentFile(): RasterMapLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.rasterFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportRasterMap(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get stats() {
    return this.currentFile?.stats ?? null;
  }

  get bandChoices(): number[] {
    return bandOptions(this.currentFile?.stats.samplesPerPixel ?? 1);
  }

  get canRgb(): boolean {
    return (this.currentFile?.stats.samplesPerPixel ?? 0) >= 3;
  }

  get legendCss(): string {
    return rasterLegendGradientCss(this.colormap);
  }

  get showLegend(): boolean {
    return !this.rgbMode || (this.currentFile?.stats.displayMode === 'colormap');
  }

  get primarySuggestion() {
    const suggestion = resolveRasterMapSuggestion({
      hasFiles: this.rasterFiles.length > 0,
      hasError: !!this.errorMessage,
      hasBounds: !!this.stats?.bounds
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get boundsLabel(): string {
    return formatBounds(this.stats?.bounds ?? null);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    ensureRasterMapStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
    this.observeMapResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.destroyMap();
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
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) await this.handleFiles(Array.from(files));
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentFile || this.isTypingTarget(event.target)) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitViewport();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: RasterMapLoadedFile): string {
    return file.id;
  }

  trackByMetaKey(_index: number, row: RasterMapMetadataRow): string {
    return row.key;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatRasterMapFileSize(bytes);
  }

  formatVal(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '—';
    return n.toFixed(2);
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
    const { accepted, rejected } = filterValidRasterMapFiles(files);
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (accepted.length === 0) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      for (const file of accepted) {
        const bytes = await readRasterMapFileBytes(file);
        try {
          const parsed = await openAndParseRaster(file, bytes, {
            colormap: this.colormap,
            stretch: this.stretch,
            bandIndex: this.bandIndex,
            opacity: this.opacity,
            rgbMode: this.rgbMode && getRasterMapFileExtension(file.name) !== '.asc'
          });
          this.bandIndex = parsed.options.bandIndex;
          this.rgbMode = parsed.options.rgbMode;
          this.colormap = parsed.options.colormap;
          this.stretch = parsed.options.stretch;
          const record = createRasterMapFileRecord(
            file,
            bytes,
            parsed.sourceKind,
            parsed.metadata,
            parsed.stats,
            parsed.warnings,
            parsed.preview,
            parsed.valueGrid,
            parsed.ascText
          );
          const existing = this.rasterFiles.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.rasterFiles[existing] = record;
            this.currentFileIndex = existing;
          } else {
            this.rasterFiles = [...this.rasterFiles, record];
            this.currentFileIndex = this.rasterFiles.length - 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid raster';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }
      await this.renderCurrentFile();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.warnings.length) {
          this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load raster';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleRasterMapFile()]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.rasterFiles.length || index === this.currentFileIndex) return;
    this.currentFileIndex = index;
    this.loading = true;
    this.cdr.markForCheck();
    try {
      await this.renderCurrentFile();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.rasterFiles.length) return;
    const next = this.rasterFiles.filter((_, i) => i !== index);
    this.rasterFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.rasterFiles = [];
    this.currentFileIndex = -1;
    this.metaRows = [];
    this.errorMessage = '';
    this.zoomPercent = 100;
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: RasterMapExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) return;
    const base = current.name.replace(/\.(tif|tiff|geotiff|asc)$/i, '') || 'raster-map';
    try {
      if (format === 'original') {
        if (current.sourceKind === 'asc' && current.ascText) {
          downloadTextFile(current.ascText, `${base}.asc`, 'text/plain');
        } else {
          const mime = current.sourceKind === 'asc' ? 'text/plain' : 'image/tiff';
          const ext = current.sourceKind === 'asc' ? 'asc' : 'tif';
          downloadBinaryFile(current.bytes, `${base}.${ext}`, mime);
        }
      } else if (format === 'metadata-json') {
        downloadTextFile(exportMetadataJson(current), `${base}-metadata.json`, 'application/json');
      } else if (format === 'summary-json') {
        downloadTextFile(exportSummaryJson(current), `${base}-summary.json`, 'application/json');
      } else if (format === 'png') {
        if (!current.previewDataUrl) {
          this.toast.error('No PNG preview available');
          return;
        }
        const anchor = document.createElement('a');
        anchor.href = current.previewDataUrl;
        anchor.download = `${base}-preview.png`;
        anchor.click();
      }
      this.toast.success('Export ready');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  async onColormapChange(event: Event): Promise<void> {
    this.colormap = (event.target as HTMLSelectElement).value as RasterMapColormap;
    await this.reRender();
  }

  async onStretchChange(event: Event): Promise<void> {
    this.stretch = (event.target as HTMLSelectElement).value as RasterMapStretchMode;
    await this.reRender();
  }

  async onBandChange(event: Event): Promise<void> {
    this.bandIndex = Number((event.target as HTMLSelectElement).value);
    this.rgbMode = false;
    await this.reRender();
  }

  async onRgbModeChange(event: Event): Promise<void> {
    this.rgbMode = (event.target as HTMLInputElement).checked;
    await this.reRender();
  }

  onOpacityChange(event: Event): void {
    this.opacity = Math.max(0.1, Math.min(1, Number((event.target as HTMLInputElement).value) / 100));
    this.imageOverlay?.setOpacity(this.opacity);
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    queueMicrotask(() => this.map?.invalidateSize());
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.cdr.markForCheck();
    queueMicrotask(() => this.map?.invalidateSize());
  }

  zoomIn(): void {
    this.map?.zoomIn();
    this.syncZoomPercent();
  }

  zoomOut(): void {
    this.map?.zoomOut();
    this.syncZoomPercent();
  }

  fitViewport(): void {
    if (!this.map || !this.leafletMod || !this.stats) return;
    fitMapToRaster(this.map, this.leafletMod, this.stats);
    this.syncZoomPercent();
  }

  private syncZoomPercent(): void {
    if (!this.map) return;
    this.zoomPercent = Math.round((this.map.getZoom() / 18) * 100);
    this.cdr.markForCheck();
  }

  private async reRender(): Promise<void> {
    const current = this.currentFile;
    if (!current) return;
    const token = ++this.renderToken;
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const preview = await reRenderRasterPreview(current, {
        colormap: this.colormap,
        stretch: this.stretch,
        bandIndex: this.bandIndex,
        opacity: this.opacity,
        rgbMode: this.rgbMode,
        red: 0,
        green: 1,
        blue: 2
      });
      if (token !== this.renderToken) return;
      current.previewDataUrl = preview.dataUrl;
      current.previewWidth = preview.width;
      current.previewHeight = preview.height;
      current.valueGrid = preview.valueGrid;
      current.gridWidth = preview.width;
      current.gridHeight = preview.height;
      current.stats = preview.stats;
      await this.renderCurrentFile(false);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Re-render failed');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async ensureMap(): Promise<typeof import('leaflet')> {
    if (!this.leafletMod) {
      this.leafletMod = await loadLeaflet();
      configureLeafletDefaultIcons(this.leafletMod, this.assetService.getAssetPath('leaflet'));
      this.libraryReady = true;
    }
    if (!this.map && this.mapHost?.nativeElement) {
      const L = this.leafletMod;
      this.map = L.map(this.mapHost.nativeElement, {
        zoomControl: false,
        attributionControl: true
      }).setView([20, 0], 2);
      this.baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(this.map);
      this.map.on('zoomend', () => this.syncZoomPercent());
    }
    return this.leafletMod;
  }

  private async renderCurrentFile(fit = true): Promise<void> {
    const current = this.currentFile;
    if (!current || !this.isBrowser) return;
    const L = await this.ensureMap();
    if (!this.map || !current.previewDataUrl) return;
    this.metaRows = metadataRows(current);
    this.imageOverlay = createOrUpdateImageOverlay(
      L,
      this.map,
      current.previewDataUrl,
      current.stats,
      this.opacity,
      this.imageOverlay
    );
    if (fit) fitMapToRaster(this.map, L, current.stats);
    this.syncZoomPercent();
    this.cdr.markForCheck();
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.baseLayer = null;
    this.imageOverlay = null;
  }

  private observeMapResize(): void {
    if (typeof ResizeObserver === 'undefined' || !this.mapHost?.nativeElement) return;
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapHost.nativeElement);
  }

  private isFileDrag(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }
}
