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
import type { CircleMarker, FeatureGroup, Layer, Map as LeafletMap, Polyline } from 'leaflet';
import {
  GPX_ACCEPT_ATTR,
  GPX_FORMATS_HINT,
  GPX_FORMATS_LABEL,
  GPX_RELATED_TOOLS,
  GPX_SAMPLE,
  GPX_SUPPORTED_EXTENSIONS
} from '../../constants/gpx-viewer.constants';
import type {
  GpxDiagramStats,
  GpxElevationSample,
  GpxExportFormat,
  GpxItemFilter,
  GpxItemSummary,
  GpxLoadedFile,
  GpxUnitSystem
} from '../../types/gpx-viewer.types';
import {
  buildElevationProfile,
  buildGpxStats,
  buildProfileGeometry,
  canExportGpx,
  canExportPointsCsv,
  canExportSummary,
  collectPathPoints,
  configureLeafletDefaultIcons,
  countItemsByKind,
  createGpxFileRecord,
  downloadTextFile,
  ensureGpxStylesheet,
  exportPointsCsv,
  exportSummaryJson,
  filterGpxItems,
  filterValidGpxFiles,
  flattenTrackPoints,
  formatBounds,
  formatDistance,
  formatDuration,
  formatElevation,
  formatGpxFileSize,
  formatPace,
  formatSpeed,
  kindLabel,
  loadLeaflet,
  parseGpxText,
  pointsForItem,
  readGpxFileText,
  resolveGpxSuggestion,
  summarizeGpxItems
} from '../../utils/gpx-viewer.utils';

