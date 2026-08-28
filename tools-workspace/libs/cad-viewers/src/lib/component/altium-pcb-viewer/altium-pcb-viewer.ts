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
  AL_ACCEPT_ATTR,
  AL_FORMATS_HINT,
  AL_FORMATS_LABEL,
  AL_RELATED_TOOLS,
  AL_SUPPORTED_EXTENSIONS
} from '../../constants/altium-pcb-viewer.constants';
import type { AlCopper, AlColumn, AlExportFormat, AlLayer, AlLoadedFile, AlDesignator, AlViewMode } from '../../types/altium-pcb-viewer.types';
import {
  buildCadInsightStats,
  clampCadZoom,
  observeCadDocumentTheme,
  type CadViewTransform
} from '../../utils/cad-file.utils';
import {
  buildAlCopperMetadata,
  buildAlLayerMetadata,
  buildAlMetadataRows,
  buildAlDesMetadata,
  canExportAl,
  canvasToPngDataUrl,
  createAlFileRecord,
  createSampleAlFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  alTypeColor,
  exportAlRowsCsv,
  exportAlSchemaCsv,
  exportAlSummaryJson,
  filterAlCoppers,
  filterAlLayers,
  filterAlRows,
  filterAlDesignators,
  filterValidAlFiles,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatAlFileSize,
  readAlFileBytes,
  renderAlCopper,
  renderAlDes,
  resolveAlSuggestion,
  toAlCopperGeom,
  toAlDesGeom
} from '../../utils/altium-pcb-viewer.utils';

