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
import type { CircleMarker, FeatureGroup, Map as LeafletMap, Polyline } from 'leaflet';
import {
  DRONE_ACCEPT_ATTR,
  DRONE_FORMATS_HINT,
  DRONE_FORMATS_LABEL,
  DRONE_RELATED_TOOLS,
  DRONE_SUPPORTED_EXTENSIONS
} from '../../constants/drone-flight-path-viewer.constants';
import type {
  DroneExportFormat,
  DroneFlightTrack,
  DroneLoadedFile,
  DroneFlightStats,
  GpxUnitSystem
} from '../../types/drone-flight-path-viewer.types';
import {
  buildAltitudeProfile,
  buildAltitudeSegments,
  buildDroneFlightStats,
  buildDroneProfileGeometry,
  canExportOriginal,
  configureLeafletDefaultIcons,
  createDroneFileRecord,
  createSampleDroneFile,
  downloadTextFile,
  ensureDroneStylesheet,
  exportDroneSummaryJson,
  exportPathGeoJson,
  exportTelemetryCsv,
  filterValidDroneFiles,
  formatBounds,
  formatClimbRate,
  formatDistance,
  formatDroneFileSize,
  formatDuration,
  formatElevation,
  loadLeaflet,
  parseDroneText,
  readDroneFileText,
  resolveDroneSuggestion
} from '../../utils/drone-flight-path-viewer.utils';

