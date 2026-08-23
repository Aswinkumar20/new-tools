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
  DEM_ACCEPT_ATTR,
  DEM_FORMATS_HINT,
  DEM_FORMATS_LABEL,
  DEM_RELATED_TOOLS,
  DEM_SUPPORTED_EXTENSIONS
} from '../../constants/dem-viewer.constants';
import type {
  DemColormap,
  DemDisplayMode,
  DemExportFormat,
  DemLoadedFile,
  DemMetadataRow,
  DemSampleResult
} from '../../types/dem-viewer.types';
import {
  bandOptions,
  canExportDem,
  configureLeafletDefaultIcons,
  createDemFileRecord,
  createOrUpdateImageOverlay,
  createSampleDemFile,
  downloadBinaryFile,
  downloadTextFile,
  ensureDemStylesheet,
  exportMetadataJson,
  exportSummaryJson,
  filterValidDemFiles,
  fitMapToDem,
  formatBounds,
  formatDemFileSize,
  legendGradientCss,
  loadLeaflet,
  metadataRows,
  openAndParseDem,
  readDemFileBytes,
  reRenderDemPreview,
  resolveDemSuggestion,
  sampleElevationAtLatLng
} from '../../utils/dem-viewer.utils';

@Component({
  selector: 'lib-dem-viewer',
  standalone: true,
  templateUrl: './dem-viewer.html',
  styleUrls: ['./dem-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = DEM_ACCEPT_ATTR;
  readonly relatedTools = DEM_RELATED_TOOLS;
  readonly supportedExtensions = DEM_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = DEM_FORMATS_LABEL;
  readonly formatsHint = DEM_FORMATS_HINT;
  readonly colormaps: DemColormap[] = ['grayscale', 'terrain', 'viridis', 'hypsometric'];
  readonly displayModes: DemDisplayMode[] = ['elevation', 'hillshade', 'shaded-relief'];

  demFiles: DemLoadedFile[] = [];
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
  metaRows: DemMetadataRow[] = [];
  sampledElevation: DemSampleResult | null = null;

  colormap: DemColormap = 'terrain';
  displayMode: DemDisplayMode = 'shaded-relief';
  bandIndex = 0;
  hillshadeAzimuth = 315;
  hillshadeAltitude = 45;
  opacity = 0.9;

  private map: LeafletMap | null = null;
  private baseLayer: TileLayer | null = null;
  private imageOverlay: ImageOverlay | null = null;
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private renderToken = 0;
  private mapClickHandler: ((e: { latlng: { lat: number; lng: number } }) => void) | null = null;

  get currentFile(): DemLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.demFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportDem(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get stats() {
    return this.currentFile?.stats ?? null;
  }

  get bandChoices(): number[] {
    return bandOptions(this.currentFile?.metadata.samplesPerPixel ?? 1);
  }

  get legendCss(): string {
    return legendGradientCss(this.colormap);
  }

  get primarySuggestion() {
    const suggestion = resolveDemSuggestion({
      hasFiles: this.demFiles.length > 0,
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
    if (!this.isBrowser) {
      return;
    }
    ensureDemStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
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
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
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
    if (files?.length) {
      await this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentFile || this.isTypingTarget(event.target)) {
      return;
    }
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

  trackByFileId(_index: number, file: DemLoadedFile): string {
    return file.id;
  }

  trackByMetaKey(_index: number, row: DemMetadataRow): string {
    return row.key;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatDemFileSize(bytes);
  }

  formatElev(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) {
      return '—';
    }
    return n.toFixed(2);
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }
    await this.handleFiles(Array.from(input.files));
    input.value = '';
  }

  async handleFiles(files: File[]): Promise<void> {
    const { accepted, rejected } = filterValidDemFiles(files);
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
        const bytes = await readDemFileBytes(file);
        let parsed;
        try {
          parsed = await openAndParseDem(bytes, file.name, {
            colormap: this.colormap,
            displayMode: this.displayMode,
            bandIndex: this.bandIndex,
            hillshadeAzimuth: this.hillshadeAzimuth,
            hillshadeAltitude: this.hillshadeAltitude,
            opacity: this.opacity
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid DEM GeoTIFF';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
          continue;
        }
        this.bandIndex = parsed.options.bandIndex;
        const record = createDemFileRecord(
          file,
          bytes,
          parsed.metadata,
          parsed.stats,
          parsed.warnings,
          parsed.preview,
          parsed.elevationGrid
        );
        const existing = this.demFiles.findIndex((item) => item.id === record.id);
        if (existing >= 0) {
          this.demFiles[existing] = record;
          this.currentFileIndex = existing;
        } else {
          this.demFiles = [...this.demFiles, record];
          this.currentFileIndex = this.demFiles.length - 1;
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load DEM file';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    const sample = createSampleDemFile();
    await this.handleFiles([sample]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.demFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.sampledElevation = null;
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
    if (index < 0 || index >= this.demFiles.length) {
      return;
    }
    const next = this.demFiles.filter((_, i) => i !== index);
    this.demFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.demFiles = [];
    this.currentFileIndex = -1;
    this.metaRows = [];
    this.errorMessage = '';
    this.zoomPercent = 100;
    this.sampledElevation = null;
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.map?.invalidateSize();
      this.fitViewport();
    }, 220);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: DemExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      return;
    }
    const base = current.name.replace(/\.(tif|tiff|geotiff)$/i, '') || 'dem';
    if (format === 'geotiff') {
      downloadBinaryFile(current.bytes, `${base}.tif`, 'image/tiff');
      this.toast.success('Exported GeoTIFF');
    } else if (format === 'metadata-json') {
      downloadTextFile(exportMetadataJson(current), `${base}-metadata.json`, 'application/json');
      this.toast.success('Exported metadata JSON');
    } else if (format === 'summary-json') {
      downloadTextFile(exportSummaryJson(current), `${base}-summary.json`, 'application/json');
      this.toast.success('Exported summary JSON');
    } else if (format === 'png' && current.previewDataUrl) {
      const anchor = document.createElement('a');
      anchor.href = current.previewDataUrl;
      anchor.download = `${base}-preview.png`;
      anchor.click();
      this.toast.success('Exported PNG preview');
    }
    this.cdr.markForCheck();
  }

  onColormapChange(event: Event): void {
    this.colormap = (event.target as HTMLSelectElement).value as DemColormap;
    void this.refreshOverlay();
  }

  onDisplayModeChange(event: Event): void {
    this.displayMode = (event.target as HTMLSelectElement).value as DemDisplayMode;
    void this.refreshOverlay();
  }

  onBandChange(event: Event): void {
    this.bandIndex = Number((event.target as HTMLSelectElement).value);
    void this.refreshOverlay();
  }

  onAzimuthChange(event: Event): void {
    this.hillshadeAzimuth = Number((event.target as HTMLInputElement).value);
    void this.refreshOverlay();
  }

  onAltitudeChange(event: Event): void {
    this.hillshadeAltitude = Number((event.target as HTMLInputElement).value);
    void this.refreshOverlay();
  }

  onOpacityChange(event: Event): void {
    this.opacity = Number((event.target as HTMLInputElement).value) / 100;
    if (this.imageOverlay) {
      this.imageOverlay.setOpacity(this.opacity);
    }
    this.cdr.markForCheck();
  }

  zoomIn(): void {
    this.map?.zoomIn();
    this.syncZoom();
  }

  zoomOut(): void {
    this.map?.zoomOut();
    this.syncZoom();
  }

  fitViewport(): void {
    if (!this.map || !this.stats) {
      return;
    }
    void loadLeaflet().then((L) => {
      if (!this.map || !this.stats) {
        return;
      }
      fitMapToDem(this.map, L, this.stats);
      this.syncZoom();
    });
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.map?.invalidateSize();
      this.fitViewport();
    }, 80);
  }

  private async refreshOverlay(): Promise<void> {
    const current = this.currentFile;
    if (!current || !this.isBrowser) {
      return;
    }
    const token = ++this.renderToken;
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const preview = await reRenderDemPreview(current, {
        colormap: this.colormap,
        displayMode: this.displayMode,
        bandIndex: this.bandIndex,
        hillshadeAzimuth: this.hillshadeAzimuth,
        hillshadeAltitude: this.hillshadeAltitude
      });
      if (token !== this.renderToken) {
        return;
      }
      current.previewDataUrl = preview.dataUrl;
      current.previewWidth = preview.width;
      current.previewHeight = preview.height;
      current.elevationGrid = preview.elevationGrid;
      current.gridWidth = preview.width;
      current.gridHeight = preview.height;
      current.stats = preview.stats;
      await this.applyOverlay(current);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to re-render preview');
    } finally {
      if (token === this.renderToken) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private syncZoom(): void {
    if (!this.map) {
      return;
    }
    this.zoomPercent = Math.round(100 * Math.pow(2, this.map.getZoom() - 2));
    this.cdr.markForCheck();
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private isFileDrag(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) {
      return false;
    }
    return Array.from(types).includes('Files');
  }

  private observeMapResize(): void {
    if (!this.mapHost?.nativeElement || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.map?.invalidateSize({ animate: false });
    });
    this.resizeObserver.observe(this.mapHost.nativeElement);
  }

  private async renderCurrentFile(): Promise<void> {
    const current = this.currentFile;
    if (!current || !this.isBrowser) {
      return;
    }
    this.metaRows = metadataRows(current.metadata);
    this.bandIndex = current.stats.bandIndex;
    await this.ensureMap();
    await this.applyOverlay(current);
    this.libraryReady = true;
    this.cdr.markForCheck();
  }

  private async applyOverlay(current: DemLoadedFile): Promise<void> {
    if (!this.map || !current.previewDataUrl) {
      throw new Error('Map is not ready');
    }
    const L = await loadLeaflet();
    this.imageOverlay = createOrUpdateImageOverlay(
      L,
      this.map,
      current.previewDataUrl,
      current.stats,
      this.opacity,
      this.imageOverlay
    );
    if (this.baseLayer) {
      this.baseLayer.setOpacity(0.55);
    }
    fitMapToDem(this.map, L, current.stats);
    this.syncZoom();
  }

  private async ensureMap(): Promise<void> {
    if (this.map) {
      this.map.invalidateSize();
      return;
    }
    if (!this.mapHost?.nativeElement) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const container = this.mapHost?.nativeElement;
    if (!container) {
      throw new Error('Map is not ready');
    }
    const L = await loadLeaflet();
    configureLeafletDefaultIcons(L, this.assetService.getAssetPath('leaflet/images'));
    this.map = L.map(container, {
      zoomControl: false,
      attributionControl: true
    }).setView([20, 0], 2);
    this.baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.55,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
    this.map.on('zoomend', () => this.syncZoom());
    this.mapClickHandler = (e: { latlng: { lat: number; lng: number } }) => {
      const current = this.currentFile;
      if (!current) {
        return;
      }
      const elev = sampleElevationAtLatLng(
        current.elevationGrid,
        current.gridWidth,
        current.gridHeight,
        current.stats.bounds,
        e.latlng.lat,
        e.latlng.lng,
        current.metadata.nodata
      );
      this.sampledElevation = {
        elevation: elev,
        lat: e.latlng.lat,
        lng: e.latlng.lng
      };
      if (elev != null) {
        this.toast.info(`Elevation: ${elev.toFixed(2)}`);
      } else {
        this.toast.info('No elevation at this location');
      }
      this.cdr.markForCheck();
    };
    this.map.on('click', this.mapClickHandler as never);
    this.syncZoom();
  }

  private destroyMap(): void {
    if (this.map && this.mapClickHandler) {
      this.map.off('click', this.mapClickHandler as never);
    }
    this.mapClickHandler = null;
    if (this.imageOverlay && this.map) {
      this.map.removeLayer(this.imageOverlay);
    }
    this.imageOverlay = null;
    this.baseLayer = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
