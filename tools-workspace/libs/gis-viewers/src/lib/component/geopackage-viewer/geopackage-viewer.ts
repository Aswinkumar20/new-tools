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
import type { Map as LeafletMap, GeoJSON as LeafletGeoJson, Layer } from 'leaflet';
import {
  GEOPACKAGE_ACCEPT_ATTR,
  GEOPACKAGE_FORMATS_HINT,
  GEOPACKAGE_FORMATS_LABEL,
  GEOPACKAGE_RELATED_TOOLS,
  GEOPACKAGE_SUPPORTED_EXTENSIONS
} from '../../constants/geopackage-viewer.constants';
import type {
  GeoPackageAttributeTable,
  GeoPackageDiagramStats,
  GeoPackageExportFormat,
  GeoPackageFeature,
  GeoPackageFeatureFilter,
  GeoPackageFeatureSummary,
  GeoPackageLoadedFile
} from '../../types/geopackage-viewer.types';
import {
  buildAttributeTable,
  buildGeoPackageStats,
  configureLeafletDefaultIcons,
  countFeaturesByKind,
  createSampleGeoPackageFile,
  downloadBinaryFile,
  downloadTextFile,
  ensureGeoPackageStylesheet,
  exportFeaturesCsv,
  exportLayerGeoJson,
  exportSummaryJson,
  filterGeoPackageFeatures,
  filterValidGeoPackageFiles,
  formatBounds,
  formatGeoPackageFileSize,
  formatPropertyValue,
  formatSrs,
  loadLeaflet,
  parseGeoPackageFile,
  resolveGeoPackageSuggestion,
  summarizeFeatures,
  switchGeoPackageLayer
} from '../../utils/geopackage-viewer.utils';