@Component({
  selector: 'lib-drone-flight-path-viewer',
  standalone: true,
  templateUrl: './drone-flight-path-viewer.html',
  styleUrls: ['./drone-flight-path-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DroneFlightPathViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = DRONE_ACCEPT_ATTR;
  readonly relatedTools = DRONE_RELATED_TOOLS;
  readonly supportedExtensions = DRONE_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = DRONE_FORMATS_LABEL;
  readonly formatsHint = DRONE_FORMATS_HINT;

  flightFiles: DroneLoadedFile[] = [];
  currentFileIndex = -1;
  activeTrackId: string | null = null;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  zoomPercent = 100;
  units: GpxUnitSystem = 'metric';
  stats: DroneFlightStats | null = null;
  altitudeLine = '';
  altitudeArea = '';
  telemetryPreview: Array<{
    time: string;
    altitude: string;
    battery: string;
    gimbal: string;
  }> = [];

  private map: LeafletMap | null = null;
  private overlay: FeatureGroup | null = null;
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): DroneLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.flightFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportOriginal(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get primarySuggestion() {
    const suggestion = resolveDroneSuggestion({
      hasFiles: this.flightFiles.length > 0,
      hasError: !!this.errorMessage,
      hasAltitude: this.stats?.altitudeMode !== 'none' && this.stats?.altitudeMode != null
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get boundsLabel(): string {
    return formatBounds(this.stats?.bounds ?? null);
  }

  get activeTrack(): DroneFlightTrack | null {
    const file = this.currentFile;
    if (!file) return null;
    return file.tracks.find((t) => t.id === this.activeTrackId) ?? file.tracks[0] ?? null;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    ensureDroneStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
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
    } else if (event.key.toLowerCase() === 'u') {
      event.preventDefault();
      this.toggleUnits();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: DroneLoadedFile): string {
    return file.id;
  }

  trackByTrackId(_index: number, track: DroneFlightTrack): string {
    return track.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatDroneFileSize(bytes);
  }

  formatDistanceValue(meters: number | null | undefined): string {
    return formatDistance(meters ?? 0, this.units);
  }

  formatDurationValue(seconds: number | null | undefined): string {
    return formatDuration(seconds ?? null);
  }

  formatElevationValue(meters: number | null | undefined): string {
    return formatElevation(meters ?? null, this.units);
  }

  formatClimbRateValue(mps: number | null | undefined): string {
    return formatClimbRate(mps ?? null, this.units);
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
    const { accepted, rejected } = filterValidDroneFiles(files);
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
        try {
          const text = await readDroneFileText(file);
          const parsed = parseDroneText(text, file.name);
          const record = createDroneFileRecord(file, text, parsed);
          const existing = this.flightFiles.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.flightFiles[existing] = record;
            this.currentFileIndex = existing;
          } else {
            this.flightFiles = [...this.flightFiles, record];
            this.currentFileIndex = this.flightFiles.length - 1;
          }
          this.activeTrackId = record.tracks[0]?.id ?? null;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid drone flight file';
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load flight';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleDroneFile()]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.flightFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.activeTrackId = this.flightFiles[index]?.tracks[0]?.id ?? null;
    this.loading = true;
    this.cdr.markForCheck();
    try {
      await this.renderCurrentFile();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  selectTrack(trackId: string): void {
    if (this.activeTrackId === trackId) return;
    this.activeTrackId = trackId;
    void this.renderCurrentFile();
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.flightFiles.length) return;
    const next = this.flightFiles.filter((_, i) => i !== index);
    this.flightFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    this.activeTrackId = next[this.currentFileIndex]?.tracks[0]?.id ?? null;
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.flightFiles = [];
    this.currentFileIndex = -1;
    this.activeTrackId = null;
    this.stats = null;
    this.altitudeLine = '';
    this.altitudeArea = '';
    this.telemetryPreview = [];
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

  toggleUnits(): void {
    this.units = this.units === 'metric' ? 'imperial' : 'metric';
    this.cdr.markForCheck();
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: DroneExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current || !this.stats) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.(gpx|csv|txt|geojson|json)$/i, '') || 'drone-flight';
    const track = this.activeTrack;
    try {
      if (format === 'original') {
        downloadTextFile(current.text, current.name, 'text/plain');
        this.toast.success('Exported original file');
      } else if (format === 'path-geojson' && track) {
        downloadTextFile(exportPathGeoJson(track), `${base}-path.geojson`, 'application/geo+json');
        this.toast.success('Exported path GeoJSON');
      } else if (format === 'telemetry-csv' && track) {
        downloadTextFile(exportTelemetryCsv(track), `${base}-telemetry.csv`, 'text/csv');
        this.toast.success('Exported telemetry CSV');
      } else if (format === 'summary-json') {
        downloadTextFile(
          exportDroneSummaryJson(current, this.stats, this.activeTrackId || ''),
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
    if (!this.map || !this.overlay) return;
    const bounds = this.overlay.getBounds();
    if (bounds?.isValid?.()) {
      this.map.fitBounds(bounds, { padding: [32, 32] });
      this.syncZoom();
    }
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.map?.invalidateSize();
      this.fitViewport();
    }, 80);
  }

  private refreshChartsAndTelemetry(): void {
    const track = this.activeTrack;
    if (!track) {
      this.altitudeLine = '';
      this.altitudeArea = '';
      this.telemetryPreview = [];
      return;
    }
    const geom = buildDroneProfileGeometry(buildAltitudeProfile(track.points));
    this.altitudeLine = geom.linePoints;
    this.altitudeArea = geom.areaPoints;

    const step = Math.max(1, Math.floor(track.points.length / 8));
    this.telemetryPreview = track.points
      .filter((_, i) => i % step === 0 || i === track.points.length - 1)
      .slice(0, 12)
      .map((p) => ({
        time: p.time ? p.time.slice(11, 19) : '—',
        altitude:
          p.altitude == null ? '—' : formatElevation(p.altitude, this.units),
        battery: p.batteryPercent == null ? '—' : `${p.batteryPercent}%`,
        gimbal: p.gimbalPitchDeg == null ? '—' : `${p.gimbalPitchDeg}°`
      }));
  }

  private syncZoom(): void {
    if (!this.map) return;
    this.zoomPercent = Math.round(100 * Math.pow(2, this.map.getZoom() - 2));
    this.cdr.markForCheck();
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

  private observeMapResize(): void {
    if (!this.mapHost?.nativeElement || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => {
      this.map?.invalidateSize({ animate: false });
    });
    this.resizeObserver.observe(this.mapHost.nativeElement);
  }

  private async renderCurrentFile(): Promise<void> {
    const current = this.currentFile;
    if (!current || !this.isBrowser) return;
    const track = this.activeTrack;
    if (!track) return;

    this.stats = {
      ...buildDroneFlightStats(
        current.name.replace(/\.(gpx|csv|txt|geojson|json)$/i, '') || 'Drone flight',
        current.sourceKind,
        current.tracks,
        track.points
      )
    };
    this.refreshChartsAndTelemetry();
    await this.ensureMap();
    await this.drawTrack(track);
    this.cdr.markForCheck();
  }

  private async drawTrack(track: DroneFlightTrack): Promise<void> {
    if (!this.map) return;
    const L = await loadLeaflet();
    if (this.overlay) {
      this.map.removeLayer(this.overlay);
      this.overlay = null;
    }

    const group = L.featureGroup();
    const segments = buildAltitudeSegments(track.points);
    for (const segment of segments) {
      const polyline = L.polyline(
        [
          [segment.from.lat, segment.from.lon],
          [segment.to.lat, segment.to.lon]
        ],
        {
          color: segment.color,
          weight: 4,
          opacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round'
        }
      ) as Polyline;
      group.addLayer(polyline);
    }

    if (track.points.length > 0) {
      const start = track.points[0];
      const end = track.points[track.points.length - 1];
      group.addLayer(
        L.circleMarker([start.lat, start.lon], {
          radius: 7,
          color: '#166534',
          fillColor: '#22c55e',
          fillOpacity: 1,
          weight: 2
        }).bindTooltip('Takeoff') as CircleMarker
      );
      group.addLayer(
        L.circleMarker([end.lat, end.lon], {
          radius: 7,
          color: '#991b1b',
          fillColor: '#ef4444',
          fillOpacity: 1,
          weight: 2
        }).bindTooltip('Landing') as CircleMarker
      );
    }

    for (const photo of track.photos) {
      group.addLayer(
        L.circleMarker([photo.lat, photo.lon], {
          radius: 5,
          color: '#7c3aed',
          fillColor: '#a78bfa',
          fillOpacity: 0.95,
          weight: 2
        }).bindTooltip(photo.name || 'Photo') as CircleMarker
      );
    }

    group.addTo(this.map);
    this.overlay = group;
    const bounds = group.getBounds();
    if (bounds?.isValid?.()) {
      this.map.fitBounds(bounds, { padding: [32, 32] });
    }
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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
    this.map.on('zoomend', () => this.syncZoom());
    this.syncZoom();
  }

  private destroyMap(): void {
    this.overlay = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
