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
  PB_ACCEPT_ATTR,
  PB_FORMATS_HINT,
  PB_FORMATS_LABEL,
  PB_RELATED_TOOLS,
  PB_SUPPORTED_EXTENSIONS
} from '../../constants/pcb-layout-viewer.constants';
import type { PbColumn, PbExportFormat, PbLayer, PbLoadedFile, PbNet, PbTrace, PbViewMode } from '../../types/pcb-layout-viewer.types';
import {
  buildCadInsightStats,
  clampCadZoom,
  observeCadDocumentTheme,
  type CadViewTransform
} from '../../utils/cad-file.utils';
import {
  buildPbLayerMetadata,
  buildPbMetadataRows,
  buildPbNetMetadata,
  buildPbTraceMetadata,
  canExportPb,
  canvasToPngDataUrl,
  createPbFileRecord,
  createSamplePbFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportPbRowsCsv,
  exportPbSchemaCsv,
  exportPbSummaryJson,
  filterPbLayers,
  filterPbNets,
  filterPbRows,
  filterPbTraces,
  filterValidPbFiles,
  fitCadView,
  formatPbFileSize,
  pbTypeColor,
  pickCadEntityAtScreen,
  readPbFileBytes,
  renderPbPlot,
  resolvePbSuggestion,
  sizeCadCanvas,
  toCadGeom
} from '../../utils/pcb-layout-viewer.utils';

