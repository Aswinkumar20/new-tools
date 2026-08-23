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
  COG_ACCEPT_ATTR,
  COG_DEFAULT_WINDOW_SIZE,
  COG_FORMATS_HINT,
  COG_FORMATS_LABEL,
  COG_RELATED_TOOLS,
  COG_SUPPORTED_EXTENSIONS
} from '../../constants/cog-viewer.constants';
import type {
  CogBandSelection,
  CogExportFormat,
  CogLoadedFile,
  CogMetadataRow,
  CogStretchMode,
  CogWindowOptions
} from '../../types/cog-viewer.types';
import {
  analyzeCogCompliance,
  bandOptions,
  canExportCog,
  configureLeafletDefaultIcons,
  createCogFileRecord,
  createOrUpdateImageOverlay,
  createSampleCogFile,
  downloadBinaryFile,
  downloadTextFile,
  ensureCogStylesheet,
  exportMetadataJson,
  exportSummaryJson,
  filterValidCogFiles,
  fitMapToGeotiff,
  formatBounds,
  formatCogFileSize,
  loadLeaflet,
  metadataRows,
  openAndParseCog,
  openAndParseCogFromUrl,
  readCogFileBytes,
  reRenderCogPreview,
  resolveCogSuggestion
} from '../../utils/cog-viewer.utils';
import { buildGeotiffStats } from '../../utils/geotiff-raster.utils';

