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
import type { ImageOverlay, LayerGroup, Map as LeafletMap, Marker, TileLayer } from 'leaflet';
import {
  CONTOUR_ACCEPT_ATTR,
  CONTOUR_FORMATS_HINT,
  CONTOUR_FORMATS_LABEL,
  CONTOUR_RELATED_TOOLS,
  CONTOUR_SUPPORTED_EXTENSIONS
} from '../../constants/contour-map-viewer.constants';
import type {
  ContourExportFormat,
  ContourLineColorMode,
  ContourLoadedFile,
  ContourMetadataRow,
  DemColormap
} from '../../types/contour-map-viewer.types';
import {
  bandOptions,
  canExportContour,
  canExportOriginalDem,
  configureLeafletDefaultIcons,
  createContourFileRecord,
  createOrUpdateImageOverlay,
  createSampleContourFile,
  downloadBinaryFile,
  downloadTextFile,
  ensureContourStylesheet,
  exportContoursGeoJson,
  exportSummaryJson,
  filterValidContourFiles,
  fitMapToContour,
  formatBounds,
  formatContourFileSize,
  getContourFileExtension,
  legendGradientCss,
  loadLeaflet,
  metadataRows,
  nearestContourElevation,
  openAndParseContourDem,
  openAndParseContourGeoJson,
  pickContourLabels,
  readContourFileBytes,
  readContourFileText,
  reRenderContourPreview,
  resolveContourSuggestion,
  sourceKindForExtension,
  suggestContourInterval
} from '../../utils/contour-map-viewer.utils';