@Component({
  selector: 'lib-pcb-layout-viewer',
  standalone: true,
  templateUrl: './pcb-layout-viewer.html',
  styleUrls: ['./pcb-layout-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PcbLayoutViewerComponent implements AfterViewInit, OnDestroy {
  // ─── Dependencies ───────────────────────────────────────────────────────────
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // ─── View children ──────────────────────────────────────────────────────────
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('viewerPanel') viewerPanel?: ElementRef<HTMLElement>;

  // ─── Constants / labels ─────────────────────────────────────────────────────
  readonly acceptAttr = PB_ACCEPT_ATTR;
  readonly relatedTools = PB_RELATED_TOOLS;
  readonly supportedExtensions = PB_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PB_FORMATS_LABEL;
  readonly formatsHint = PB_FORMATS_HINT;
  readonly viewModes: Array<{ id: PbViewMode; label: string }> = [
    { id: 'plot', label: 'Plot' },
    { id: 'stack', label: 'Stack' },
    { id: 'nets', label: 'Nets' },
    { id: 'table', label: 'Rows' }
  ];

  // ─── File / parse state ─────────────────────────────────────────────────────
  files: PbLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';

  // ─── UI chrome ──────────────────────────────────────────────────────────────
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: PbViewMode = 'plot';
  query = '';
  isFullscreen = false;

  // ─── Selection / visibility ─────────────────────────────────────────────────
  selectedLayerId = '';
  selectedNetId = '';
  selectedTraceId = '';
  selectedRowIndex = 0;
  hiddenLayerIds = new Set<string>();

  // ─── Canvas interaction ─────────────────────────────────────────────────────
  view: CadViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  panning = false;

  private dragDepth = 0;
  private lastX = 0;
  private lastY = 0;
  private pointerMoved = 0;
  private resizeObserver: ResizeObserver | null = null;
  private stopThemeWatch: (() => void) | null = null;

  // ─── Derived state ──────────────────────────────────────────────────────────
  get currentFile(): PbLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportPb(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
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

  get filteredLayers(): PbLayer[] {
    return this.parsed ? filterPbLayers(this.parsed.layers, this.query) : [];
  }

  get filteredNets(): PbNet[] {
    return this.parsed ? filterPbNets(this.parsed.nets, this.query) : [];
  }

  get filteredTraces(): PbTrace[] {
    return this.parsed ? filterPbTraces(this.parsed.traces, this.query) : [];
  }

  get filteredColumns(): PbColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterPbRows(this.parsed.rows, this.query) : [];
  }

  get visibleTraces(): PbTrace[] {
    if (!this.hiddenLayerIds.size) return this.filteredTraces;
    return this.filteredTraces.filter((t) => !this.isLayerKeyHidden(t.layer));
  }

  get visibleNets(): PbNet[] {
    if (!this.hiddenLayerIds.size) return this.filteredNets;
    const nets = new Set(this.visibleTraces.map((t) => t.net).filter(Boolean));
    return this.filteredNets.filter((n) => nets.has(n.id) || nets.has(n.name));
  }

  get selectedLayer(): PbLayer | null {
    return this.filteredLayers.find((l) => l.id === this.selectedLayerId) ?? null;
  }

  get selectedNet(): PbNet | null {
    return this.filteredNets.find((n) => n.id === this.selectedNetId) ?? null;
  }

  get selectedTrace(): PbTrace | null {
    return this.filteredTraces.find((t) => t.id === this.selectedTraceId) ?? null;
  }

  get plotSelectedId(): string | null {
    if (this.viewMode === 'plot') return this.selectedTraceId || null;
    if (this.viewMode === 'nets' && this.selectedNetId) {
      const hit = this.visibleTraces.find((t) => t.net === this.selectedNetId || t.net === this.selectedNet?.name);
      return hit?.id ?? (this.selectedTraceId || null);
    }
    if (this.viewMode === 'stack' && this.selectedLayerId) {
      const layer = this.selectedLayer;
      return (
        this.visibleTraces.find((t) => t.layer === this.selectedLayerId || (!!layer && t.layer === layer.name))?.id ??
        null
      );
    }
    return this.selectedTraceId || null;
  }

  get metadataRows() {
    return this.parsed ? buildPbMetadataRows(this.parsed) : [];
  }

  get layerMetadataRows() {
    return this.selectedLayer ? buildPbLayerMetadata(this.selectedLayer) : [];
  }

  get netMetadataRows() {
    return this.selectedNet ? buildPbNetMetadata(this.selectedNet) : [];
  }

  get traceMetadataRows() {
    return this.selectedTrace ? buildPbTraceMetadata(this.selectedTrace) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedLayerId || this.selectedNetId || this.selectedTraceId);
  }

  get primarySuggestion() {
    const s = resolvePbSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────
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

  // ─── Host listeners ─────────────────────────────────────────────────────────
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
    if (event.key === 'Escape') {
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
    } else if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(1);
      else if (this.viewMode === 'plot') this.shiftTrace(1);
      else if (this.viewMode === 'nets') this.shiftNet(1);
      else this.shiftLayer(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'plot') this.shiftTrace(-1);
      else if (this.viewMode === 'nets') this.shiftNet(-1);
      else this.shiftLayer(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ─── TrackBy / format helpers ───────────────────────────────────────────────
  trackByFileId(_i: number, file: PbLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByLayer(_i: number, layer: PbLayer): string {
    return layer.id;
  }

  trackByNet(_i: number, net: PbNet): string {
    return net.id;
  }

  trackByTrace(_i: number, trace: PbTrace): string {
    return trace.id;
  }

  trackByColumn(_i: number, column: PbColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatPbFileSize(bytes);
  }

  tint(type: string, index: number): string {
    return pbTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isLayerHidden(id: string): boolean {
    return this.hiddenLayerIds.has(id);
  }

  // ─── File load / sample ─────────────────────────────────────────────────────
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
    const { accepted, rejected } = filterValidPbFiles(files);
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
          const bytes = await readPbFileBytes(file);
          const record = createPbFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid PCB dump'}`;
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
    await this.handleFiles([createSamplePbFile()]);
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
    this.selectedNetId = '';
    this.selectedTraceId = '';
    this.selectedRowIndex = 0;
    this.hiddenLayerIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.dismissedSuggestionId = null;
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.viewMode = 'plot';
    this.view = { scale: 1, offsetX: 0, offsetY: 0 };
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ─── Selection / filter / visibility ────────────────────────────────────────
  selectLayer(id: string): void {
    this.selectedLayerId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectNet(id: string): void {
    this.selectedNetId = id;
    const net = this.filteredNets.find((n) => n.id === id);
    const hit = this.visibleTraces.find((t) => t.net === id || (!!net && t.net === net.name));
    if (hit) this.selectedTraceId = hit.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectTrace(id: string): void {
    this.selectedTraceId = id;
    const trace = this.filteredTraces.find((t) => t.id === id);
    if (trace?.net) {
      const net = this.parsed?.nets.find((n) => n.id === trace.net || n.name === trace.net);
      this.selectedNetId = net?.id ?? trace.net;
    }
    if (trace?.layer) {
      const layer = this.parsed?.layers.find((l) => l.id === trace.layer || l.name === trace.layer);
      this.selectedLayerId = layer?.id ?? this.selectedLayerId;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row || !this.parsed) {
      this.renderCanvas();
      this.cdr.markForCheck();
      return;
    }
    const name = row['name'] || row['Name'] || '';
    const type = (row['type'] || row['Type'] || '').toLowerCase();
    if (type === 'layer' || this.parsed.layers.some((l) => l.name === name || l.id === name)) {
      const layer = this.parsed.layers.find((l) => l.name === name || l.id === name);
      if (layer) this.selectedLayerId = layer.id;
    } else if (type === 'net' || this.parsed.nets.some((n) => n.name === name || n.id === name)) {
      const net = this.parsed.nets.find((n) => n.name === name || n.id === name);
      if (net) this.selectNet(net.id);
    } else if (name) {
      const trace = this.parsed.traces.find((t) => t.name === name || t.id === name);
      if (trace) this.selectTrace(trace.id);
      else this.selectedTraceId = name;
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
    if (this.selectedNetId && !this.filteredNets.some((n) => n.id === this.selectedNetId)) {
      this.selectedNetId = this.filteredNets[0]?.id ?? '';
    }
    if (this.selectedTraceId && !this.filteredTraces.some((t) => t.id === this.selectedTraceId)) {
      this.selectedTraceId = this.filteredTraces[0]?.id ?? '';
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
    this.selectedNetId = '';
    this.selectedTraceId = '';
    this.selectedRowIndex = -1;
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

  // ─── Suggestions / view mode / chrome ───────────────────────────────────────
  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setViewMode(mode: PbViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => {
      if (mode !== 'table') this.fitView();
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

  exportAs(format: PbExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportPbSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportPbSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportPbRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Plot, Stack, or Nets to export a PNG snapshot');
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (!url) {
          this.toast.error('Could not capture PNG snapshot');
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

  // ─── Canvas / view controls ─────────────────────────────────────────────────
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
    this.view = fitCadView(toCadGeom(this.visibleTraces), width, height);
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
    const id = pickCadEntityAtScreen(toCadGeom(this.visibleTraces), this.view, canvas.height, sx, sy);
    if (id) this.selectTrace(id);
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

  // ─── Private helpers ────────────────────────────────────────────────────────
  private isLayerKeyHidden(layerKey: string): boolean {
    if (this.hiddenLayerIds.has(layerKey)) return true;
    const layer = this.parsed?.layers.find((l) => l.id === layerKey || l.name === layerKey);
    return !!layer && this.hiddenLayerIds.has(layer.id);
  }                                                                                                                                       

  private shiftLayer(delta: number): void {
    const list = this.filteredLayers;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((l) => l.id === this.selectedLayerId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLayer(next.id);
  }

  private shiftTrace(delta: number): void {
    const list = this.visibleTraces;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((t) => t.id === this.selectedTraceId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectTrace(next.id);
  }

  private shiftNet(delta: number): void {
    const list = this.visibleNets;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedNetId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectNet(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenLayerIds = new Set();
    this.selectedLayerId = this.parsed?.layers[0]?.id ?? '';
    this.selectedNetId = this.parsed?.nets[0]?.id ?? '';
    this.selectedTraceId = this.parsed?.traces[0]?.id ?? '';
    this.selectedRowIndex = 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    renderPbPlot(canvas, this.visibleTraces, this.plotSelectedId, this.view);
  }

  private clearCanvas(): void {
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
