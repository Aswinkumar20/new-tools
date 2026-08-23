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
import type { Database } from 'sql.js';
import type { GridLayer, Map as LeafletMap, TileLayer } from 'leaflet';
import {
  MBTILES_ACCEPT_ATTR,
  MBTILES_FORMATS_HINT,
  MBTILES_FORMATS_LABEL,
  MBTILES_RELATED_TOOLS,
  MBTILES_SUPPORTED_EXTENSIONS
} from '../../constants/mbtiles-viewer.constants';
import type {
  MbtilesExportFormat,
  MbtilesLoadedFile,
  MbtilesMetadataRow
} from '../../types/mbtiles-viewer.types';
import {
  canExportMbtiles,
  closeDatabase,
  configureLeafletDefaultIcons,
  createMbtilesFileRecord,
  createMbtilesGridLayer,
  createSampleMbtilesFile,
  downloadBinaryFile,
  downloadTextFile,
  ensureMbtilesStylesheet,
  exportMetadataJson,
  exportSummaryJson,
  filterValidMbtilesFiles,
  fitMapToMbtiles,
  formatBounds,
  formatMbtilesFileSize,
  formatZoomRange,
  loadLeaflet,
  metadataRows,
  openAndParseMbtiles,
  openSqliteDatabase,
  readMbtilesFileBytes,
  resolveMbtilesSuggestion
} from '../../utils/mbtiles-viewer.utils';

@Component({
  selector: 'lib-mbtiles-viewer',
  standalone: true,
  templateUrl: './mbtiles-viewer.html',
  styleUrls: ['./mbtiles-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MbtilesViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = MBTILES_ACCEPT_ATTR;
  readonly relatedTools = MBTILES_RELATED_TOOLS;
  readonly supportedExtensions = MBTILES_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = MBTILES_FORMATS_LABEL;
  readonly formatsHint = MBTILES_FORMATS_HINT;

  mbtilesFiles: MbtilesLoadedFile[] = [];
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
  metaRows: MbtilesMetadataRow[] = [];

  private map: LeafletMap | null = null;
  private baseLayer: TileLayer | null = null;
  private tilesLayer: GridLayer | null = null;
  private activeDb: Database | null = null;
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): MbtilesLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.mbtilesFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportMbtiles(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get stats() {
    return this.currentFile?.stats ?? null;
  }

  get primarySuggestion() {
    const suggestion = resolveMbtilesSuggestion({
      hasFiles: this.mbtilesFiles.length > 0,
      hasError: !!this.errorMessage,
      tileCount: this.stats?.tileCount ?? 0,
      isVectorFormat: !!this.stats?.isVectorFormat
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  get boundsLabel(): string {
    return formatBounds(this.stats?.bounds ?? null);
  }

  get zoomRangeLabel(): string {
    return formatZoomRange(this.stats?.minZoom ?? null, this.stats?.maxZoom ?? null);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }
    ensureMbtilesStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
    this.observeMapResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.destroyMap();
    this.closeActiveDb();
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

  trackByFileId(_index: number, file: MbtilesLoadedFile): string {
    return file.id;
  }

  trackByMetaKey(_index: number, row: MbtilesMetadataRow): string {
    return row.key;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatMbtilesFileSize(bytes);
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
    const { accepted, rejected } = filterValidMbtilesFiles(files);
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

    const wasmBase = this.assetService.getAssetPath('sqljs');

    try {
      for (const file of accepted) {
        const bytes = await readMbtilesFileBytes(file);
        let parsed;
        try {
          parsed = await openAndParseMbtiles(wasmBase, bytes);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid MBTiles';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
          continue;
        }
        // Close the parse-time DB; renderCurrentFile reopens for the map layer.
        closeDatabase(parsed.db);
        const record = createMbtilesFileRecord(
          file,
          bytes,
          parsed.metadata,
          parsed.stats,
          parsed.warnings
        );
        const existing = this.mbtilesFiles.findIndex((item) => item.id === record.id);
        if (existing >= 0) {
          this.mbtilesFiles[existing] = record;
          this.currentFileIndex = existing;
        } else {
          this.mbtilesFiles = [...this.mbtilesFiles, record];
          this.currentFileIndex = this.mbtilesFiles.length - 1;
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load MBTiles file';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    const sample = createSampleMbtilesFile();
    await this.handleFiles([sample]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.mbtilesFiles.length || index === this.currentFileIndex) {
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
    if (index < 0 || index >= this.mbtilesFiles.length) {
      return;
    }
    const next = this.mbtilesFiles.filter((_, i) => i !== index);
    this.mbtilesFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.closeActiveDb();
    this.mbtilesFiles = [];
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

  exportAs(format: MbtilesExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      return;
    }
    const base = current.name.replace(/\.mbtiles$/i, '') || 'mbtiles';
    if (format === 'mbtiles') {
      downloadBinaryFile(current.bytes, `${base}.mbtiles`, 'application/x-sqlite3');
      this.toast.success('Exported MBTiles');
    } else if (format === 'metadata-json') {
      downloadTextFile(exportMetadataJson(current), `${base}-metadata.json`, 'application/json');
      this.toast.success('Exported metadata JSON');
    } else {
      downloadTextFile(exportSummaryJson(current), `${base}-summary.json`, 'application/json');
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
    if (!this.map || !this.stats) {
      return;
    }
    void loadLeaflet().then((L) => {
      if (!this.map || !this.stats) {
        return;
      }
      fitMapToMbtiles(this.map, L, this.stats);
      this.syncZoom();
    });
  }

  resetZoom(): void {
    const minZoom = this.stats?.minZoom ?? 0;
    this.map?.setZoom(minZoom);
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

  private syncZoom(): void {
    if (!this.map) {
      return;
    }
    const base = this.stats?.minZoom ?? 2;
    this.zoomPercent = Math.round(100 * Math.pow(2, this.map.getZoom() - base));
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

  private closeActiveDb(): void {
    closeDatabase(this.activeDb);
    this.activeDb = null;
  }

  private async renderCurrentFile(): Promise<void> {
    const current = this.currentFile;
    if (!current || !this.isBrowser) {
      return;
    }

    this.metaRows = metadataRows(current.metadata);
    this.closeActiveDb();

    const wasmBase = this.assetService.getAssetPath('sqljs');
    const db = await openSqliteDatabase(wasmBase, current.bytes);
    this.activeDb = db;

    await this.ensureMap();
    if (!this.map) {
      throw new Error('Map is not ready');
    }

    const L = await loadLeaflet();
    if (this.tilesLayer) {
      this.map.removeLayer(this.tilesLayer);
      this.tilesLayer = null;
    }

    // Prefer MBTiles as the visual base; keep a very faint OSM underlay for empty tiles.
    if (this.baseLayer) {
      this.baseLayer.setOpacity(0.18);
    }

    const minZoom = current.stats.minZoom ?? 0;
    const maxZoom = current.stats.maxZoom ?? 22;
    this.map.setMinZoom(minZoom);
    this.map.setMaxZoom(maxZoom);

    this.tilesLayer = createMbtilesGridLayer(L, db, {
      minZoom,
      maxZoom,
      attribution: current.metadata.attribution || current.stats.title,
      format: current.metadata.format
    });
    this.tilesLayer.addTo(this.map);

    fitMapToMbtiles(this.map, L, current.stats);
    this.syncZoom();
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
    this.baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
    this.map.on('zoomend', () => this.syncZoom());
    this.syncZoom();
  }

  private destroyMap(): void {
    if (this.tilesLayer && this.map) {
      this.map.removeLayer(this.tilesLayer);
    }
    this.tilesLayer = null;
    this.baseLayer = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
