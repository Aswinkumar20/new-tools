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
  GPS_TRACK_ACCEPT_ATTR,
  GPS_TRACK_DEFAULT_MOVING_THRESHOLD_MPS,
  GPS_TRACK_FORMATS_HINT,
  GPS_TRACK_FORMATS_LABEL,
  GPS_TRACK_RELATED_TOOLS,
  GPS_TRACK_SUPPORTED_EXTENSIONS
} from '../../constants/gps-track-viewer.constants';
import type {
  GpsTrackChartAxis,
  GpsTrackExportFormat,
  GpsTrackInfo,
  GpsTrackLoadedFile,
  GpsTrackStats,
  GpxUnitSystem
} from '../../types/gps-track-viewer.types';
import {
  buildGpsProfileGeometry,
  buildGpsTrackStats,
  buildSpeedProfile,
  buildSpeedSegments,
  canExportOriginal,
  configureLeafletDefaultIcons,
  createGpsTrackFileRecord,
  createSampleGpsTrackFile,
  downloadTextFile,
  ensureGpsTrackStylesheet,
  exportPointsCsv,
  exportSpeedProfileCsv,
  exportSummaryJson,
  filterValidGpsTrackFiles,
  formatBounds,
  formatDistance,
  formatDuration,
  formatElevation,
  formatGpsTrackFileSize,
  formatPace,
  formatSpeed,
  loadLeaflet,
  parseGpsTrackText,
  readGpsTrackFileText,
  resolveGpsTrackSuggestion
} from '../../utils/gps-track-viewer.utils';

