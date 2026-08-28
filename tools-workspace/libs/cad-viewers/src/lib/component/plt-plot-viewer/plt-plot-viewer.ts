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
  PL_ACCEPT_ATTR,
  PL_FORMATS_HINT,
  PL_FORMATS_LABEL,
  PL_RELATED_TOOLS,
  PL_SUPPORTED_EXTENSIONS
} from '../../constants/plt-plot-viewer.constants';
import type { PlColumn, PlCommand, PlExportFormat, PlLoadedFile, PlPen, PlViewMode } from '../../types/plt-plot-viewer.types';
import {
  buildCadInsightStats,
  clampCadZoom,
  observeCadDocumentTheme,
  type CadViewTransform
} from '../../utils/cad-file.utils';
import {
  buildPlCommandMetadata,
  buildPlMetadataRows,
  buildPlPenMetadata,
  canExportPl,
  canvasToPngDataUrl,
  createPlFileRecord,
  createSamplePlFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportPlRowsCsv,
  exportPlSchemaCsv,
  exportPlSummaryJson,
  filterPlCommands,
  filterPlPens,
  filterPlRows,
  filterValidPlFiles,
  fitCadView,
  formatPlFileSize,
  pickCadEntityAtScreen,
  plTypeColor,
  readPlFileBytes,
  renderPlPlot,
  resolvePlSuggestion,
  sizeCadCanvas,
  toCadGeom
} from '../../utils/plt-plot-viewer.utils';