@Component({
  selector: 'lib-contour-map-viewer',
  standalone: true,
  templateUrl: './contour-map-viewer.html',
  styleUrls: ['./contour-map-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContourMapViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = CONTOUR_ACCEPT_ATTR;
  readonly relatedTools = CONTOUR_RELATED_TOOLS;
  readonly supportedExtensions = CONTOUR_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = CONTOUR_FORMATS_LABEL;
  readonly formatsHint = CONTOUR_FORMATS_HINT;
  readonly colormaps: DemColormap[] = ['grayscale', 'terrain', 'viridis', 'hypsometric'];

  contourFiles: ContourLoadedFile[] = [];
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
  metaRows: ContourMetadataRow[] = [];
  clickedElevation: number | null = null;

  colormap: DemColormap = 'terrain';
  bandIndex = 0;
  contourInterval = 10;
  majorEvery = 5;
  showLabels = true;
  showUnderlay = true;
  lineColorMode: ContourLineColorMode = 'elevation';
  solidColor = '#1e293b';
  lineWeight = 1.25;
  opacity = 0.95;

  private map: LeafletMap | null = null;
  private baseLayer: TileLayer | null = null;
  private imageOverlay: ImageOverlay | null = null;
  private labelLayer: LayerGroup | null = null;
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private renderToken = 0;
  private mapClickHandler: ((e: { latlng: { lat: number; lng: number } }) => void) | null = null;

  get currentFile(): ContourLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.contourFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportContour(this.currentFile);
  }

  get canExportDem(): boolean {
    return canExportOriginalDem(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get stats() {
    return this.currentFile?.stats ?? null;
  }

  get bandChoices(): number[] {
    return bandOptions(this.currentFile?.metadata?.samplesPerPixel ?? 1);
  }

  get legendCss(): string {
    return legendGradientCss(this.colormap);
  }

  get primarySuggestion() {
    const suggestion = resolveContourSuggestion({
      hasFiles: this.contourFiles.length > 0,
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
    ensureContourStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
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

  trackByFileId(_index: number, file: ContourLoadedFile): string {
    return file.id;
  }

  trackByMetaKey(_index: number, row: ContourMetadataRow): string {
    return row.key;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatContourFileSize(bytes);
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
    const { accepted, rejected } = filterValidContourFiles(files);
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
        const ext = getContourFileExtension(file.name);
        const kind = sourceKindForExtension(ext);
        try {
          if (kind === 'dem') {
            const bytes = await readContourFileBytes(file);
            const parsed = await openAndParseContourDem(bytes, file.name, this.renderOptions());
            this.applyParsedOptions(parsed.options);
            const record = createContourFileRecord(
              file,
              'dem',
              bytes,
              null,
              parsed.metadata,
              parsed.stats,
              parsed.warnings,
              parsed.preview,
              parsed.elevationGrid,
              parsed.contoursGeoJson
            );
            this.upsertFile(record);
          } else {
            const text = await readContourFileText(file);
            const parsed = openAndParseContourGeoJson(text, file.name, this.renderOptions());
            this.applyParsedOptions(parsed.options);
            const record = createContourFileRecord(
              file,
              'geojson',
              new Uint8Array(),
              text,
              null,
              parsed.stats,
              parsed.warnings,
              parsed.preview,
              null,
              parsed.contoursGeoJson
            );
            this.upsertFile(record);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid contour file';
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load contour file';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    const sample = createSampleContourFile();
    await this.handleFiles([sample]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.contourFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.clickedElevation = null;
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
    if (index < 0 || index >= this.contourFiles.length) {
      return;
    }
    const next = this.contourFiles.filter((_, i) => i !== index);
    this.contourFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.contourFiles = [];
    this.currentFileIndex = -1;
    this.metaRows = [];
    this.errorMessage = '';
    this.zoomPercent = 100;
    this.clickedElevation = null;
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

  exportAs(format: ContourExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      return;
    }
    const base = current.name.replace(/\.(tif|tiff|geotiff|geojson|json)$/i, '') || 'contours';
    if (format === 'geotiff') {
      if (!canExportOriginalDem(current)) {
        this.toast.error('Original DEM is only available for GeoTIFF uploads');
        return;
      }
      downloadBinaryFile(current.bytes, `${base}.tif`, 'image/tiff');
      this.toast.success('Exported GeoTIFF');
    } else if (format === 'summary-json') {
      downloadTextFile(exportSummaryJson(current), `${base}-summary.json`, 'application/json');
      this.toast.success('Exported summary JSON');
    } else if (format === 'contours-geojson') {
      downloadTextFile(exportContoursGeoJson(current), `${base}-contours.geojson`, 'application/geo+json');
      this.toast.success('Exported contour GeoJSON');
    } else if (format === 'png' && current.previewDataUrl) {
      const anchor = document.createElement('a');
      anchor.href = current.previewDataUrl;
      anchor.download = `${base}-preview.png`;
      anchor.click();
      this.toast.success('Exported PNG overlay');
    }
    this.cdr.markForCheck();
  }

  onColormapChange(event: Event): void {
    this.colormap = (event.target as HTMLSelectElement).value as DemColormap;
    void this.refreshOverlay();
  }

  onContourIntervalChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    this.contourInterval = value;
    void this.refreshOverlay();
  }

  onMajorEveryChange(event: Event): void {
    this.majorEvery = Math.max(1, Number((event.target as HTMLInputElement).value) || 1);
    void this.refreshOverlay();
  }

  onLineColorModeChange(event: Event): void {
    this.lineColorMode = (event.target as HTMLSelectElement).value as ContourLineColorMode;
    void this.refreshOverlay();
  }

  onSolidColorChange(event: Event): void {
    this.solidColor = (event.target as HTMLInputElement).value;
    void this.refreshOverlay();
  }

  onLineWeightChange(event: Event): void {
    this.lineWeight = Number((event.target as HTMLInputElement).value);
    void this.refreshOverlay();
  }

  onOpacityChange(event: Event): void {
    this.opacity = Number((event.target as HTMLInputElement).value) / 100;
    if (this.imageOverlay) {
      this.imageOverlay.setOpacity(this.opacity);
    }
    this.cdr.markForCheck();
  }

  onLabelsToggle(event: Event): void {
    this.showLabels = (event.target as HTMLInputElement).checked;
    void this.refreshLabels();
  }

  onUnderlayToggle(event: Event): void {
    this.showUnderlay = (event.target as HTMLInputElement).checked;
    void this.refreshOverlay();
  }

  suggestInterval(): void {
    const elev = this.stats?.elevation;
    if (!elev) {
      return;
    }
    this.contourInterval = suggestContourInterval(elev);
    void this.refreshOverlay();
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
      fitMapToContour(this.map, L, this.stats);
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

  private upsertFile(record: ContourLoadedFile): void {
    const existing = this.contourFiles.findIndex((item) => item.id === record.id);
    if (existing >= 0) {
      this.contourFiles[existing] = record;
      this.currentFileIndex = existing;
    } else {
      this.contourFiles = [...this.contourFiles, record];
      this.currentFileIndex = this.contourFiles.length - 1;
    }
  }

  private renderOptions() {
    return {
      colormap: this.colormap,
      bandIndex: this.bandIndex,
      contourInterval: this.contourInterval,
      majorEvery: this.majorEvery,
      showLabels: this.showLabels,
      showUnderlay: this.showUnderlay,
      lineColorMode: this.lineColorMode,
      solidColor: this.solidColor,
      lineWeight: this.lineWeight,
      opacity: this.opacity
    };
  }

  private applyParsedOptions(options: {
    bandIndex: number;
    contourInterval: number;
    majorEvery: number;
    showLabels: boolean;
    showUnderlay: boolean;
  }): void {
    this.bandIndex = options.bandIndex;
    this.contourInterval = options.contourInterval;
    this.majorEvery = options.majorEvery;
    this.showLabels = options.showLabels;
    this.showUnderlay = options.showUnderlay;
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
      const preview = await reRenderContourPreview(current, this.renderOptions());
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
      current.contoursGeoJson = preview.contoursGeoJson;
      await this.applyOverlay(current);
      await this.refreshLabels();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to re-render contours');
    } finally {
      if (token === this.renderToken) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private async refreshLabels(): Promise<void> {
    const current = this.currentFile;
    if (!this.map || !current) {
      return;
    }
    const L = await loadLeaflet();
    if (this.labelLayer) {
      this.map.removeLayer(this.labelLayer);
      this.labelLayer = null;
    }
    if (!this.showLabels) {
      return;
    }
    const placements = pickContourLabels(current.contoursGeoJson, {
      interval: this.contourInterval,
      majorEvery: this.majorEvery
    });
    const group = L.layerGroup();
    for (const place of placements) {
      const marker = L.marker([place.lat, place.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'contour-label',
          html: `<span class="contour-label__text${place.isMajor ? ' contour-label__text--major' : ''}">${place.elevation}</span>`,
          iconSize: [40, 16],
          iconAnchor: [20, 8]
        })
      }) as Marker;
      group.addLayer(marker);
    }
    group.addTo(this.map);
    this.labelLayer = group;
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
    this.metaRows = metadataRows(current);
    this.bandIndex = current.stats.bandIndex;
    this.contourInterval = current.stats.contourInterval;
    this.majorEvery = current.stats.majorEvery;
    await this.ensureMap();
    await this.applyOverlay(current);
    await this.refreshLabels();
    this.libraryReady = true;
    this.cdr.markForCheck();
  }

  private async applyOverlay(current: ContourLoadedFile): Promise<void> {
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
    fitMapToContour(this.map, L, current.stats);
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
      const elev = nearestContourElevation(
        current.contoursGeoJson,
        e.latlng.lat,
        e.latlng.lng
      );
      this.clickedElevation = elev;
      if (elev != null) {
        this.toast.info(`Contour level: ${elev.toFixed(2)}`);
      } else {
        this.toast.info('No contour level near this click');
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
    if (this.labelLayer && this.map) {
      this.map.removeLayer(this.labelLayer);
    }
    this.labelLayer = null;
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