@Component({
  selector: 'lib-gpx-viewer',
  standalone: true,
  templateUrl: './gpx-viewer.html',
  styleUrls: ['./gpx-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GpxViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = GPX_ACCEPT_ATTR;
  readonly relatedTools = GPX_RELATED_TOOLS;
  readonly supportedExtensions = GPX_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = GPX_FORMATS_LABEL;
  readonly formatsHint = GPX_FORMATS_HINT;
  readonly kindLabel = kindLabel;
  readonly itemFilters: ReadonlyArray<{ id: GpxItemFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'track', label: 'Tracks' },
    { id: 'route', label: 'Routes' },
    { id: 'waypoint', label: 'Waypoints' }
  ];

  gpxFiles: GpxLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  libraryReady = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  itemFilter: GpxItemFilter = 'all';
  itemSearch = '';
  selectedItemId: string | null = null;
  zoomPercent = 100;
  units: GpxUnitSystem = 'metric';
  elevationProfile: GpxElevationSample[] = [];
  profileLine = '';
  profileArea = '';
  hoverSample: GpxElevationSample | null = null;
  hoverX = 0;

  items: GpxItemSummary[] = [];
  filteredItems: GpxItemSummary[] = [];
  kindCounts: Record<GpxItemFilter, number> = {
    all: 0,
    track: 0,
    route: 0,
    waypoint: 0
  };
  stats: GpxDiagramStats | null = null;

  private map: LeafletMap | null = null;
  private overlay: FeatureGroup | null = null;
  private readonly layerByItemId = new Map<string, Layer>();
  private readonly pathStyleById = new Map<string, { color: string; weight: number; dashArray?: string }>();
  private hoverMarker: CircleMarker | null = null;
  private dragDepth = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): GpxLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.gpxFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportGpx(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get selectedItem(): GpxItemSummary | null {
    return this.items.find((item) => item.id === this.selectedItemId) ?? null;
  }

  get primarySuggestion() {
    const suggestion = resolveGpxSuggestion({
      hasFiles: this.gpxFiles.length > 0,
      hasError: !!this.errorMessage,
      trackCount: this.stats?.tracks ?? 0
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
    ensureGpxStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
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
    } else if (event.key.toLowerCase() === 'u') {
      event.preventDefault();
      this.toggleUnits();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: GpxLoadedFile): string {
    return file.id;
  }

  trackByFilterId(_index: number, filter: { id: string }): string {
    return filter.id;
  }

  trackByItemId(_index: number, item: GpxItemSummary): string {
    return item.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatGpxFileSize(bytes);
  }

  formatDistanceValue(meters: number): string {
    return formatDistance(meters, this.units);
  }

  formatElevationValue(meters: number | null | undefined): string {
    return formatElevation(meters, this.units);
  }

  formatSpeedValue(mps: number | null | undefined): string {
    return formatSpeed(mps ?? null, this.units);
  }

  formatPaceValue(mps: number | null | undefined): string {
    return formatPace(mps ?? null, this.units);
  }

  formatDurationValue(seconds: number | null | undefined): string {
    return formatDuration(seconds ?? null);
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
    const { accepted, rejected } = filterValidGpxFiles(files);
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
        const text = await readGpxFileText(file);
        let data;
        try {
          data = parseGpxText(text);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid GPX';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
          continue;
        }
        const record = createGpxFileRecord(file, text, data);
        const existing = this.gpxFiles.findIndex((item) => item.id === record.id);
        if (existing >= 0) {
          this.gpxFiles[existing] = record;
          this.currentFileIndex = existing;
        } else {
          this.gpxFiles = [...this.gpxFiles, record];
          this.currentFileIndex = this.gpxFiles.length - 1;
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load GPX file';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    const sample = new File([GPX_SAMPLE], 'coastal-ridge-sample.gpx', {
      type: 'application/gpx+xml',
      lastModified: 0
    });
    await this.handleFiles([sample]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.gpxFiles.length || index === this.currentFileIndex) {
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
    if (index < 0 || index >= this.gpxFiles.length) {
      return;
    }
    const next = this.gpxFiles.filter((_, i) => i !== index);
    this.gpxFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.gpxFiles = [];
    this.currentFileIndex = -1;
    this.items = [];
    this.filteredItems = [];
    this.kindCounts = { all: 0, track: 0, route: 0, waypoint: 0 };
    this.stats = null;
    this.selectedItemId = null;
    this.errorMessage = '';
    this.itemSearch = '';
    this.itemFilter = 'all';
    this.zoomPercent = 100;
    this.elevationProfile = [];
    this.profileLine = '';
    this.profileArea = '';
    this.hoverSample = null;
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  toggleUnits(): void {
    this.units = this.units === 'metric' ? 'imperial' : 'metric';
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

  setItemFilter(filter: GpxItemFilter): void {
    this.itemFilter = filter;
    this.refreshFilteredItems();
  }

  onItemSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.itemSearch = value;
      this.refreshFilteredItems();
    }, 120);
  }

  focusItem(item: GpxItemSummary): void {
    this.selectedItemId = item.id;
    this.applySelectionStyles();
    const layer = this.layerByItemId.get(item.id);
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

    const current = this.currentFile;
    if (current && (item.kind === 'track' || item.kind === 'route')) {
      const points = pointsForItem(current.data, item.id);
      this.elevationProfile = buildElevationProfile(points);
      const geometry = buildProfileGeometry(this.elevationProfile);
      this.profileLine = geometry.linePoints;
      this.profileArea = geometry.areaPoints;
    }

    this.cdr.markForCheck();
  }

  async copyGpx(): Promise<void> {
    if (!canExportGpx(this.currentFile)) {
      this.toast.error('No GPX content to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(this.currentFile!.text);
      this.toast.success('Copied GPX');
    } catch {
      this.toast.error('Could not copy to clipboard');
    }
  }

  async copySelectedId(): Promise<void> {
    if (!this.selectedItem) {
      this.toast.error('Select a track, route, or waypoint first');
      return;
    }
    try {
      await navigator.clipboard.writeText(this.selectedItem.id);
      this.toast.success('Copied item id');
    } catch {
      this.toast.error('Could not copy to clipboard');
    }
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    if (!this.canExport) {
      this.toast.error('Load a GPX file before exporting');
      return;
    }
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: GpxExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      this.toast.error('Load a GPX file before exporting');
      this.cdr.markForCheck();
      return;
    }
    const base = current.name.replace(/\.gpx$/i, '') || 'activity';
    try {
      if (format === 'gpx') {
        if (!canExportGpx(current)) {
          throw new Error('GPX source is empty');
        }
        downloadTextFile(current.text, `${base}.gpx`, 'application/gpx+xml');
        this.toast.success('Exported GPX');
      } else if (format === 'points-csv') {
        if (!canExportPointsCsv(current)) {
          throw new Error('No points available to export');
        }
        downloadTextFile(exportPointsCsv(current.data), `${base}-points.csv`, 'text/csv');
        this.toast.success('Exported points CSV');
      } else {
        if (!canExportSummary(current, this.stats)) {
          throw new Error('Summary is not ready yet');
        }
        downloadTextFile(
          exportSummaryJson(current, this.stats!, this.items),
          `${base}-summary.json`,
          'application/json'
        );
        this.toast.success('Exported summary JSON');
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
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
    if (!this.map || !this.overlay) {
      return;
    }
    const bounds = this.overlay.getBounds();
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

  onProfileMove(event: MouseEvent): void {
    if (this.elevationProfile.length < 2) {
      return;
    }
    const target = event.currentTarget as SVGElement;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const maxDistance = this.elevationProfile[this.elevationProfile.length - 1].distanceMeters;
    const targetDistance = ratio * maxDistance;
    let closest = this.elevationProfile[0];
    let best = Math.abs(closest.distanceMeters - targetDistance);
    for (const sample of this.elevationProfile) {
      const delta = Math.abs(sample.distanceMeters - targetDistance);
      if (delta < best) {
        best = delta;
        closest = sample;
      }
    }
    this.hoverSample = closest;
    this.hoverX = maxDistance > 0 ? (closest.distanceMeters / maxDistance) * 100 : 0;
    void this.syncHoverMarker(closest);
    this.cdr.markForCheck();
  }

  onProfileClick(): void {
    if (!this.hoverSample || !this.map) {
      return;
    }
    this.map.setView([this.hoverSample.lat, this.hoverSample.lon], Math.max(this.map.getZoom(), 15));
  }

  clearProfileHover(): void {
    this.hoverSample = null;
    if (this.hoverMarker && this.map) {
      this.map.removeLayer(this.hoverMarker);
      this.hoverMarker = null;
    }
    this.cdr.markForCheck();
  }

  private async syncHoverMarker(sample: GpxElevationSample): Promise<void> {
    if (!this.map) {
      return;
    }
    const L = await loadLeaflet();
    if (!this.hoverMarker) {
      this.hoverMarker = L.circleMarker([sample.lat, sample.lon], {
        radius: 6,
        color: '#b45309',
        weight: 2,
        fillColor: '#f59e0b',
        fillOpacity: 0.95
      }).addTo(this.map);
    } else {
      this.hoverMarker.setLatLng([sample.lat, sample.lon]);
    }
  }

  private refreshFilteredItems(): void {
    this.filteredItems = filterGpxItems(this.items, this.itemFilter, this.itemSearch);
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

  private applySelectionStyles(): void {
    for (const [id, layer] of this.layerByItemId.entries()) {
      const polyline = layer as Polyline;
      if (typeof polyline.setStyle !== 'function') {
        continue;
      }
      const base = this.pathStyleById.get(id);
      if (!base) {
        continue;
      }
      if (id === this.selectedItemId) {
        polyline.setStyle({
          color: '#b45309',
          weight: base.weight + 2,
          opacity: 1,
          dashArray: base.dashArray
        });
        polyline.bringToFront?.();
      } else {
        polyline.setStyle({
          color: base.color,
          weight: base.weight,
          opacity: 0.9,
          dashArray: base.dashArray
        });
      }
    }
  }

  private async renderCurrentFile(): Promise<void> {
    const current = this.currentFile;
    if (!current || !this.isBrowser) {
      return;
    }
    this.items = summarizeGpxItems(current.data);
    this.kindCounts = countItemsByKind(this.items);
    this.stats = buildGpxStats(current.data, this.items);
    this.selectedItemId = null;
    this.elevationProfile = buildElevationProfile(collectPathPoints(current.data));
    const geometry = buildProfileGeometry(this.elevationProfile);
    this.profileLine = geometry.linePoints;
    this.profileArea = geometry.areaPoints;
    this.hoverSample = null;
    this.refreshFilteredItems();

    await this.ensureMap();
    if (!this.map) {
      throw new Error('Map is not ready');
    }

    const L = await loadLeaflet();
    if (this.overlay) {
      this.map.removeLayer(this.overlay);
      this.overlay = null;
    }
    if (this.hoverMarker) {
      this.map.removeLayer(this.hoverMarker);
      this.hoverMarker = null;
    }
    this.layerByItemId.clear();
    this.pathStyleById.clear();

    const group = L.featureGroup();
    const trackColors = ['#2563eb', '#0d9488', '#7c3aed', '#db2777'];

    current.data.tracks.forEach((track, trackIndex) => {
      const points = flattenTrackPoints(track);
      if (points.length < 2) {
        return;
      }
      const latlngs = points.map((point) => [point.lat, point.lon] as [number, number]);
      const color = trackColors[trackIndex % trackColors.length];
      const style = { color, weight: 4 };
      this.pathStyleById.set(track.id, style);
      const polyline = L.polyline(latlngs, {
        ...style,
        opacity: 0.92
      }).bindPopup(
        `<div class="gpx-popup"><strong>${escapeHtml(track.name)}</strong><div class="gpx-popup__type">Track · ${points.length} pts</div></div>`
      );
      polyline.on('click', () => {
        const summary = this.items.find((item) => item.id === track.id);
        if (summary) {
          this.focusItem(summary);
        }
      });
      group.addLayer(polyline);
      this.layerByItemId.set(track.id, polyline);

      group.addLayer(
        L.circleMarker(latlngs[0], {
          radius: 5,
          color: '#166534',
          weight: 2,
          fillColor: '#86efac',
          fillOpacity: 1
        }).bindTooltip('Start', { direction: 'top' })
      );
      group.addLayer(
        L.circleMarker(latlngs[latlngs.length - 1], {
          radius: 5,
          color: '#9f1239',
          weight: 2,
          fillColor: '#fda4af',
          fillOpacity: 1
        }).bindTooltip('End', { direction: 'top' })
      );
    });

    current.data.routes.forEach((route) => {
      if (route.points.length < 2) {
        return;
      }
      const latlngs = route.points.map((point) => [point.lat, point.lon] as [number, number]);
      const style = { color: '#ea580c', weight: 3, dashArray: '8 6' };
      this.pathStyleById.set(route.id, style);
      const polyline = L.polyline(latlngs, {
        ...style,
        opacity: 0.85
      }).bindPopup(
        `<div class="gpx-popup"><strong>${escapeHtml(route.name)}</strong><div class="gpx-popup__type">Route · ${route.points.length} pts</div></div>`
      );
      polyline.on('click', () => {
        const summary = this.items.find((item) => item.id === route.id);
        if (summary) {
          this.focusItem(summary);
        }
      });
      group.addLayer(polyline);
      this.layerByItemId.set(route.id, polyline);
    });

    for (const waypoint of current.data.waypoints) {
      const marker = L.circleMarker([waypoint.lat, waypoint.lon], {
        radius: 7,
        color: '#1d4ed8',
        weight: 2,
        fillColor: '#60a5fa',
        fillOpacity: 0.9
      }).bindPopup(
        `<div class="gpx-popup"><strong>${escapeHtml(waypoint.name || waypoint.id)}</strong><div class="gpx-popup__type">Waypoint</div></div>`
      );
      marker.on('click', () => {
        const summary = this.items.find((item) => item.id === waypoint.id);
        if (summary) {
          this.focusItem(summary);
        }
      });
      group.addLayer(marker);
      this.layerByItemId.set(waypoint.id, marker);
    }

    this.overlay = group.addTo(this.map);
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
    this.overlay = null;
    this.hoverMarker = null;
    this.layerByItemId.clear();
    this.pathStyleById.clear();
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
