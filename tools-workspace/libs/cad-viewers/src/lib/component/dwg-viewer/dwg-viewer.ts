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
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, StatValueTooltipHostDirective, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import {
  DW_ACCEPT_ATTR,
  DW_FORMATS_HINT,
  DW_FORMATS_LABEL,
  DW_RELATED_TOOLS,
  DW_SUPPORTED_EXTENSIONS
} from '../../constants/dwg-viewer.constants';
import type {
  DwColumn,
  DwEntity,
  DwExportFormat,
  DwLayer,
  DwLoadedFile,
  DwMeasurement,
  DwViewMode
} from '../../types/dwg-viewer.types';
import {
  buildCadInsightStats,
  clampCadZoom,
  observeCadDocumentTheme,
  type CadViewTransform
} from '../../utils/cad-file.utils';
import {
  buildDwEntityMetadata,
  buildDwLayerMetadata,
  buildDwMeasMetadata,
  buildDwMetadataRows,
  canExportDw,
  canvasToPngDataUrl,
  createDwFileRecord,
  createSampleDwFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  dwTypeColor,
  exportDwRowsCsv,
  exportDwSchemaCsv,
  exportDwSummaryJson,
  filterDwEntities,
  filterDwLayers,
  filterDwMeasurements,
  filterDwRows,
  filterValidDwFiles,
  fitCadView,
  formatDwFileSize,
  pickCadEntityAtScreen,
  readDwFileBytes,
  renderDwDrawing,
  resolveDwSuggestion,
  sizeCadCanvas,
  toCadGeom
} from '../../utils/dwg-viewer.utils';

