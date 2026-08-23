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
  SATELLITE_ACCEPT_ATTR,
  SATELLITE_FORMATS_HINT,
  SATELLITE_FORMATS_LABEL,
  SATELLITE_RELATED_TOOLS,
  SATELLITE_SUPPORTED_EXTENSIONS
} from '../../constants/satellite-image-viewer.constants';
import type {
  SatelliteBandSelection,
  SatelliteColormap,
  SatelliteCompositePreset,
  SatelliteExportFormat,
  SatelliteLoadedFile,
  SatelliteMetadataRow,
  SatelliteStretchMode
} from '../../types/satellite-image-viewer.types';
import {
  bandOptions,
  buildSatelliteWarnings,
  canExportSatellite,
  canUseFalseColorIr,
  canUseNdvi,
  configureLeafletDefaultIcons,
  createSatelliteFileRecord,
  createOrUpdateImageOverlay,
  createSampleSatelliteFile,
  downloadBinaryFile,
  downloadTextFile,
  ensureSatelliteStylesheet,
  exportMetadataJson,
  exportSummaryJson,
  filterValidSatelliteFiles,
  fitMapToSatellite,
  formatBounds,
  formatSatelliteFileSize,
  loadLeaflet,
  metadataRows,
  openAndParseSatellite,
  readSatelliteFileBytes,
  renderSatellitePreview,
  resolveCompositeBands,
  resolveSatelliteSuggestion
} from '../../utils/satellite-image-viewer.utils';

@Component({
  selector: 'lib-satellite-image-viewer',
  standalone: true,
  templateUrl: './satellite-image-viewer.html',
  styleUrls: ['./satellite-image-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SatelliteImageViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = SATELLITE_ACCEPT_ATTR;
  readonly relatedTools = SATELLITE_RELATED_TOOLS;
  readonly supportedExtensions = SATELLITE_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = SATELLITE_FORMATS_LABEL;
  readonly formatsHint = SATELLITE_FORMATS_HINT;
  readonly stretchModes: SatelliteStretchMode[] = ['none', 'minmax', 'percentile'];
  readonly presets: Array<{ id: SatelliteCompositePreset; label: string }> = [
    { id: 'true-color', label: 'True Color' },
    { id: 'false-color-ir', label: 'False Color IR' },
    { id: 'grayscale', label: 'Grayscale' },
    { id: 'custom', label: 'Custom RGB' },
    { id: 'ndvi', label: 'NDVI' }
  ];
  readonly colormaps: SatelliteColormap[] = ['viridis', 'terrain'];

  satelliteFiles: SatelliteLoadedFile[] = [];
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
  metaRows: SatelliteMetadataRow[] = [];

  preset: SatelliteCompositePreset = 'true-color';
  bandSelection: SatelliteBandSelection = { red: 0, green: 1, blue: 2, grayscale: false };
  stretchMode: SatelliteStretchMode = 'minmax';
  colormap: SatelliteColormap = 'viridis';
  opacity = 0.85;

  private map: LeafletMap | null = null;
  private baseLayer: TileLayer | null = null;
  private imageOverlay: ImageOverlay | null = null;
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private renderToken = 0;

  get currentFile(): SatelliteLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.satelliteFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportSatellite(this.currentFile);
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

  get primarySuggestion() {
    const suggestion = resolveSatelliteSuggestion({
      hasFiles: this.satelliteFiles.length > 0,
      hasError: !!this.errorMessage,
      hasBounds: !!this.stats?.bounds,
      bandCount: this.currentFile?.metadata.samplesPerPixel ?? 0
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
    ensureSatelliteStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
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

  trackByFileId(_index: number, file: SatelliteLoadedFile): string {
    return file.id;
  }

  trackByMetaKey(_index: number, row: SatelliteMetadataRow): string {
    return row.key;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatSatelliteFileSize(bytes);
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
    const { accepted, rejected } = filterValidSatelliteFiles(files);
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
        const bytes = await readSatelliteFileBytes(file);
        let parsed;
        try {
          parsed = await openAndParseSatellite(bytes, file.name, {
            preset: this.preset,
            bands: this.bandSelection,
            stretch: this.stretchMode,
            colormap: this.colormap
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid satellite GeoTIFF';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
          continue;
        }
        this.bandSelection = parsed.bands;
        this.preset = parsed.preset;
        const record = createSatelliteFileRecord(
          file,
          bytes,
          parsed.metadata,
          parsed.stats,
          parsed.warnings,
          parsed.preview,
          parsed.preset
        );
        const existing = this.satelliteFiles.findIndex((item) => item.id === record.id);
        if (existing >= 0) {
          this.satelliteFiles[existing] = record;
          this.currentFileIndex = existing;
        } else {
          this.satelliteFiles = [...this.satelliteFiles, record];
          this.currentFileIndex = this.satelliteFiles.length - 1;
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load Satellite file';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    const sample = createSampleSatelliteFile();
    await this.handleFiles([sample]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.satelliteFiles.length || index === this.currentFileIndex) {
      return;
    }
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
    if (index < 0 || index >= this.satelliteFiles.length) {
      return;
    }
    const next = this.satelliteFiles.filter((_, i) => i !== index);
    this.satelliteFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.satelliteFiles = [];
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

  exportAs(format: SatelliteExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      return;
    }
    const base = current.name.replace(/\.(tif|tiff|geotiff)$/i, '') || 'satellite';
    if (format === 'original') {
      downloadBinaryFile(current.bytes, `${base}.tif`, 'image/tiff');
      this.toast.success('Exported original GeoTIFF');
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

  onBandChange(channel: 'red' | 'green' | 'blue', event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.bandSelection = { ...this.bandSelection, [channel]: value, grayscale: this.preset === 'grayscale' };
    if (this.preset !== 'custom' && this.preset !== 'grayscale') {
      this.preset = 'custom';
    }
    void this.refreshOverlay();
  }

  get ndviEnabled(): boolean {
    return canUseNdvi(this.currentFile?.metadata.samplesPerPixel ?? 0);
  }

  get falseColorEnabled(): boolean {
    return canUseFalseColorIr(this.currentFile?.metadata.samplesPerPixel ?? 0);
  }

  onPresetChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SatelliteCompositePreset;
    this.preset = value;
    if (this.currentFile) {
      this.bandSelection = resolveCompositeBands(
        value,
        this.currentFile.metadata.samplesPerPixel,
        this.bandSelection
      );
      this.currentFile.preset = value;
      this.currentFile.warnings = buildSatelliteWarnings(this.currentFile.metadata, value);
    }
    void this.refreshOverlay();
  }

  onColormapChange(event: Event): void {
    this.colormap = (event.target as HTMLSelectElement).value as SatelliteColormap;
    void this.refreshOverlay();
  }

  onStretchChange(event: Event): void {
    this.stretchMode = (event.target as HTMLSelectElement).value as SatelliteStretchMode;
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
      fitMapToSatellite(this.map, L, this.stats);
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
      const preview = await renderSatellitePreview(
        current.bytes,
        current.metadata,
        this.preset,
        this.bandSelection,
        this.stretchMode,
        this.colormap
      );
      if (token !== this.renderToken) {
        return;
      }
      current.previewDataUrl = preview.dataUrl;
      current.previewWidth = preview.width;
      current.previewHeight = preview.height;
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
    await this.ensureMap();
    await this.applyOverlay(current);
    this.libraryReady = true;
    this.cdr.markForCheck();
  }

  private async applyOverlay(current: SatelliteLoadedFile): Promise<void> {
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
    fitMapToSatellite(this.map, L, current.stats);
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
    this.syncZoom();
  }

  private destroyMap(): void {
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