@Component({
  selector: 'lib-altium-pcb-viewer',
  standalone: true,
  templateUrl: './altium-pcb-viewer.html',
  styleUrls: ['./altium-pcb-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AltiumPcbViewerComponent implements AfterViewInit, OnDestroy {
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

  readonly acceptAttr = AL_ACCEPT_ATTR;
  readonly relatedTools = AL_RELATED_TOOLS;
  readonly supportedExtensions = AL_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = AL_FORMATS_LABEL;
  readonly formatsHint = AL_FORMATS_HINT;
  readonly viewModes: Array<{ id: AlViewMode; label: string }> = [
    { id: 'copper', label: 'Copper' },
    { id: 'designators', label: 'Designators' },
    { id: 'stack', label: 'Stack' },
    { id: 'table', label: 'Rows' }
  ];

  files: AlLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: AlViewMode = 'copper';
  query = '';
  selectedLayerId = '';
  selectedCopperId = '';
  selectedDesId = '';
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

  get currentFile(): AlLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportAl(this.currentFile);
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

  get filteredLayers(): AlLayer[] {
    return this.parsed ? filterAlLayers(this.parsed.layers, this.query) : [];
  }

  get filteredCoppers(): AlCopper[] {
    return this.parsed ? filterAlCoppers(this.parsed.coppers, this.query) : [];
  }

  get filteredDesignators(): AlDesignator[] {
    return this.parsed ? filterAlDesignators(this.parsed.designators, this.query) : [];
  }

  get filteredColumns(): AlColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterAlRows(this.parsed.rows, this.query) : [];
  }

  get visibleCoppers(): AlCopper[] {
    return this.filteredCoppers.filter((e) => !this.hiddenLayerIds.has(e.layer));
  }

  get selectedLayer(): AlLayer | null {
    return this.filteredLayers.find((l) => l.id === this.selectedLayerId) ?? null;
  }

  get selectedCopper(): AlCopper | null {
    return this.filteredCoppers.find((e) => e.id === this.selectedCopperId) ?? null;
  }

  get selectedDes(): AlDesignator | null {
    return this.filteredDesignators.find((e) => e.id === this.selectedDesId) ?? null;
  }

  get plotSelectedId(): string | null {
    if (this.viewMode === 'copper') return this.selectedCopperId || null;
    if (this.viewMode === 'designators') return this.selectedDesId || null;
    if (this.viewMode === 'stack' && this.selectedLayerId) {
      return this.visibleCoppers.find((e) => e.layer === this.selectedLayerId)?.id ?? null;
    }
    return this.selectedCopperId || null;
  }

  get metadataRows() {
    return this.parsed ? buildAlMetadataRows(this.parsed) : [];
  }

  get layerMetadataRows() {
    return this.selectedLayer ? buildAlLayerMetadata(this.selectedLayer) : [];
  }

  get copperMetadataRows() {
    return this.selectedCopper ? buildAlCopperMetadata(this.selectedCopper) : [];
  }

  get desMetadataRows() {
    return this.selectedDes ? buildAlDesMetadata(this.selectedDes) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedCopperId || this.selectedDesId || this.selectedLayerId);
  }

  get primarySuggestion() {
    const s = resolveAlSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
  // Host listeners (drag / keyboard / fullscreen / export menu)
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
      else if (this.viewMode === 'stack') this.shiftLayer(1);
      else if (this.viewMode === 'designators') this.shiftDes(1);
      else this.shiftCopper(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'stack') this.shiftLayer(-1);
      else if (this.viewMode === 'designators') this.shiftDes(-1);
      else this.shiftCopper(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.clearSearch();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy / formatting helpers
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: AlLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByLayer(_i: number, layer: AlLayer): string {
    return layer.id;
  }

  trackByCopper(_i: number, item: AlCopper): string {
    return item.id;
  }

  trackByDes(_i: number, item: AlDesignator): string {
    return item.id;
  }

  trackByColumn(_i: number, column: AlColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  tint(type: string, index: number): string {
    return alTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isLayerHidden(id: string): boolean {
    return this.hiddenLayerIds.has(id);
  }

  formatSize(bytes: number): string {
    return formatAlFileSize(bytes);
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
    const { accepted, rejected } = filterValidAlFiles(files);
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
          const bytes = await readAlFileBytes(file);
          const record = createAlFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Altium dump'}`;
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
    await this.handleFiles([createSampleAlFile()]);
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
    this.selectedCopperId = '';
    this.selectedDesId = '';
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

  setViewMode(mode: AlViewMode): void {
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

  exportAs(format: AlExportFormat, event: Event): void {
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
        downloadTextFile(exportAlSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      } else if (format === 'schema-csv') {
        downloadTextFile(exportAlSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      } else if (format === 'rows-csv') {
        downloadTextFile(exportAlRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Copper, Designators, or Stack to export a PNG snapshot');
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

  selectCopper(id: string): void {
    this.selectedCopperId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectDes(id: string): void {
    this.selectedDesId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (row?.name) {
      if (row.type === 'designator' || row.type === 'text' || row.type === 'component') {
        const hit = this.filteredDesignators.find((d) => d.name === row.name || d.id === row.name);
        this.selectedDesId = hit?.id ?? '';
      } else {
        const hit = this.filteredCoppers.find((c) => c.name === row.name || c.id === row.name);
        this.selectedCopperId = hit?.id ?? row.name;
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
      this.selectedLayerId = this.filteredLayers[0]?.id ?? '';
    }
    if (this.selectedCopperId && !this.filteredCoppers.some((e) => e.id === this.selectedCopperId)) {
      this.selectedCopperId = this.filteredCoppers[0]?.id ?? '';
    }
    if (this.selectedDesId && !this.filteredDesignators.some((e) => e.id === this.selectedDesId)) {
      this.selectedDesId = this.filteredDesignators[0]?.id ?? '';
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
    this.selectedCopperId = '';
    this.selectedDesId = '';
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
    const geom =
      this.viewMode === 'designators' ? toAlDesGeom(this.filteredDesignators) : toAlCopperGeom(this.visibleCoppers);
    this.view = fitCadView(geom, width, height);
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
    const geom =
      this.viewMode === 'designators' ? toAlDesGeom(this.filteredDesignators) : toAlCopperGeom(this.visibleCoppers);
    const id = pickCadEntityAtScreen(geom, this.view, canvas.height, sx, sy);
    if (!id) this.clearSelection();
    else if (this.viewMode === 'designators') this.selectDes(id);
    else this.selectCopper(id);
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

  private shiftCopper(delta: number): void {
    const list = this.filteredCoppers;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedCopperId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectCopper(next.id);
  }

  private shiftDes(delta: number): void {
    const list = this.filteredDesignators;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedDesId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectDes(next.id);
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
    this.selectedCopperId = this.parsed?.coppers[0]?.id ?? '';
    this.selectedDesId = this.parsed?.designators[0]?.id ?? '';
    this.selectedRowIndex = 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    if (this.viewMode === 'designators') {
      renderAlDes(canvas, this.filteredDesignators, this.plotSelectedId, this.view);
    } else {
      renderAlCopper(canvas, this.visibleCoppers, this.plotSelectedId, this.view);
    }
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