@Component({
  selector: 'lib-dwg-viewer',
  standalone: true,
  templateUrl: './dwg-viewer.html',
  styleUrls: ['./dwg-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DwgViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('viewerPanel') viewerPanel?: ElementRef<HTMLElement>;

  readonly acceptAttr = DW_ACCEPT_ATTR;
  readonly relatedTools = DW_RELATED_TOOLS;
  readonly supportedExtensions = DW_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = DW_FORMATS_LABEL;
  readonly formatsHint = DW_FORMATS_HINT;
  readonly viewModes: Array<{ id: DwViewMode; label: string }> = [
    { id: 'layers', label: 'Layers' },
    { id: 'measurements', label: 'Measurements' },
    { id: 'preview', label: 'Preview' },
    { id: 'table', label: 'Rows' }
  ];

  files: DwLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: DwViewMode = 'layers';
  query = '';
  selectedLayerId = '';
  selectedMeasId = '';
  selectedEntityId = '';
  selectedRowIndex = 0;
  hiddenLayerIds = new Set<string>();
  view: CadViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  panning = false;
  isFullscreen = false;

  private dragDepth = 0;
  private lastX = 0;
  private lastY = 0;
  private pointerMoved = 0;
  private resizeObserver: ResizeObserver | null = null;
  private stopThemeWatch: (() => void) | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): DwLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportDw(this.currentFile);
  }

  get insights() {
    return buildCadInsightStats(
      this.parsed as Record<string, unknown> | null,
      this.files.length,
      this.currentFile?.size ?? null,
      this.warnings,
      (n) => this.formatSize(n)
    );
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get filteredLayers(): DwLayer[] {
    return this.parsed ? filterDwLayers(this.parsed.layers, this.query) : [];
  }

  get filteredMeasurements(): DwMeasurement[] {
    return this.parsed ? filterDwMeasurements(this.parsed.measurements, this.query) : [];
  }

  get filteredEntities(): DwEntity[] {
    return this.parsed ? filterDwEntities(this.parsed.entities, this.query) : [];
  }

  get filteredColumns(): DwColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterDwRows(this.parsed.rows, this.query) : [];
  }

  get visibleEntities(): DwEntity[] {
    if (!this.hiddenLayerIds.size) return this.filteredEntities;
    return this.filteredEntities.filter((e) => !this.isLayerKeyHidden(e.layer));
  }

  get visibleMeasurements(): DwMeasurement[] {
    if (!this.hiddenLayerIds.size) return this.filteredMeasurements;
    return this.filteredMeasurements.filter((m) => !this.isLayerKeyHidden(m.layer));
  }

  get selectedLayer(): DwLayer | null {
    return this.filteredLayers.find((l) => l.id === this.selectedLayerId) ?? null;
  }

  get selectedMeas(): DwMeasurement | null {
    return this.filteredMeasurements.find((m) => m.id === this.selectedMeasId) ?? null;
  }

  get selectedEntity(): DwEntity | null {
    return this.filteredEntities.find((e) => e.id === this.selectedEntityId) ?? null;
  }

  get drawingSelectedId(): string | null {
    if (this.selectedEntityId && this.visibleEntities.some((e) => e.id === this.selectedEntityId)) {
      return this.selectedEntityId;
    }
    if (this.viewMode === 'layers' && this.selectedLayerId) {
      const layer = this.selectedLayer;
      return (
        this.visibleEntities.find(
          (e) => e.layer === this.selectedLayerId || (!!layer && e.layer === layer.name)
        )?.id ?? null
      );
    }
    if (this.viewMode === 'measurements' && this.selectedMeas) {
      const value = this.selectedMeas.value;
      return this.visibleEntities.find((e) => Math.abs(e.length - value) < 0.05)?.id ?? null;
    }
    return this.selectedEntityId || null;
  }

  get hasSelection(): boolean {
    if (this.viewMode === 'layers') return !!this.selectedLayerId;
    if (this.viewMode === 'measurements') return !!this.selectedMeasId;
    return !!this.selectedEntityId;
  }

  get hasFilterHits(): boolean {
    if (!this.query.trim()) return true;
    if (this.viewMode === 'layers') return this.filteredLayers.length > 0;
    if (this.viewMode === 'measurements') return this.filteredMeasurements.length > 0;
    if (this.viewMode === 'table') return this.filteredRows.length > 0;
    return this.filteredEntities.length > 0;
  }

  get metadataRows() {
    return this.parsed ? buildDwMetadataRows(this.parsed) : [];
  }

  get layerMetadataRows() {
    return this.selectedLayer ? buildDwLayerMetadata(this.selectedLayer) : [];
  }

  get measMetadataRows() {
    return this.selectedMeas ? buildDwMeasMetadata(this.selectedMeas) : [];
  }

  get entityMetadataRows() {
    return this.selectedEntity ? buildDwEntityMetadata(this.selectedEntity) : [];
  }

  get primarySuggestion() {
    const s = resolveDwSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(type: string, index: number): string {
    return dwTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isLayerHidden(id: string): boolean {
    return this.hiddenLayerIds.has(id);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.observeCanvasResize();
    this.stopThemeWatch = observeCadDocumentTheme(() => {
      this.renderCanvas();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.stopThemeWatch?.();
    this.stopThemeWatch = null;
  }

  // ---------------------------------------------------------------------------
  // Host listeners
  // ---------------------------------------------------------------------------

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    if (!this.isBrowser) return;
    this.isFullscreen = !!document.fullscreenElement;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (!this.showExportMenu) return;
    this.showExportMenu = false;
    this.cdr.markForCheck();
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isBrowser || !this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isBrowser || !this.isFileDrag(event)) return;
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isBrowser || !this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (!this.isBrowser || !this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) await this.handleFiles(Array.from(files));
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isBrowser) return;
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    if (!this.parsed) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (this.isFullscreen) void document.exitFullscreen?.();
      else this.clearSelection();
    } else if (event.key === '0') {
      event.preventDefault();
      this.fitView();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomBy(1.2);
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomBy(1 / 1.2);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'preview' || this.viewMode === 'table') this.shiftRow(1);
      else if (this.viewMode === 'measurements') this.shiftMeas(1);
      else this.shiftLayer(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'preview' || this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'measurements') this.shiftMeas(-1);
      else this.shiftLayer(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.clearSearch();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy / formatters
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: DwLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByLayer(_i: number, layer: DwLayer): string {
    return layer.id;
  }

  trackByMeas(_i: number, meas: DwMeasurement): string {
    return meas.id;
  }

  trackByEntity(_i: number, entity: DwEntity): string {
    return entity.id;
  }

  trackByColumn(_i: number, column: DwColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatDwFileSize(bytes);
  }

  // ---------------------------------------------------------------------------
  // File load / selection
  // ---------------------------------------------------------------------------

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
    const { accepted, rejected } = filterValidDwFiles(files);
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    try {
      for (const file of accepted) {
        try {
          const bytes = await readDwFileBytes(file);
          const record = createDwFileRecord(file, bytes);
          const existing = this.files.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.files[existing] = record;
            this.currentIndex = existing;
          } else {
            this.files = [...this.files, record];
            this.currentIndex = this.files.length - 1;
          }
          this.resetViewForCurrent();
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid DWG dump'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.fitView();
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no drawable geometry — metadata may still be available');
        } else if (this.currentFile.warnings.length) {
          this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
        }
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleDwFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.fitView();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.files.length) return;
    const next = this.files.filter((_, i) => i !== index);
    this.files = next;
    if (!next.length) {
      this.clearAll();
      return;
    }
    this.currentIndex = Math.min(index, next.length - 1);
    this.resetViewForCurrent();
    this.fitView();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedLayerId = '';
    this.selectedMeasId = '';
    this.selectedEntityId = '';
    this.selectedRowIndex = 0;
    this.hiddenLayerIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
    this.view = { scale: 1, offsetX: 0, offsetY: 0 };
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Suggestions / view mode / sidebar / export
  // ---------------------------------------------------------------------------

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setViewMode(mode: DwViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.fitView();
      this.renderCanvas();
    }, 0);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.fitView();
      this.renderCanvas();
    }, 0);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    if (!this.canExport) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: DwExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportDwSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportDwSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportDwRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Layers, Measurements, or Preview to export a PNG snapshot');
          this.cdr.markForCheck();
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (!url) {
          this.toast.error('Could not capture PNG snapshot');
          this.cdr.markForCheck();
          return;
        }
        downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Selection / filter / layers
  // ---------------------------------------------------------------------------

  selectLayer(id: string): void {
    this.selectedLayerId = id;
    const entity = this.visibleEntities.find((e) => e.layer === id || e.layer === this.selectedLayer?.name);
    if (entity) this.selectedEntityId = entity.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectMeas(id: string): void {
    this.selectedMeasId = id;
    const meas = this.filteredMeasurements.find((m) => m.id === id);
    if (meas?.layer) this.syncSelectedLayerFromKey(meas.layer);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectEntity(id: string): void {
    this.selectedEntityId = id;
    const entity = this.filteredEntities.find((e) => e.id === id);
    if (entity?.layer) this.syncSelectedLayerFromKey(entity.layer);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (row?.name) {
      const entity = this.filteredEntities.find((e) => e.id === row.name || e.name === row.name);
      if (entity) {
        this.selectedEntityId = entity.id;
        if (entity.layer) this.syncSelectedLayerFromKey(entity.layer);
      } else {
        const meas = this.filteredMeasurements.find((m) => m.id === row.name || m.name === row.name);
        if (meas) {
          this.selectedMeasId = meas.id;
          if (meas.layer) this.syncSelectedLayerFromKey(meas.layer);
        } else {
          this.syncSelectedLayerFromKey(row.name);
        }
      }
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleLayerVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenLayerIds.has(id)) this.hiddenLayerIds.delete(id);
    else this.hiddenLayerIds.add(id);
    this.hiddenLayerIds = new Set(this.hiddenLayerIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedLayerId && !this.filteredLayers.some((l) => l.id === this.selectedLayerId)) {
      this.selectedLayerId = '';
    }
    if (this.selectedMeasId && !this.filteredMeasurements.some((m) => m.id === this.selectedMeasId)) {
      this.selectedMeasId = '';
    }
    if (this.selectedEntityId && !this.filteredEntities.some((e) => e.id === this.selectedEntityId)) {
      this.selectedEntityId = '';
    }
    if (this.selectedRowIndex >= this.filteredRows.length) {
      this.selectedRowIndex = Math.max(0, this.filteredRows.length - 1);
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.query = '';
    this.onFilterChange();
  }

  clearSelection(): void {
    this.selectedLayerId = '';
    this.selectedMeasId = '';
    this.selectedEntityId = '';
    this.selectedRowIndex = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  isolateSelected(): void {
    if (!this.selectedLayerId || !this.parsed) return;
    this.hiddenLayerIds = new Set(this.parsed.layers.filter((l) => l.id !== this.selectedLayerId).map((l) => l.id));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  showAllLayers(): void {
    if (!this.hiddenLayerIds.size) return;
    this.hiddenLayerIds = new Set();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Canvas / view controls
  // ---------------------------------------------------------------------------

  fitView(): void {
    if (!this.isBrowser || !this.parsed || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const { width, height } = sizeCadCanvas(canvas);
    this.view = fitCadView(toCadGeom(this.visibleEntities), width, height);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetView(): void {
    this.fitView();
  }

  zoomBy(factor: number): void {
    if (!this.isBrowser || !this.parsed || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const sx = canvas.width / 2;
    const sy = canvas.height / 2;
    const next = clampCadZoom(this.view.scale * factor);
    const applied = next / this.view.scale;
    this.view = {
      scale: next,
      offsetX: sx * (1 - applied) + this.view.offsetX * applied,
      offsetY: (canvas.height - sy) * (1 - applied) + this.view.offsetY * applied
    };
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.isBrowser) return;
    const host = this.viewerPanel?.nativeElement;
    if (!host) return;
    const requestFs = host.requestFullscreen?.bind(host);
    if (!requestFs) {
      this.toast.info('Fullscreen is not available in this browser');
      return;
    }
    try {
      if (!document.fullscreenElement) await requestFs();
      else await document.exitFullscreen();
    } catch {
      this.toast.info('Fullscreen is not available in this browser');
    }
  }

  onCanvasPointerDown(event: PointerEvent): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    this.panning = true;
    this.pointerMoved = 0;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.isBrowser || !this.panning) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.pointerMoved += Math.abs(dx) + Math.abs(dy);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.view = { ...this.view, offsetX: this.view.offsetX + dx, offsetY: this.view.offsetY - dy };
    this.renderCanvas();
  }

  onCanvasPointerUp(event?: PointerEvent): void {
    if (!this.isBrowser) return;
    const wasClick = this.panning && this.pointerMoved <= 8;
    this.panning = false;
    if (!wasClick || !event || !this.parsed || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const id = pickCadEntityAtScreen(toCadGeom(this.visibleEntities), this.view, canvas.height, sx, sy);
    if (id) this.selectEntity(id);
    else this.clearSelection();
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.isBrowser || !this.parsed || this.viewMode === 'table') return;
    event.preventDefault();
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const height = canvas.height;
    const nextScale = clampCadZoom(this.view.scale * factor);
    const appliedScale = nextScale / Math.max(1e-9, this.view.scale);
    this.view = {
      scale: nextScale,
      offsetX: sx * (1 - appliedScale) + this.view.offsetX * appliedScale,
      offsetY: (height - sy) * (1 - appliedScale) + this.view.offsetY * appliedScale
    };
    this.renderCanvas();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private isLayerKeyHidden(layerKey: string): boolean {
    if (this.hiddenLayerIds.has(layerKey)) return true;
    const layer = this.parsed?.layers.find((l) => l.id === layerKey || l.name === layerKey);
    return !!layer && this.hiddenLayerIds.has(layer.id);
  }

  private syncSelectedLayerFromKey(layerKey: string): void {
    const layer = this.filteredLayers.find((l) => l.id === layerKey || l.name === layerKey);
    if (layer) this.selectedLayerId = layer.id;
  }

  private shiftLayer(delta: number): void {
    const list = this.filteredLayers;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((l) => l.id === this.selectedLayerId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLayer(next.id);
  }

  private shiftMeas(delta: number): void {
    const list = this.visibleMeasurements;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((m) => m.id === this.selectedMeasId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectMeas(next.id);
  }

  private shiftRow(delta: number): void {
    if (this.viewMode === 'preview') {
      const list = this.visibleEntities;
      if (!list.length) return;
      const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedEntityId));
      const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
      if (next) this.selectEntity(next.id);
      return;
    }
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenLayerIds = new Set();
    this.selectedLayerId = this.parsed?.layers[0]?.id ?? '';
    this.selectedMeasId = this.parsed?.measurements[0]?.id ?? '';
    this.selectedEntityId = this.parsed?.entities[0]?.id ?? '';
    this.selectedRowIndex = 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    renderDwDrawing(canvas, this.visibleEntities, this.drawingSelectedId, this.view);
  }

  private clearCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private observeCanvasResize(): void {
    const host = this.mapWrap?.nativeElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.renderCanvas());
    this.resizeObserver.observe(host);
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types?.includes('Files');
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }
}
