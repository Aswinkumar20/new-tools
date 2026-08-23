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
import type { GeoJSON as LeafletGeoJson, Map as LeafletMap, TileLayer } from 'leaflet';
import {
  VECTOR_TILE_ACCEPT_ATTR,
  VECTOR_TILE_FORMATS_HINT,
  VECTOR_TILE_FORMATS_LABEL,
  VECTOR_TILE_RELATED_TOOLS,
  VECTOR_TILE_SUPPORTED_EXTENSIONS
} from '../../constants/vector-tile-viewer.constants';
import type {
  VectorTileExportFormat,
  VectorTileFeatureSummary,
  VectorTileLoadedFile,
  VectorTileMetadataRow
} from '../../types/vector-tile-viewer.types';
import {
  canExportVectorTile,
  configureLeafletDefaultIcons,
  createGeoJsonLayer,
  createSampleVectorTileFile,
  createVectorTileFileRecord,
  downloadBinaryFile,
  downloadTextFile,
  ensureVectorTileStylesheet,
  exportAttributesCsv,
  exportGeoJson,
  exportSummaryJson,
  fetchTileFromTemplate,
  filterGeoJsonByVisibleLayers,
  filterValidVectorTileFiles,
  fitMapToVectorTile,
  formatBounds,
  formatVectorTileFileSize,
  getVectorTileFileExtension,
  isGeoJsonExtension,
  isMvtExtension,
  loadLeaflet,
  metadataRows,
  openAndParseGeoJsonText,
  openAndParseMvtBytes,
  parseTileCoords,
  readVectorTileFileBytes,
  readVectorTileFileText,
  resolveVectorTileSuggestion,
  sampleTileCoords,
  summarizeFeatures
} from '../../utils/vector-tile-viewer.utils';

