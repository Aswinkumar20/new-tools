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
  GD_ACCEPT_ATTR,
  GD_FORMATS_HINT,
  GD_FORMATS_LABEL,
  GD_RELATED_TOOLS,
  GD_SUPPORTED_EXTENSIONS
} from '../../constants/gdsii-layout-viewer.constants';
import type { GdColumn, GdFeature, GdExportFormat, GdLayer, GdLoadedFile, GdCell, GdViewMode } from '../../types/gdsii-layout-viewer.types';
import {
  buildCadInsightStats,
  clampCadZoom,
  observeCadDocumentTheme,
  type CadViewTransform
} from '../../utils/cad-file.utils';
import {
  buildGdFeatMetadata,
  buildGdLayerMetadata,
  buildGdCellMetadata,
  buildGdMetadataRows,
  canExportGd,
  canvasToPngDataUrl,
  createGdFileRecord,
  createSampleGdFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  gdTypeColor,
  exportGdRowsCsv,
  exportGdSchemaCsv,
  exportGdSummaryJson,
  filterGdFeatures,
  filterGdLayers,
  filterGdCells,
  filterGdRows,
  filterValidGdFiles,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatGdFileSize,
  readGdFileBytes,
  renderGdPlot,
  resolveGdSuggestion,
  toGdFeatGeom
} from '../../utils/gdsii-layout-viewer.utils';

