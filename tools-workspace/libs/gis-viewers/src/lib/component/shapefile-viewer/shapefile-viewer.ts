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
  SHAPEFILE_ACCEPT_ATTR,
  SHAPEFILE_FORMATS_HINT,
  SHAPEFILE_FORMATS_LABEL,
  SHAPEFILE_RELATED_TOOLS,
  SHAPEFILE_SUPPORTED_EXTENSIONS
} from '../../constants/shapefile-viewer.constants';
import type {
  ShapefileAttributeTable,
  ShapefileDiagramStats,
  ShapefileExportFormat,
  ShapefileFeatureFilter,
  ShapefileFeatureSummary,
  ShapefileLoadedFile
} from '../../types/shapefile-viewer.types';
import {
  buildAttributeTable,
  buildShapefileStats,
  configureLeafletDefaultIcons,
  countFeaturesByKind,
  createSampleShapefileZip,
  createShapefileFileRecord,
  downloadTextFile,
  ensureShapefileStylesheet,
  exportFeaturesCsv,
  exportSummaryJson,
  filterShapefileFeatures,
  filterValidShapefileFiles,
  formatBounds,
  formatPropertyValue,
  formatShapefileFileSize,
  loadLeaflet,
  parseShapefilePartGroup,
  parseShapefileZipBuffer,
  partitionShapefileSelection,
  readFileAsArrayBuffer,
  resolveShapefileSuggestion,
  summarizeFeatures
} from '../../utils/shapefile-viewer.utils';

