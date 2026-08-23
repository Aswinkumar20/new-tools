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
import type { ImageOverlay, Map as LeafletMap } from 'leaflet';
import {
  LIDAR_ACCEPT_ATTR,
  LIDAR_CLASS_COLORS,
  LIDAR_DEFAULT_OPACITY,
  LIDAR_DEFAULT_POINT_SIZE,
  LIDAR_DEFAULT_PREVIEW_CAP,
  LIDAR_FORMATS_HINT,
  LIDAR_FORMATS_LABEL,
  LIDAR_RELATED_TOOLS,
  LIDAR_SUPPORTED_EXTENSIONS
} from '../../constants/lidar-map-viewer.constants';
import type {
  LidarColorMode,
  LidarExportFormat,
  LidarLoadedFile,
  LidarStats
} from '../../types/lidar-map-viewer.types';
import {
  canExportOriginal,
  configureLeafletDefaultIcons,
  createLidarFileRecord,
  createSampleLidarFile,
  downloadBinaryFile,
  downloadTextFile,
  ensureLidarStylesheet,
  exportClassificationCsv,
  exportLidarSummaryJson,
  exportPointsGeoJson,
  filterPointsByClass,
  filterValidLidarFiles,
  formatBoundsLabel,
  formatLidarFileSize,
  loadLeaflet,
  readLidarFileBytes,
  renderLidarCanvas,
  resolveLidarSuggestion
} from '../../utils/lidar-map-viewer.utils';

@Component({
  selector: 'lib-lidar-map-viewer',
  standalone: true,
  templateUrl: './lidar-map-viewer.html',
  styleUrls: ['./lidar-map-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LidarMapViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;

  readonly acceptAttr = LIDAR_ACCEPT_ATTR;
  readonly relatedTools = LIDAR_RELATED_TOOLS;
  readonly supportedExtensions = LIDAR_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = LIDAR_FORMATS_LABEL;
  readonly formatsHint = LIDAR_FORMATS_HINT;

  lidarFiles: LidarLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  zoomPercent = 100;
  colorMode: LidarColorMode = 'classification';
  pointSize = LIDAR_DEFAULT_POINT_SIZE;
  opacity = LIDAR_DEFAULT_OPACITY;
  previewCap = LIDAR_DEFAULT_PREVIEW_CAP;
  enabledClasses = new Set<number>();

  private map: LeafletMap | null = null;
  private overlay: ImageOverlay | null = null;
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): LidarLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.lidarFiles[this.currentFileIndex] ?? null : null;
  }

  get stats(): LidarStats | null {
    return this.currentFile?.stats ?? null;
  }

  get canExport(): boolean {
    return canExportOriginal(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get boundsLabel(): string {
    return formatBoundsLabel(this.stats);
  }

  get primarySuggestion() {
    const suggestion = resolveLidarSuggestion({
      hasFiles: this.lidarFiles.length > 0,
      hasError: !!this.errorMessage,
      isLaz: !!this.currentFile?.isLaz
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get classEntries() {
    return this.stats?.classHistogram ?? [];
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    ensureLidarStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
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
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: LidarLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByClass(_index: number, entry: { classification: number }): number {
    return entry.classification;
  }

  formatSize(bytes: number): string {
    return formatLidarFileSize(bytes);
  }

  isClassEnabled(code: number): boolean {
    return this.enabledClasses.has(code);
  }

  classColor(code: number): string {
    return LIDAR_CLASS_COLORS[code] ?? '#64748b';
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
    const { accepted, rejected } = filterValidLidarFiles(files);
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
          const bytes = await readLidarFileBytes(file);
          const record = createLidarFileRecord(file, bytes, this.previewCap);
          const existing = this.lidarFiles.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.lidarFiles[existing] = record;
            this.currentFileIndex = existing;
          } else {
            this.lidarFiles = [...this.lidarFiles, record];
            this.currentFileIndex = this.lidarFiles.length - 1;
          }
          this.syncEnabledClasses(record);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid LiDAR file';
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load LiDAR';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleLidarFile()]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.lidarFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.syncEnabledClasses(this.lidarFiles[index]);
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
    if (index < 0 || index >= this.lidarFiles.length) return;
    const next = this.lidarFiles.filter((_, i) => i !== index);
    this.lidarFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    this.syncEnabledClasses(next[this.currentFileIndex]);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.lidarFiles = [];
    this.currentFileIndex = -1;
    this.enabledClasses = new Set();
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

  exportAs(format: LidarExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.(las|laz)$/i, '') || 'lidar';
    try {
      if (format === 'original') {
        downloadBinaryFile(current.bytes, current.name, 'application/octet-stream');
        this.toast.success('Exported original file');
      } else if (format === 'summary-json') {
        downloadTextFile(exportLidarSummaryJson(current), `${base}-summary.json`, 'application/json');
        this.toast.success('Exported summary JSON');
      } else if (format === 'classification-csv' && current.stats) {
        downloadTextFile(
          exportClassificationCsv(current.stats),
          `${base}-classes.csv`,
          'text/csv'
        );
        this.toast.success('Exported classification CSV');
      } else if (format === 'points-geojson' && current.points.length) {
        downloadTextFile(
          exportPointsGeoJson(current.points, 5000),
          `${base}-points.geojson`,
          'application/geo+json'
        );
        this.toast.success('Exported points GeoJSON (capped)');
      } else {
        this.toast.error('Export not available for this file');
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  onColorModeChange(event: Event): void {
    this.colorMode = (event.target as HTMLSelectElement).value as LidarColorMode;
    void this.renderCurrentFile();
  }

  onPointSizeChange(event: Event): void {
    this.pointSize = Number((event.target as HTMLInputElement).value);
    void this.renderCurrentFile();
  }

  onOpacityChange(event: Event): void {
    this.opacity = Number((event.target as HTMLInputElement).value);
    void this.renderCurrentFile();
  }

  toggleClass(code: number): void {
    if (this.enabledClasses.has(code)) {
      this.enabledClasses.delete(code);
    } else {
      this.enabledClasses.add(code);
    }
    this.enabledClasses = new Set(this.enabledClasses);
    void this.renderCurrentFile();
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

  private syncEnabledClasses(file: LidarLoadedFile | null | undefined): void {
    const next = new Set<number>();
    for (const entry of file?.stats?.classHistogram ?? []) {
      next.add(entry.classification);
    }
    this.enabledClasses = next;
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
    if (current.isLaz || !current.stats || current.points.length === 0) {
      if (this.overlay && this.map) {
        this.map.removeLayer(this.overlay);
        this.overlay = null;
      }
      this.cdr.markForCheck();
      return;
    }

    await this.ensureMap();
    await this.drawPoints(current);
    this.cdr.markForCheck();
  }

  private async drawPoints(file: LidarLoadedFile): Promise<void> {
    if (!this.map || !file.stats) return;
    const L = await loadLeaflet();
    const points = filterPointsByClass(file.points, this.enabledClasses);
    const { dataUrl, bounds } = renderLidarCanvas(points, file.stats, this.colorMode, {
      pointSize: this.pointSize,
      opacity: this.opacity
    });

    if (this.overlay) {
      this.map.removeLayer(this.overlay);
      this.overlay = null;
    }

    if (!dataUrl) {
      return;
    }

    this.overlay = L.imageOverlay(dataUrl, bounds, { opacity: 1, interactive: false });
    this.overlay.addTo(this.map);
    this.map.fitBounds(bounds, { padding: [32, 32] });
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
    }).setView([37.77, -122.42], 12);
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