@Component({
  selector: 'lib-gdsii-layout-viewer',
  standalone: true,
  templateUrl: './gdsii-layout-viewer.html',
  styleUrls: ['./gdsii-layout-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GdsiiLayoutViewerComponent implements AfterViewInit, OnDestroy {
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

  readonly acceptAttr = GD_ACCEPT_ATTR;
  readonly relatedTools = GD_RELATED_TOOLS;
  readonly supportedExtensions = GD_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = GD_FORMATS_LABEL;
  readonly formatsHint = GD_FORMATS_HINT;
  readonly viewModes: Array<{ id: GdViewMode; label: string }> = [
    { id: 'plot', label: 'Plot' },
    { id: 'layers', label: 'Layers' },
    { id: 'cells', label: 'Cells' },
    { id: 'table', label: 'Rows' }
  ];

  files: GdLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: GdViewMode = 'plot';
  query = '';
  selectedLayerId = '';
  selectedCellId = '';
  selectedFeatId = '';
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

  get currentFile(): GdLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportGd(this.currentFile);
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

  get filteredLayers(): GdLayer[] {
    return this.parsed ? filterGdLayers(this.parsed.layers, this.query) : [];
  }

  get filteredCells(): GdCell[] {
    return this.parsed ? filterGdCells(this.parsed.cells, this.query) : [];
  }

  get filteredFeatures(): GdFeature[] {
    return this.parsed ? filterGdFeatures(this.parsed.features, this.query) : [];
  }

  get filteredColumns(): GdColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterGdRows(this.parsed.rows, this.query) : [];
  }

  get visibleFeatures(): GdFeature[] {
    return this.filteredFeatures.filter((e) => !this.hiddenLayerIds.has(e.layer));
  }

  get selectedLayer(): GdLayer | null {
    return this.filteredLayers.find((l) => l.id === this.selectedLayerId) ?? null;
  }

  get selectedCell(): GdCell | null {
    return this.filteredCells.find((n) => n.id === this.selectedCellId) ?? null;
  }

  get selectedFeat(): GdFeature | null {
    return this.filteredFeatures.find((e) => e.id === this.selectedFeatId) ?? null;
  }

  get plotSelectedId(): string | null {
    if (this.viewMode === 'plot') return this.selectedFeatId || null;
    if (this.viewMode === 'cells' && this.selectedCellId) {
      const hit = this.visibleFeatures.find((e) => e.cell === this.selectedCellId);
      return hit?.id ?? this.selectedFeatId ?? null;
    }
    if (this.viewMode === 'layers' && this.selectedLayerId) {
      return this.visibleFeatures.find((e) => e.layer === this.selectedLayerId)?.id ?? null;
    }
    return this.selectedFeatId || null;
  }

  get metadataRows() {
    return this.parsed ? buildGdMetadataRows(this.parsed) : [];
  }

  get layerMetadataRows() {
    return this.selectedLayer ? buildGdLayerMetadata(this.selectedLayer) : [];
  }

  get cellMetadataRows() {
    return this.selectedCell ? buildGdCellMetadata(this.selectedCell) : [];
  }

  get featMetadataRows() {
    return this.selectedFeat ? buildGdFeatMetadata(this.selectedFeat) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedCellId || this.selectedFeatId || this.selectedLayerId);
  }

  get primarySuggestion() {
    const s = resolveGdSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
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
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) await this.handleFiles(Array.from(files));
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    if (!this.parsed) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.isFullscreen && this.isBrowser) void document.exitFullscreen?.();
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
    } else if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(1);
      else if (this.viewMode === 'plot') this.shiftFeat(1);
      else if (this.viewMode === 'cells') this.shiftCell(1);
      else this.shiftLayer(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'plot') this.shiftFeat(-1);
      else if (this.viewMode === 'cells') this.shiftCell(-1);
      else this.shiftLayer(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.clearSearch();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy / formatting
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: GdLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByLayer(_i: number, layer: GdLayer): string {
    return layer.id;
  }

  trackByCell(_i: number, cell: GdCell): string {
    return cell.id;
  }

  trackByFeat(_i: number, feat: GdFeature): string {
    return feat.id;
  }

  trackByColumn(_i: number, column: GdColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  tint(type: string, index: number): string {
    return gdTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isLayerHidden(id: string): boolean {
    return this.hiddenLayerIds.has(id);
  }

  formatSize(bytes: number): string {
    return formatGdFileSize(bytes);
  }

  // ---------------------------------------------------------------------------
  // File load / clear
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
    const { accepted, rejected } = filterValidGdFiles(files);
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
          const bytes = await readGdFileBytes(file);
          const record = createGdFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid GDSII dump'}`;
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
    await this.handleFiles([createSampleGdFile()]);
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
    this.showExportMenu = false;
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
    this.selectedCellId = '';
    this.selectedFeatId = '';
    this.selectedRowIndex = 0;
    this.hiddenLayerIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
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

  setViewMode(mode: GdViewMode): void {
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

  exportAs(format: GdExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') {
        downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      } else if (format === 'summary-json') {
        downloadTextFile(exportGdSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      } else if (format === 'schema-csv') {
        downloadTextFile(exportGdSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      } else if (format === 'rows-csv') {
        downloadTextFile(exportGdRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Plot, Layers, or Cells to export a PNG snapshot');
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
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectCell(id: string): void {
    this.selectedCellId = id;
    const hit = this.visibleFeatures.find((t) => t.cell === id);
    if (hit) this.selectedFeatId = hit.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectFeat(id: string): void {
    this.selectedFeatId = id;
    const feat = this.filteredFeatures.find((t) => t.id === id);
    if (feat?.cell) this.selectedCellId = feat.cell;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (row?.name) {
      const feat = this.filteredFeatures.find((e) => e.id === row.name || e.name === row.name);
      this.selectedFeatId = feat?.id ?? row.name;
      if (feat?.cell) this.selectedCellId = feat.cell;
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
      this.selectedLayerId = this.filteredLayers[0]?.id ?? '';
    }
    if (this.selectedCellId && !this.filteredCells.some((n) => n.id === this.selectedCellId)) {
      this.selectedCellId = this.filteredCells[0]?.id ?? '';
    }
    if (this.selectedFeatId && !this.filteredFeatures.some((e) => e.id === this.selectedFeatId)) {
      this.selectedFeatId = this.filteredFeatures[0]?.id ?? '';
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
    this.selectedCellId = '';
    this.selectedFeatId = '';
    this.selectedLayerId = '';
    this.selectedRowIndex = -1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  isolateSelected(): void {
    if (!this.selectedLayerId || !this.parsed) return;
    const layers = this.parsed.layers ?? [];
    this.hiddenLayerIds = new Set(layers.filter((l) => l.id !== this.selectedLayerId).map((l) => l.id));
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
  // View / canvas interaction
  // ---------------------------------------------------------------------------

  zoomBy(factor: number): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed || this.viewMode === 'table') return;
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

  resetView(): void {
    this.fitView();
  }

  fitView(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed || this.viewMode === 'table') return;
    const { width, height } = sizeCadCanvas(canvas);
    this.view = fitCadView(toGdFeatGeom(this.visibleFeatures), width, height);
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
    this.panning = true;
    this.pointerMoved = 0;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.panning) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.pointerMoved += Math.abs(dx) + Math.abs(dy);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.view = { ...this.view, offsetX: this.view.offsetX + dx, offsetY: this.view.offsetY - dy };
    this.renderCanvas();
  }

  onCanvasPointerUp(event?: PointerEvent): void {
    const wasClick = this.panning && this.pointerMoved <= 8;
    this.panning = false;
    if (!wasClick || !event || !this.parsed || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const id = pickCadEntityAtScreen(toGdFeatGeom(this.visibleFeatures), this.view, canvas.height, sx, sy);
    if (id) this.selectFeat(id);
    else this.clearSelection();
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.parsed || this.viewMode === 'table') return;
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

  private shiftLayer(delta: number): void {
    const list = this.filteredLayers;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((l) => l.id === this.selectedLayerId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLayer(next.id);
  }

  private shiftFeat(delta: number): void {
    const list = this.visibleFeatures;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedFeatId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectFeat(next.id);
  }

  private shiftCell(delta: number): void {
    const list = this.filteredCells;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedCellId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectCell(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    const base = this.selectedRowIndex < 0 ? 0 : this.selectedRowIndex;
    this.selectRow(Math.min(list.length - 1, Math.max(0, base + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenLayerIds = new Set();
    this.selectedLayerId = this.parsed?.layers[0]?.id ?? '';
    this.selectedCellId = this.parsed?.cells[0]?.id ?? '';
    this.selectedFeatId = this.parsed?.features[0]?.id ?? '';
    this.selectedRowIndex = 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    renderGdPlot(canvas, this.visibleFeatures, this.plotSelectedId, this.view);
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