@Component({
  selector: 'lib-gps-track-viewer',
  standalone: true,
  templateUrl: './gps-track-viewer.html',
  styleUrls: ['./gps-track-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GpsTrackViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = GPS_TRACK_ACCEPT_ATTR;
  readonly relatedTools = GPS_TRACK_RELATED_TOOLS;
  readonly supportedExtensions = GPS_TRACK_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = GPS_TRACK_FORMATS_LABEL;
  readonly formatsHint = GPS_TRACK_FORMATS_HINT;

  trackFiles: GpsTrackLoadedFile[] = [];
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
  movingThresholdMps = GPS_TRACK_DEFAULT_MOVING_THRESHOLD_MPS;
  chartAxis: GpsTrackChartAxis = 'distance';
  stats: GpsTrackStats | null = null;
  speedLine = '';
  speedArea = '';
  paceLine = '';
  paceArea = '';

  private map: LeafletMap | null = null;
  private overlay: FeatureGroup | null = null;
  private startMarker: CircleMarker | null = null;
  private endMarker: CircleMarker | null = null;
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): GpsTrackLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.trackFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportOriginal(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get primarySuggestion() {
    const suggestion = resolveGpsTrackSuggestion({
      hasFiles: this.trackFiles.length > 0,
      hasError: !!this.errorMessage,
      hasTimestamps: !!this.stats?.hasTimestamps
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get boundsLabel(): string {
    return formatBounds(this.stats?.bounds ?? null);
  }

  get activeTrack(): GpsTrackInfo | null {
    const file = this.currentFile;
    if (!file) {
      return null;
    }
    return file.tracks.find((t) => t.id === this.activeTrackId) ?? file.tracks[0] ?? null;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }
    ensureGpsTrackStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
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

  trackByFileId(_index: number, file: GpsTrackLoadedFile): string {
    return file.id;
  }

  trackByTrackId(_index: number, track: GpsTrackInfo): string {
    return track.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatGpsTrackFileSize(bytes);
  }

  formatDistanceValue(meters: number | null | undefined): string {
    return formatDistance(meters ?? 0, this.units);
  }

  formatDurationValue(seconds: number | null | undefined): string {
    return formatDuration(seconds ?? null);
  }

  formatSpeedValue(mps: number | null | undefined): string {
    return formatSpeed(mps ?? null, this.units);
  }

  formatPaceValue(mps: number | null | undefined): string {
    return formatPace(mps ?? null, this.units);
  }

  formatElevationValue(meters: number | null | undefined): string {
    return formatElevation(meters ?? null, this.units);
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
    const { accepted, rejected } = filterValidGpsTrackFiles(files);
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
          const text = await readGpsTrackFileText(file);
          const parsed = parseGpsTrackText(text, file.name);
          const record = createGpsTrackFileRecord(file, text, parsed, this.movingThresholdMps);
          const existing = this.trackFiles.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.trackFiles[existing] = record;
            this.currentFileIndex = existing;
          } else {
            this.trackFiles = [...this.trackFiles, record];
            this.currentFileIndex = this.trackFiles.length - 1;
          }
          this.activeTrackId = record.tracks[0]?.id ?? null;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid GPS track file';
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load track';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleGpsTrackFile()]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.trackFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.activeTrackId = this.trackFiles[index]?.tracks[0]?.id ?? null;
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
    if (this.activeTrackId === trackId) {
      return;
    }
    this.activeTrackId = trackId;
    void this.renderCurrentFile();
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.trackFiles.length) return;
    const next = this.trackFiles.filter((_, i) => i !== index);
    this.trackFiles = next;
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
    this.trackFiles = [];
    this.currentFileIndex = -1;
    this.activeTrackId = null;
    this.stats = null;
    this.speedLine = '';
    this.speedArea = '';
    this.paceLine = '';
    this.paceArea = '';
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

  exportAs(format: GpsTrackExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current || !this.stats) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.(gpx|csv|txt|geojson|json)$/i, '') || 'gps-track';
    const track = this.activeTrack;
    try {
      if (format === 'original') {
        downloadTextFile(current.text, current.name, 'text/plain');
        this.toast.success('Exported original file');
      } else if (format === 'points-csv') {
        downloadTextFile(
          exportPointsCsv(current.tracks, this.activeTrackId ?? undefined),
          `${base}-points.csv`,
          'text/csv'
        );
        this.toast.success('Exported points CSV');
      } else if (format === 'summary-json') {
        downloadTextFile(
          exportSummaryJson(current, this.stats, this.activeTrackId || ''),
          `${base}-summary.json`,
          'application/json'
        );
        this.toast.success('Exported summary JSON');
      } else if (format === 'speed-csv' && track) {
        downloadTextFile(exportSpeedProfileCsv(track.points), `${base}-speed.csv`, 'text/csv');
        this.toast.success('Exported speed profile CSV');
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  onMovingThresholdChange(event: Event): void {
    this.movingThresholdMps = Number((event.target as HTMLInputElement).value);
    void this.renderCurrentFile();
  }

  onChartAxisChange(event: Event): void {
    this.chartAxis = (event.target as HTMLSelectElement).value as GpsTrackChartAxis;
    this.refreshCharts();
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

  private refreshCharts(): void {
    const track = this.activeTrack;
    if (!track) {
      this.speedLine = '';
      this.speedArea = '';
      this.paceLine = '';
      this.paceArea = '';
      return;
    }
    const samples = buildSpeedProfile(track.points);
    const speedGeom = buildGpsProfileGeometry(samples, 'speed', this.chartAxis);
    const paceGeom = buildGpsProfileGeometry(samples, 'pace', this.chartAxis);
    this.speedLine = speedGeom.linePoints;
    this.speedArea = speedGeom.areaPoints;
    this.paceLine = paceGeom.linePoints;
    this.paceArea = paceGeom.areaPoints;
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

    this.stats = buildGpsTrackStats(
      current.tracks[0]?.name ? current.name.replace(/\.[^.]+$/, '') : current.name,
      current.sourceKind,
      current.tracks,
      track.points,
      this.movingThresholdMps
    );
    // Prefer document title from first parse via stats rebuild with file name stem
    this.stats = {
      ...this.stats,
      title: current.name.replace(/\.(gpx|csv|txt|geojson|json)$/i, '') || 'GPS track'
    };
    this.refreshCharts();
    await this.ensureMap();
    await this.drawTrack(track);
    this.cdr.markForCheck();
  }

  private async drawTrack(track: GpsTrackInfo): Promise<void> {
    if (!this.map) return;
    const L = await loadLeaflet();
    if (this.overlay) {
      this.map.removeLayer(this.overlay);
      this.overlay = null;
    }
    this.startMarker = null;
    this.endMarker = null;

    const group = L.featureGroup();
    const segments = buildSpeedSegments(track.points, this.movingThresholdMps);
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
      this.startMarker = L.circleMarker([start.lat, start.lon], {
        radius: 7,
        color: '#166534',
        fillColor: '#22c55e',
        fillOpacity: 1,
        weight: 2
      }).bindTooltip('Start');
      this.endMarker = L.circleMarker([end.lat, end.lon], {
        radius: 7,
        color: '#991b1b',
        fillColor: '#ef4444',
        fillOpacity: 1,
        weight: 2
      }).bindTooltip('End');
      group.addLayer(this.startMarker);
      group.addLayer(this.endMarker);
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
    this.startMarker = null;
    this.endMarker = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