@Component({
  selector: 'lib-plt-plot-viewer',
  standalone: true,
  templateUrl: './plt-plot-viewer.html',
  styleUrls: ['./plt-plot-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PltPlotViewerComponent implements AfterViewInit, OnDestroy {
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
  readonly acceptAttr = PL_ACCEPT_ATTR;
  readonly relatedTools = PL_RELATED_TOOLS;
  readonly supportedExtensions = PL_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PL_FORMATS_LABEL;
  readonly formatsHint = PL_FORMATS_HINT;
  readonly viewModes: Array<{ id: PlViewMode; label: string }> = [
    { id: 'plot', label: 'Plot' },
    { id: 'pens', label: 'Pens' },
    { id: 'commands', label: 'Commands' },
    { id: 'table', label: 'Rows' }
  ];

  // ─── File / parse state ─────────────────────────────────────────────────────
  files: PlLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';

  // ─── UI chrome ──────────────────────────────────────────────────────────────
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: PlViewMode = 'plot';
  query = '';
  isFullscreen = false;

  // ─── Selection / visibility ─────────────────────────────────────────────────
  selectedPenId = '';
  selectedCommandId = '';
  selectedRowIndex = 0;
  hiddenPenIds = new Set<string>();

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
  get currentFile(): PlLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportPl(this.currentFile);
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

  get filteredPens(): PlPen[] {
    return this.parsed ? filterPlPens(this.parsed.pens, this.query) : [];
  }

  get filteredCommands(): PlCommand[] {
    return this.parsed ? filterPlCommands(this.parsed.commands, this.query) : [];
  }

  get filteredColumns(): PlColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterPlRows(this.parsed.rows, this.query) : [];
  }

  get visibleCommands(): PlCommand[] {
    if (!this.hiddenPenIds.size) return this.filteredCommands;
    return this.filteredCommands.filter((c) => !this.isPenKeyHidden(c.pen));
  }

  get selectedPen(): PlPen | null {
    return this.filteredPens.find((p) => p.id === this.selectedPenId) ?? null;
  }

  get selectedCommand(): PlCommand | null {
    return this.filteredCommands.find((c) => c.id === this.selectedCommandId) ?? null;
  }

  get plotSelectedId(): string | null {
    if (this.viewMode === 'commands' || this.viewMode === 'plot') return this.selectedCommandId || null;
    if (this.viewMode === 'pens' && this.selectedPenId) {
      const pen = this.selectedPen;
      return (
        this.visibleCommands.find((c) => c.pen === this.selectedPenId || (!!pen && c.pen === pen.name))?.id ?? null
      );
    }
    return this.selectedCommandId || null;
  }

  get metadataRows() {
    return this.parsed ? buildPlMetadataRows(this.parsed) : [];
  }

  get penMetadataRows() {
    return this.selectedPen ? buildPlPenMetadata(this.selectedPen) : [];
  }

  get commandMetadataRows() {
    return this.selectedCommand ? buildPlCommandMetadata(this.selectedCommand) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedCommandId || this.selectedPenId);
  }

  get primarySuggestion() {
    const s = resolvePlSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
      else if (this.viewMode === 'commands' || this.viewMode === 'plot') this.shiftCommand(1);
      else this.shiftPen(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'commands' || this.viewMode === 'plot') this.shiftCommand(-1);
      else this.shiftPen(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ─── TrackBy / format helpers ───────────────────────────────────────────────
  trackByFileId(_i: number, file: PlLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByPen(_i: number, pen: PlPen): string {
    return pen.id;
  }

  trackByCommand(_i: number, command: PlCommand): string {
    return command.id;
  }

  trackByColumn(_i: number, column: PlColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatPlFileSize(bytes);
  }

  tint(type: string, index: number): string {
    return plTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isPenHidden(id: string): boolean {
    return this.hiddenPenIds.has(id);
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
    const { accepted, rejected } = filterValidPlFiles(files);
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
          const bytes = await readPlFileBytes(file);
          const record = createPlFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid PLT dump'}`;
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
    await this.handleFiles([createSamplePlFile()]);
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
    this.selectedPenId = '';
    this.selectedCommandId = '';
    this.selectedRowIndex = 0;
    this.hiddenPenIds = new Set();
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
  selectPen(id: string): void {
    this.selectedPenId = id;
    const pen = this.filteredPens.find((p) => p.id === id);
    const hit = this.visibleCommands.find((c) => c.pen === id || (!!pen && c.pen === pen.name));
    if (hit) this.selectedCommandId = hit.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectCommand(id: string): void {
    this.selectedCommandId = id;
    const command = this.filteredCommands.find((c) => c.id === id);
    if (command?.pen) {
      const pen = this.parsed?.pens.find((p) => p.id === command.pen || p.name === command.pen);
      this.selectedPenId = pen?.id ?? this.selectedPenId;
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
    if (type === 'pen' || this.parsed.pens.some((p) => p.name === name || p.id === name)) {
      const pen = this.parsed.pens.find((p) => p.name === name || p.id === name);
      if (pen) this.selectPen(pen.id);
    } else if (name) {
      const command = this.parsed.commands.find((c) => c.name === name || c.id === name);
      if (command) this.selectCommand(command.id);
      else this.selectedCommandId = name;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  togglePenVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenPenIds.has(id)) this.hiddenPenIds.delete(id);
    else this.hiddenPenIds.add(id);
    this.hiddenPenIds = new Set(this.hiddenPenIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedPenId && !this.filteredPens.some((p) => p.id === this.selectedPenId)) {
      this.selectedPenId = this.filteredPens[0]?.id ?? '';
    }
    if (this.selectedCommandId && !this.filteredCommands.some((c) => c.id === this.selectedCommandId)) {
      this.selectedCommandId = this.filteredCommands[0]?.id ?? '';
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
    this.selectedCommandId = '';
    this.selectedPenId = '';
    this.selectedRowIndex = -1;
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

  setViewMode(mode: PlViewMode): void {
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

  exportAs(format: PlExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportPlSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportPlSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportPlRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Plot, Pens, or Commands to export a PNG snapshot');
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
    this.view = fitCadView(toCadGeom(this.visibleCommands), width, height);
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
    const id = pickCadEntityAtScreen(toCadGeom(this.visibleCommands), this.view, canvas.height, sx, sy);
    if (id) this.selectCommand(id);
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
  private isPenKeyHidden(penKey: string): boolean {
    if (this.hiddenPenIds.has(penKey)) return true;
    const pen = this.parsed?.pens.find((p) => p.id === penKey || p.name === penKey);
    return !!pen && this.hiddenPenIds.has(pen.id);
  }

  private shiftPen(delta: number): void {
    const list = this.filteredPens;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((p) => p.id === this.selectedPenId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPen(next.id);
  }

  private shiftCommand(delta: number): void {
    const list = this.visibleCommands;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((c) => c.id === this.selectedCommandId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectCommand(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenPenIds = new Set();
    this.selectedPenId = this.parsed?.pens[0]?.id ?? '';
    this.selectedCommandId = this.parsed?.commands[0]?.id ?? '';
    this.selectedRowIndex = 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    renderPlPlot(canvas, this.visibleCommands, this.plotSelectedId, this.view);
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