@Component({
  selector: 'lib-vector-tile-viewer',
  standalone: true,
  templateUrl: './vector-tile-viewer.html',
  styleUrls: ['./vector-tile-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VectorTileViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = VECTOR_TILE_ACCEPT_ATTR;
  readonly relatedTools = VECTOR_TILE_RELATED_TOOLS;
  readonly supportedExtensions = VECTOR_TILE_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = VECTOR_TILE_FORMATS_LABEL;
  readonly formatsHint = VECTOR_TILE_FORMATS_HINT;

  tileFiles: VectorTileLoadedFile[] = [];
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
  metaRows: VectorTileMetadataRow[] = [];
  featureSummaries: VectorTileFeatureSummary[] = [];
  selectedFeatureId: string | null = null;

  tileZ = '0';
  tileX = '0';
  tileY = '0';
  tileUrlTemplate = '';
  opacity = 0.85;
  lineWeight = 2;

  private map: LeafletMap | null = null;
  private baseLayer: TileLayer | null = null;
  private geoLayer: LeafletGeoJson | null = null;
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private leafletMod: typeof import('leaflet') | null = null;

  get currentFile(): VectorTileLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.tileFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportVectorTile(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get stats() {
    return this.currentFile?.stats ?? null;
  }

  get selectedFeature(): VectorTileFeatureSummary | null {
    return this.featureSummaries.find((f) => f.id === this.selectedFeatureId) ?? null;
  }

  get primarySuggestion() {
    const suggestion = resolveVectorTileSuggestion({
      hasFiles: this.tileFiles.length > 0,
      hasError: !!this.errorMessage,
      featureCount: this.stats?.featureCount ?? 0
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
    ensureVectorTileStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
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

  trackByFileId(_index: number, file: VectorTileLoadedFile): string {
    return file.id;
  }

  trackByMetaKey(_index: number, row: VectorTileMetadataRow): string {
    return row.key;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByLayerName(_index: number, layer: { name: string }): string {
    return layer.name;
  }

  trackByFeatureId(_index: number, feature: VectorTileFeatureSummary): string {
    return feature.id;
  }

  formatSize(bytes: number): string {
    return formatVectorTileFileSize(bytes);
  }

  formatProp(value: string | number | boolean | null | undefined): string {
    if (value == null) return '—';
    return String(value);
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
    const { accepted, rejected } = filterValidVectorTileFiles(files);
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

    const coords = parseTileCoords(this.tileZ, this.tileX, this.tileY);

    try {
      for (const file of accepted) {
        const ext = getVectorTileFileExtension(file.name);
        try {
          if (isGeoJsonExtension(ext)) {
            const text = await readVectorTileFileText(file);
            const parsed = openAndParseGeoJsonText(text, file.name);
            const record = createVectorTileFileRecord(
              file,
              null,
              null,
              parsed.geojson,
              parsed.layers,
              parsed.stats,
              parsed.warnings,
              0,
              0,
              0
            );
            this.upsertFile(record);
          } else if (isMvtExtension(ext)) {
            const bytes = await readVectorTileFileBytes(file);
            const parsed = openAndParseMvtBytes(
              bytes,
              file.name,
              coords.z,
              coords.x,
              coords.y,
              coords.missing
            );
            const record = createVectorTileFileRecord(
              file,
              bytes,
              parsed.tile,
              parsed.geojson,
              parsed.layers,
              parsed.stats,
              parsed.warnings,
              coords.z,
              coords.x,
              coords.y
            );
            this.upsertFile(record);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid vector tile';
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load vector tile';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private upsertFile(record: VectorTileLoadedFile): void {
    const existing = this.tileFiles.findIndex((item) => item.id === record.id);
    if (existing >= 0) {
      this.tileFiles[existing] = record;
      this.currentFileIndex = existing;
    } else {
      this.tileFiles = [...this.tileFiles, record];
      this.currentFileIndex = this.tileFiles.length - 1;
    }
  }

  async loadSample(): Promise<void> {
    const sample = createSampleVectorTileFile();
    const coords = sampleTileCoords();
    this.tileZ = String(coords.z);
    this.tileX = String(coords.x);
    this.tileY = String(coords.y);
    await this.handleFiles([sample]);
  }

  async fetchFromUrl(): Promise<void> {
    const coords = parseTileCoords(this.tileZ, this.tileX, this.tileY);
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    try {
      const { bytes } = await fetchTileFromTemplate(
        this.tileUrlTemplate,
        coords.z,
        coords.x,
        coords.y
      );
      const name = `tile-${coords.z}-${coords.x}-${coords.y}.mvt`;
      const file = new File([bytes as BlobPart], name, {
        type: 'application/vnd.mapbox-vector-tile',
        lastModified: 0
      });
      const parsed = openAndParseMvtBytes(
        bytes,
        name,
        coords.z,
        coords.x,
        coords.y,
        coords.missing
      );
      const warnings = [...parsed.warnings];
      warnings.push('Fetched from remote URL — CORS may block some tile hosts.');
      const record = createVectorTileFileRecord(
        file,
        bytes,
        parsed.tile,
        parsed.geojson,
        parsed.layers,
        { ...parsed.stats, sourceKind: 'url' },
        warnings,
        coords.z,
        coords.x,
        coords.y
      );
      this.upsertFile(record);
      await this.renderCurrentFile();
      this.toast.success(`Fetched ${name}`);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Tile fetch failed';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.tileFiles.length || index === this.currentFileIndex) return;
    this.currentFileIndex = index;
    this.selectedFeatureId = null;
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
    if (index < 0 || index >= this.tileFiles.length) return;
    const next = this.tileFiles.filter((_, i) => i !== index);
    this.tileFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.tileFiles = [];
    this.currentFileIndex = -1;
    this.metaRows = [];
    this.featureSummaries = [];
    this.selectedFeatureId = null;
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

  exportAs(format: VectorTileExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) return;
    const base = current.name.replace(/\.(mvt|pbf|geojson|json)$/i, '') || 'vector-tile';
    try {
      if (format === 'geojson') {
        downloadTextFile(exportGeoJson(current), `${base}.geojson`, 'application/geo+json');
      } else if (format === 'summary-json') {
        downloadTextFile(exportSummaryJson(current), `${base}-summary.json`, 'application/json');
      } else if (format === 'attributes-csv') {
        downloadTextFile(exportAttributesCsv(current), `${base}-attributes.csv`, 'text/csv');
      } else if (format === 'mvt') {
        if (!current.bytes?.length) {
          this.toast.error('Original MVT bytes are not available for this source');
          return;
        }
        downloadBinaryFile(current.bytes, `${base}.mvt`, 'application/vnd.mapbox-vector-tile');
      }
      this.toast.success('Export ready');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  toggleLayerVisibility(layerName: string): void {
    const current = this.currentFile;
    if (!current) return;
    current.layers = current.layers.map((layer) =>
      layer.name === layerName ? { ...layer, visible: !layer.visible } : layer
    );
    void this.renderCurrentFile(false);
  }

  onOpacityChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.opacity = Math.max(0.1, Math.min(1, value / 100));
    void this.renderCurrentFile(false);
  }

  onLineWeightChange(event: Event): void {
    this.lineWeight = Math.max(1, Math.min(8, Number((event.target as HTMLInputElement).value)));
    void this.renderCurrentFile(false);
  }

  onTileCoordChange(): void {
    this.cdr.markForCheck();
  }

  selectFeature(feature: VectorTileFeatureSummary): void {
    this.selectedFeatureId = feature.id;
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
    if (!this.map || !this.leafletMod || !this.currentFile) return;
    fitMapToVectorTile(this.map, this.leafletMod, this.currentFile, this.geoLayer);
    this.syncZoomPercent();
  }

  private syncZoomPercent(): void {
    if (!this.map) return;
    const z = this.map.getZoom();
    this.zoomPercent = Math.round((z / 18) * 100);
    this.cdr.markForCheck();
  }

  private async ensureMap(): Promise<typeof import('leaflet')> {
    if (!this.leafletMod) {
      this.leafletMod = await loadLeaflet();
      configureLeafletDefaultIcons(
        this.leafletMod,
        this.assetService.getAssetPath('leaflet')
      );
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
    if (!this.map) return;

    this.metaRows = metadataRows(current);
    this.featureSummaries = summarizeFeatures(current.geojson);
    const filtered = filterGeoJsonByVisibleLayers(current.geojson, current.layers);
    this.geoLayer = createGeoJsonLayer(
      L,
      this.map,
      filtered,
      current.layers,
      { opacity: this.opacity, lineWeight: this.lineWeight },
      (featureIndex) => {
        const summary = this.featureSummaries.find((f) => f.featureIndex === featureIndex);
        if (summary) {
          this.selectedFeatureId = summary.id;
          this.cdr.markForCheck();
        }
      },
      this.geoLayer
    );
    if (fit) {
      fitMapToVectorTile(this.map, L, current, this.geoLayer);
    }
    this.syncZoomPercent();
    this.cdr.markForCheck();
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.baseLayer = null;
    this.geoLayer = null;
  }

  private observeMapResize(): void {
    if (typeof ResizeObserver === 'undefined' || !this.mapHost?.nativeElement) return;
    this.resizeObserver = new ResizeObserver(() => {
      this.map?.invalidateSize();
    });
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