@Component({
  selector: 'lib-cog-viewer',
  standalone: true,
  templateUrl: './cog-viewer.html',
  styleUrls: ['./cog-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CogViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = COG_ACCEPT_ATTR;
  readonly relatedTools = COG_RELATED_TOOLS;
  readonly supportedExtensions = COG_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = COG_FORMATS_LABEL;
  readonly formatsHint = COG_FORMATS_HINT;
  readonly stretchModes: CogStretchMode[] = ['none', 'minmax', 'percentile'];

  cogFiles: CogLoadedFile[] = [];
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
  metaRows: CogMetadataRow[] = [];
  remoteUrl = '';

  bandSelection: CogBandSelection = { red: 0, green: 1, blue: 2, grayscale: false };
  stretchMode: CogStretchMode = 'minmax';
  opacity = 0.85;
  imageIndex = 0;
  windowOpts: CogWindowOptions = {
    enabled: false,
    maxWindowSize: COG_DEFAULT_WINDOW_SIZE
  };

  private map: LeafletMap | null = null;
  private baseLayer: TileLayer | null = null;
  private imageOverlay: ImageOverlay | null = null;
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private renderToken = 0;

  get currentFile(): CogLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.cogFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportCog(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get stats() {
    return this.currentFile?.stats ?? null;
  }

  get cogFlags() {
    return this.currentFile?.cog ?? null;
  }

  get bandChoices(): number[] {
    return bandOptions(this.currentFile?.metadata.samplesPerPixel ?? 1);
  }

  get overviewChoices(): Array<{ index: number; label: string }> {
    const overs = this.currentFile?.metadata.overviews ?? [];
    return overs.map((o) => ({
      index: o.index,
      label: o.index === 0 ? `Full (${o.width}×${o.height})` : `Overview ${o.index} (${o.width}×${o.height})`
    }));
  }

  get primarySuggestion() {
    const suggestion = resolveCogSuggestion({
      hasFiles: this.cogFiles.length > 0,
      hasError: !!this.errorMessage,
      softCompliant: this.cogFlags ? this.cogFlags.softCompliant : null
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
    ensureCogStylesheet(this.assetService.getAssetPath('leaflet/leaflet.css'));
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

  trackByFileId(_index: number, file: CogLoadedFile): string {
    return file.id;
  }

  trackByMetaKey(_index: number, row: CogMetadataRow): string {
    return row.key;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByCheckId(_index: number, item: { id: string }): string {
    return item.id;
  }

  formatSize(bytes: number): string {
    return formatCogFileSize(bytes);
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

  async handleFiles(files: File[], options: { isSample?: boolean } = {}): Promise<void> {
    const { accepted, rejected } = filterValidCogFiles(files);
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
        const bytes = await readCogFileBytes(file);
        let parsed;
        try {
          parsed = await openAndParseCog(bytes, file.name, {
            bands: this.bandSelection,
            stretch: this.stretchMode,
            imageIndex: this.imageIndex,
            window: this.windowOpts,
            isSample: !!options.isSample
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid COG / GeoTIFF';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
          continue;
        }
        this.bandSelection = parsed.bands;
        this.imageIndex = parsed.imageIndex;
        const record = createCogFileRecord(
          file,
          bytes,
          parsed.metadata,
          parsed.warnings,
          parsed.preview
        );
        const existing = this.cogFiles.findIndex((item) => item.id === record.id);
        if (existing >= 0) {
          this.cogFiles[existing] = record;
          this.currentFileIndex = existing;
        } else {
          this.cogFiles = [...this.cogFiles, record];
          this.currentFileIndex = this.cogFiles.length - 1;
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
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load COG file';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    const sample = createSampleCogFile();
    await this.handleFiles([sample], { isSample: true });
  }

  onRemoteUrlInput(event: Event): void {
    this.remoteUrl = (event.target as HTMLInputElement).value;
  }

  async loadRemoteUrl(): Promise<void> {
    if (!this.remoteUrl.trim()) {
      this.toast.error('Enter a URL to a GeoTIFF / COG');
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    try {
      const parsed = await openAndParseCogFromUrl(this.remoteUrl, {
        bands: this.bandSelection,
        stretch: this.stretchMode,
        imageIndex: this.imageIndex,
        window: this.windowOpts
      });
      this.bandSelection = parsed.bands;
      this.imageIndex = parsed.imageIndex;
      const fakeFile = new File([parsed.bytes as BlobPart], parsed.name, {
        type: 'image/tiff',
        lastModified: 0
      });
      const record = createCogFileRecord(
        fakeFile,
        parsed.bytes,
        parsed.metadata,
        parsed.warnings,
        parsed.preview
      );
      // Remote records use URL in id so duplicates replace.
      record.id = `url|${this.remoteUrl.trim()}`;
      const existing = this.cogFiles.findIndex((item) => item.id === record.id);
      if (existing >= 0) {
        this.cogFiles[existing] = record;
        this.currentFileIndex = existing;
      } else {
        this.cogFiles = [...this.cogFiles, record];
        this.currentFileIndex = this.cogFiles.length - 1;
      }
      await this.renderCurrentFile();
      this.toast.success(`Loaded ${record.name}`);
      this.toast.info('Remote loads need CORS; prefer uploading if fetch fails.');
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to load remote COG (check CORS / URL)';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.cogFiles.length || index === this.currentFileIndex) {
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
    if (index < 0 || index >= this.cogFiles.length) {
      return;
    }
    const next = this.cogFiles.filter((_, i) => i !== index);
    this.cogFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    void this.renderCurrentFile();
  }

  clearAll(): void {
    this.destroyMap();
    this.cogFiles = [];
    this.currentFileIndex = -1;
    this.metaRows = [];
    this.errorMessage = '';
    this.zoomPercent = 100;
    this.imageIndex = 0;
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

  exportAs(format: CogExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      return;
    }
    const base = current.name.replace(/\.(tif|tiff|geotiff)$/i, '') || 'cog';
    if (format === 'geotiff') {
      if (!current.bytes.length) {
        this.toast.error('Original bytes unavailable for this remote load');
        return;
      }
      downloadBinaryFile(current.bytes, `${base}.tif`, 'image/tiff');
      this.toast.success('Exported GeoTIFF / COG');
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
    this.bandSelection = { ...this.bandSelection, [channel]: value, grayscale: false };
    void this.refreshOverlay();
  }

  onGrayscaleToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.bandSelection = { ...this.bandSelection, grayscale: checked };
    void this.refreshOverlay();
  }

  onStretchChange(event: Event): void {
    this.stretchMode = (event.target as HTMLSelectElement).value as CogStretchMode;
    void this.refreshOverlay();
  }

  onOpacityChange(event: Event): void {
    this.opacity = Number((event.target as HTMLInputElement).value) / 100;
    if (this.imageOverlay) {
      this.imageOverlay.setOpacity(this.opacity);
    }
    this.cdr.markForCheck();
  }

  onImageIndexChange(event: Event): void {
    this.imageIndex = Number((event.target as HTMLSelectElement).value);
    void this.refreshOverlay({ reloadMetadata: true });
  }

  onWindowEnabledChange(event: Event): void {
    this.windowOpts = {
      ...this.windowOpts,
      enabled: (event.target as HTMLInputElement).checked
    };
    void this.refreshOverlay();
  }

  onWindowSizeChange(event: Event): void {
    const size = Number((event.target as HTMLInputElement).value);
    this.windowOpts = {
      ...this.windowOpts,
      maxWindowSize: Number.isFinite(size) && size > 0 ? Math.floor(size) : COG_DEFAULT_WINDOW_SIZE
    };
    if (this.windowOpts.enabled) {
      void this.refreshOverlay();
    } else {
      this.cdr.markForCheck();
    }
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
      fitMapToGeotiff(this.map, L, this.stats);
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

  private async refreshOverlay(options: { reloadMetadata?: boolean } = {}): Promise<void> {
    const current = this.currentFile;
    if (!current || !this.isBrowser) {
      return;
    }
    if (!current.bytes.length) {
      this.toast.info('Re-load the remote URL to apply band / window changes.');
      if (this.imageOverlay) {
        this.imageOverlay.setOpacity(this.opacity);
      }
      this.cdr.markForCheck();
      return;
    }
    const token = ++this.renderToken;
    this.loading = true;
    this.cdr.markForCheck();
    try {
      if (options.reloadMetadata) {
        const parsed = await openAndParseCog(current.bytes, current.name, {
          bands: this.bandSelection,
          stretch: this.stretchMode,
          imageIndex: this.imageIndex,
          window: this.windowOpts
        });
        if (token !== this.renderToken) {
          return;
        }
        current.metadata = parsed.metadata;
        current.warnings = parsed.warnings;
        current.cog = analyzeCogCompliance(parsed.metadata);
        current.stats = buildGeotiffStats(parsed.metadata, current.name);
        current.previewDataUrl = parsed.preview.dataUrl;
        current.previewWidth = parsed.preview.width;
        current.previewHeight = parsed.preview.height;
        this.metaRows = metadataRows(current.metadata);
      } else {
        const preview = await reRenderCogPreview(
          current.bytes,
          current.metadata,
          this.bandSelection,
          this.stretchMode,
          this.imageIndex,
          this.windowOpts
        );
        if (token !== this.renderToken) {
          return;
        }
        current.previewDataUrl = preview.dataUrl;
        current.previewWidth = preview.width;
        current.previewHeight = preview.height;
      }
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

  private async applyOverlay(current: CogLoadedFile): Promise<void> {
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
    fitMapToGeotiff(this.map, L, current.stats);
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