@Component({
  selector: 'lib-geopackage-viewer',
  standalone: true,
  templateUrl: './geopackage-viewer.html',
  styleUrls: ['./geopackage-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeoPackageViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = GEOPACKAGE_ACCEPT_ATTR;
  readonly relatedTools = GEOPACKAGE_RELATED_TOOLS;
  readonly supportedExtensions = GEOPACKAGE_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = GEOPACKAGE_FORMATS_LABEL;
  readonly formatsHint = GEOPACKAGE_FORMATS_HINT;
  readonly formatPropertyValue = formatPropertyValue;
  readonly featureFilters: ReadonlyArray<{ id: GeoPackageFeatureFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'point', label: 'Points' },
    { id: 'line', label: 'Lines' },
    { id: 'polygon', label: 'Polygons' },
    { id: 'other', label: 'Other' }
  ];

  geoPackageFiles: GeoPackageLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  libraryReady = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  featureFilter: GeoPackageFeatureFilter = 'all';
  featureSearch = '';
  selectedFeatureId: string | null = null;
  zoomPercent = 100;

  mapFeatures: GeoPackageFeature[] = [];
  features: GeoPackageFeatureSummary[] = [];
  filteredFeatures: GeoPackageFeatureSummary[] = [];
  kindCounts: Record<GeoPackageFeatureFilter, number> = {
    all: 0,
    point: 0,
    line: 0,
    polygon: 0,
    other: 0
  };
  stats: GeoPackageDiagramStats | null = null;
  attributeTable: GeoPackageAttributeTable | null = null;

  private map: LeafletMap | null = null;
  private layer: LeafletGeoJson | null = null;
  private readonly layerByFeatureId = new Map<string, Layer>();
  private dragDepth = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): GeoPackageLoadedFile | null {
    return this.currentFileIndex >= 0
      ? this.geoPackageFiles[this.currentFileIndex] ?? null
      : null;
  }

  get canExport(): boolean {
    return !!this.currentFile;
  }

  get selectedFeature(): GeoPackageFeatureSummary | null {
    return this.features.find((item) => item.id === this.selectedFeatureId) ?? null;
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get selectedLayer(): string | null {
    return this.currentFile?.selectedLayer ?? null;
  }

  get layerOptions(): ReadonlyArray<{ id: string; label: string; count: number }> {
    const current = this.currentFile;
    if (!current) {
      return [];
    }
    return current.featureLayers.map((layer) => ({
      id: layer.tableName,
      label: layer.identifier || layer.tableName,
      count: layer.featureCount
    }));
  }

  get primarySuggestion() {
    const suggestion = resolveGeoPackageSuggestion({
      hasFiles: this.geoPackageFiles.length > 0,
      hasError: !!this.errorMessage,
      featureCount: this.features.length,
      tileOnly:
        !!this.currentFile &&
        this.currentFile.featureLayers.length === 0 &&
        this.currentFile.tileLayers.length > 0
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get boundsLabel(): string {
    return formatBounds(this.stats?.bounds ?? null);
  }

  get srsLabel(): string {
    return formatSrs(this.stats?.srsId ?? null);
  }

  private get sqlJsWasmBase(): string {
    return this.assetService.getAssetPath('sqljs');
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }
    ensureGeoPackageStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
    this.observeMapResize();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
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
    } else if (event.key === '0') {
      event.preventDefault();
      this.resetZoom();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: GeoPackageLoadedFile): string {
    return file.id;
  }

  trackByFilterId(_index: number, filter: { id: string }): string {
    return filter.id;
  }

  trackByFeatureId(_index: number, feature: GeoPackageFeatureSummary): string {
    return feature.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByColumn(_index: number, column: string): string {
    return column;
  }

  trackByRowId(_index: number, row: { featureId: string }): string {
    return row.featureId;
  }

  formatSize(bytes: number): string {
    return formatGeoPackageFileSize(bytes);
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
    const { accepted, rejected } = filterValidGeoPackageFiles(files);
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
        let record: GeoPackageLoadedFile;
        try {
          record = await parseGeoPackageFile(file, this.sqlJsWasmBase);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid GeoPackage';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
          continue;
        }
        const existing = this.geoPackageFiles.findIndex((item) => item.id === record.id);
        if (existing >= 0) {
          this.geoPackageFiles[existing] = record;
          this.currentFileIndex = existing;
        } else {
          this.geoPackageFiles = [...this.geoPackageFiles, record];
          this.currentFileIndex = this.geoPackageFiles.length - 1;
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
      this.errorMessage =
        error instanceof Error ? error.message : 'Failed to load GeoPackage file';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    const sample = createSampleGeoPackageFile();
    await this.handleFiles([sample]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.geoPackageFiles.length || index === this.currentFileIndex) {
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
    if (index < 0 || index >= this.geoPackageFiles.length) {
      return;
    }
    const next = this.geoPackageFiles.filter((_, i) => i !== index);
    this.geoPackageFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.geoPackageFiles = [];
    this.currentFileIndex = -1;
    this.mapFeatures = [];
    this.features = [];
    this.filteredFeatures = [];
    this.kindCounts = { all: 0, point: 0, line: 0, polygon: 0, other: 0 };
    this.stats = null;
    this.attributeTable = null;
    this.selectedFeatureId = null;
    this.errorMessage = '';
    this.featureSearch = '';
    this.featureFilter = 'all';
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

  setFeatureFilter(filter: GeoPackageFeatureFilter): void {
    this.featureFilter = filter;
    this.refreshFilteredFeatures();
  }

  async setLayer(layerName: string): Promise<void> {
    const current = this.currentFile;
    if (!current || current.selectedLayer === layerName) {
      return;
    }
    this.loading = true;
    this.selectedFeatureId = null;
    this.cdr.markForCheck();
    try {
      const updated = await switchGeoPackageLayer(current, layerName, this.sqlJsWasmBase);
      this.geoPackageFiles = this.geoPackageFiles.map((file, index) =>
        index === this.currentFileIndex ? { ...updated, id: current.id } : file
      );
      await this.renderCurrentFile();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load layer';
      this.toast.error(message);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  onFeatureSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.featureSearch = value;
      this.refreshFilteredFeatures();
    }, 120);
  }

  focusFeature(feature: GeoPackageFeatureSummary): void {
    this.selectedFeatureId = feature.id;
    const layer = this.layerByFeatureId.get(feature.id);
    if (layer && this.map) {
      const anyLayer = layer as Layer & {
        getBounds?: () => { isValid: () => boolean };
        getLatLng?: () => { lat: number; lng: number };
      };
      if (typeof anyLayer.getBounds === 'function') {
        const bounds = anyLayer.getBounds();
        if (bounds?.isValid?.()) {
          this.map.fitBounds(bounds as never, { padding: [28, 28], maxZoom: 16 });
        }
      } else if (typeof anyLayer.getLatLng === 'function') {
        this.map.setView(anyLayer.getLatLng(), Math.max(this.map.getZoom(), 14));
      }
      (layer as Layer & { openPopup?: () => void }).openPopup?.();
    }
    this.cdr.markForCheck();
  }

  focusFeatureById(featureId: string): void {
    const feature = this.features.find((item) => item.id === featureId);
    if (feature) {
      this.focusFeature(feature);
    }
  }

  async copyLayerGeoJson(): Promise<void> {
    if (!this.currentFile) {
      return;
    }
    try {
      await navigator.clipboard.writeText(exportLayerGeoJson(this.currentFile));
      this.toast.success('Copied layer GeoJSON');
    } catch {
      this.toast.error('Could not copy to clipboard');
    }
  }

  async copySelectedId(): Promise<void> {
    if (!this.selectedFeature) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.selectedFeature.id);
      this.toast.success('Copied feature id');
    } catch {
      this.toast.error('Could not copy to clipboard');
    }
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: GeoPackageExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      return;
    }
    const base = current.name.replace(/\.gpkg$/i, '') || 'geopackage';
    if (format === 'gpkg') {
      if (!current.bytes?.length) {
        this.toast.error('Nothing to export');
        return;
      }
      downloadBinaryFile(
        current.bytes,
        current.name.endsWith('.gpkg') ? current.name : `${base}.gpkg`,
        'application/geopackage+sqlite3'
      );
      this.toast.success('Exported GeoPackage');
    } else if (format === 'geojson') {
      if (!current.collection.features.length) {
        this.toast.error('No features to export');
        return;
      }
      downloadTextFile(
        exportLayerGeoJson(current),
        `${base}.geojson`,
        'application/geo+json'
      );
      this.toast.success('Exported GeoJSON');
    } else if (format === 'features-csv') {
      if (!this.features.length) {
        this.toast.error('No features to export');
        return;
      }
      downloadTextFile(exportFeaturesCsv(this.features), `${base}-features.csv`, 'text/csv');
      this.toast.success('Exported features CSV');
    } else {
      if (!this.stats) {
        this.toast.error('Nothing to export');
        return;
      }
      downloadTextFile(
        exportSummaryJson(current, this.stats, this.features),
        `${base}-summary.json`,
        'application/json'
      );
      this.toast.success('Exported summary JSON');
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
    if (!this.map || !this.layer) {
      return;
    }
    const bounds = this.layer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    }
    this.syncZoom();
  }

  resetZoom(): void {
    this.map?.setZoom(2);
    this.syncZoom();
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.map?.invalidateSize();
      this.fitViewport();
    }, 80);
  }

  private refreshFilteredFeatures(): void {
    this.filteredFeatures = filterGeoPackageFeatures(
      this.features,
      this.featureFilter,
      this.featureSearch
    );
    this.cdr.markForCheck();
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
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
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

    this.mapFeatures = current.collection.features;
    this.features = summarizeFeatures(this.mapFeatures);
    this.kindCounts = countFeaturesByKind(this.features);
    this.stats = buildGeoPackageStats(current, this.features, this.mapFeatures);
    this.attributeTable = buildAttributeTable(this.features);
    this.selectedFeatureId = null;
    this.refreshFilteredFeatures();

    await this.ensureMap();
    if (!this.map) {
      throw new Error('Map is not ready');
    }

    const L = await loadLeaflet();
    if (this.layer) {
      this.map.removeLayer(this.layer);
      this.layer = null;
    }
    this.layerByFeatureId.clear();

    const features = this.mapFeatures;
    this.layer = L.geoJSON(features as never, {
      style: () => ({
        color: '#2563eb',
        weight: 2.5,
        opacity: 0.9,
        fillColor: '#3b82f6',
        fillOpacity: 0.28
      }),
      pointToLayer: (_feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 7,
          color: '#1d4ed8',
          weight: 2,
          fillColor: '#60a5fa',
          fillOpacity: 0.85
        }),
      onEachFeature: (feature, layer) => {
        const index = features.indexOf(feature as never);
        const summary = this.features[index];
        const id = summary?.id ?? `feature-${index}`;
        this.layerByFeatureId.set(id, layer);
        const title = summary?.name ?? id;
        const layerLabel = summary?.layerName
          ? `<div class="geopackage-popup__type">${escapeHtml(summary.layerName)}</div>`
          : '';
        const props = Object.entries(summary?.properties ?? {})
          .slice(0, 8)
          .map(
            ([key, value]) =>
              `<div><strong>${escapeHtml(key)}</strong>: ${escapeHtml(formatPropertyValue(value))}</div>`
          )
          .join('');
        layer.bindPopup(
          `<div class="geopackage-popup"><strong>${escapeHtml(title)}</strong>${layerLabel}<div class="geopackage-popup__type">${escapeHtml(summary?.geometryType ?? '')}</div>${props}</div>`
        );
        layer.on('click', () => {
          this.selectedFeatureId = id;
          this.cdr.markForCheck();
        });
      }
    }).addTo(this.map);

    this.fitViewport();
    this.libraryReady = true;
    this.cdr.markForCheck();
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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
    this.map.on('zoomend', () => this.syncZoom());
    this.syncZoom();
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.layer = null;
    this.layerByFeatureId.clear();
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