@Component({
  selector: 'lib-shapefile-viewer',
  standalone: true,
  templateUrl: './shapefile-viewer.html',
  styleUrls: ['./shapefile-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShapefileViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = SHAPEFILE_ACCEPT_ATTR;
  readonly relatedTools = SHAPEFILE_RELATED_TOOLS;
  readonly supportedExtensions = SHAPEFILE_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = SHAPEFILE_FORMATS_LABEL;
  readonly formatsHint = SHAPEFILE_FORMATS_HINT;
  readonly formatPropertyValue = formatPropertyValue;
  readonly featureFilters: ReadonlyArray<{ id: ShapefileFeatureFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'point', label: 'Points' },
    { id: 'line', label: 'Lines' },
    { id: 'polygon', label: 'Polygons' },
    { id: 'other', label: 'Other' }
  ];

  shapefileFiles: ShapefileLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  libraryReady = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  featureFilter: ShapefileFeatureFilter = 'all';
  featureSearch = '';
  selectedFeatureId: string | null = null;
  zoomPercent = 100;

  features: ShapefileFeatureSummary[] = [];
  filteredFeatures: ShapefileFeatureSummary[] = [];
  kindCounts: Record<ShapefileFeatureFilter, number> = {
    all: 0,
    point: 0,
    line: 0,
    polygon: 0,
    other: 0
  };
  stats: ShapefileDiagramStats | null = null;
  attributeTable: ShapefileAttributeTable | null = null;
  warnings: string[] = [];

  private map: LeafletMap | null = null;
  private layer: LeafletGeoJson | null = null;
  private readonly layerByFeatureId = new Map<string, Layer>();
  private dragDepth = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): ShapefileLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.shapefileFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return !!this.currentFile;
  }

  get selectedFeature(): ShapefileFeatureSummary | null {
    return this.features.find((item) => item.id === this.selectedFeatureId) ?? null;
  }

  get primarySuggestion() {
    const suggestion = resolveShapefileSuggestion({
      hasFiles: this.shapefileFiles.length > 0,
      hasError: !!this.errorMessage,
      featureCount: this.features.length
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
    ensureShapefileStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
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

  trackByFileId(_index: number, file: ShapefileLoadedFile): string {
    return file.id;
  }

  trackByFilterId(_index: number, filter: { id: string }): string {
    return filter.id;
  }

  trackByFeatureId(_index: number, feature: ShapefileFeatureSummary): string {
    return feature.id;
  }

  trackByColumn(_index: number, column: string): string {
    return column;
  }

  trackByRowId(_index: number, row: { featureId: string }): string {
    return row.featureId;
  }

  formatSize(bytes: number): string {
    return formatShapefileFileSize(bytes);
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
    const { accepted, rejected } = filterValidShapefileFiles(files);
    for (const item of rejected) {
      this.toast.error(`${item.name}: ${item.reason}`);
    }
    if (accepted.length === 0) {
      this.cdr.markForCheck();
      return;
    }

    const { zips, groups, orphanErrors } = partitionShapefileSelection(accepted);
    for (const item of orphanErrors) {
      this.toast.error(`${item.name}: ${item.reason}`);
    }
    if (zips.length === 0 && groups.length === 0) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      for (const file of zips) {
        try {
          const buffer = await readFileAsArrayBuffer(file);
          const parsed = await parseShapefileZipBuffer(buffer);
          const record = createShapefileFileRecord({
            name: file.name,
            size: file.size,
            data: parsed.data,
            warnings: parsed.warnings,
            sourceKind: 'zip',
            hadDbf: parsed.hadDbf,
            hadPrj: parsed.hadPrj,
            lastModified: file.lastModified
          });
          this.upsertFile(record);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid shapefile zip';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      for (const group of groups) {
        try {
          const parsed = await parseShapefilePartGroup(group);
          const record = createShapefileFileRecord({
            name: parsed.displayName,
            size: parsed.totalSize,
            data: parsed.data,
            warnings: parsed.warnings,
            sourceKind: 'parts',
            hadDbf: parsed.hadDbf,
            hadPrj: parsed.hadPrj,
            lastModified: group.files.shp?.lastModified ?? 0
          });
          this.upsertFile(record);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid shapefile parts';
          this.errorMessage = `${group.baseName}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      await this.renderCurrentFile();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load shapefile';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    const blob = await createSampleShapefileZip();
    const sample = new File([blob], 'sample-city.zip', {
      type: 'application/zip',
      lastModified: 0
    });
    await this.handleFiles([sample]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.shapefileFiles.length || index === this.currentFileIndex) {
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
    if (index < 0 || index >= this.shapefileFiles.length) {
      return;
    }
    const next = this.shapefileFiles.filter((_, i) => i !== index);
    this.shapefileFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.shapefileFiles = [];
    this.currentFileIndex = -1;
    this.features = [];
    this.filteredFeatures = [];
    this.kindCounts = { all: 0, point: 0, line: 0, polygon: 0, other: 0 };
    this.stats = null;
    this.attributeTable = null;
    this.warnings = [];
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

  setFeatureFilter(filter: ShapefileFeatureFilter): void {
    this.featureFilter = filter;
    this.refreshFilteredFeatures();
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

  focusFeatureById(featureId: string): void {
    const feature = this.features.find((item) => item.id === featureId);
    if (feature) {
      this.focusFeature(feature);
    }
  }

  focusFeature(feature: ShapefileFeatureSummary): void {
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

  async copyGeoJson(): Promise<void> {
    if (!this.currentFile) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.currentFile.geojsonText);
      this.toast.success('Copied GeoJSON');
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

  exportAs(format: ShapefileExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      return;
    }
    const base = current.name.replace(/\.(zip|shp)$/i, '') || 'shapefile';
    if (format === 'geojson') {
      downloadTextFile(current.geojsonText, `${base}.geojson`, 'application/geo+json');
      this.toast.success('Exported GeoJSON');
    } else if (format === 'features-csv') {
      downloadTextFile(exportFeaturesCsv(this.features), `${base}-features.csv`, 'text/csv');
      this.toast.success('Exported features CSV');
    } else {
      const summary = this.stats
        ? exportSummaryJson(current, this.stats, this.features)
        : '{}';
      downloadTextFile(summary, `${base}-summary.json`, 'application/json');
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

  private upsertFile(record: ShapefileLoadedFile): void {
    const existing = this.shapefileFiles.findIndex((item) => item.id === record.id);
    if (existing >= 0) {
      this.shapefileFiles[existing] = record;
      this.currentFileIndex = existing;
    } else {
      this.shapefileFiles = [...this.shapefileFiles, record];
      this.currentFileIndex = this.shapefileFiles.length - 1;
    }
  }

  private refreshFilteredFeatures(): void {
    this.filteredFeatures = filterShapefileFeatures(
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
    this.features = summarizeFeatures(current.data);
    this.kindCounts = countFeaturesByKind(this.features);
    this.stats = buildShapefileStats(current, this.features);
    this.attributeTable = buildAttributeTable(this.features);
    this.warnings = current.warnings;
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

    const features = current.data.features;
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
        const props = Object.entries(summary?.properties ?? {})
          .slice(0, 8)
          .map(
            ([key, value]) =>
              `<div><strong>${escapeHtml(key)}</strong>: ${escapeHtml(formatPropertyValue(value))}</div>`
          )
          .join('');
        layer.bindPopup(
          `<div class="shapefile-popup"><strong>${escapeHtml(title)}</strong><div class="shapefile-popup__type">${escapeHtml(summary?.geometryType ?? '')}</div>${props}</div>`
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
