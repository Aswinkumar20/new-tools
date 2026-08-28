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
  IG_ACCEPT_ATTR,
  IG_FORMATS_HINT,
  IG_FORMATS_LABEL,
  IG_RELATED_TOOLS,
  IG_SUPPORTED_EXTENSIONS
} from '../../constants/iges-viewer.constants';
import type { IgColumn, IgEntity, IgExportFormat, IgLoadedFile, IgSurface, IgViewMode } from '../../types/iges-viewer.types';
import type { Cad3dView } from '../../utils/cad-3d.utils';
import { buildCadInsightStats, clampCadZoom, observeCadDocumentTheme } from '../../utils/cad-file.utils';
import {
  buildIgEntityMetadata,
  buildIgMetadataRows,
  buildIgSurfaceMetadata,
  canExportIg,
  canvasToPngDataUrl,
  createIgFileRecord,
  createSampleIgFile,
  defaultCad3dView,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportIgRowsCsv,
  exportIgSchemaCsv,
  exportIgSummaryJson,
  filterIgEntities,
  filterIgRows,
  filterIgSurfaces,
  filterValidIgFiles,
  fitCad3dView,
  pickCad3dSolidAtScreen,
  sizeCadCanvas,
  formatIgFileSize,
  igTypeColor,
  readIgFileBytes,
  renderIgEntities,
  renderIgSurfaces,
  resolveIgSuggestion,
  toCad3dSurfaces
} from '../../utils/iges-viewer.utils';

@Component({
  selector: 'lib-iges-viewer',
  standalone: true,
  templateUrl: './iges-viewer.html',
  styleUrls: ['./iges-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IgesViewerComponent implements AfterViewInit, OnDestroy {
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

  readonly acceptAttr = IG_ACCEPT_ATTR;
  readonly relatedTools = IG_RELATED_TOOLS;
  readonly supportedExtensions = IG_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = IG_FORMATS_LABEL;
  readonly formatsHint = IG_FORMATS_HINT;
  readonly viewModes: Array<{ id: IgViewMode; label: string }> = [
    { id: 'surfaces', label: 'Surfaces' },
    { id: 'entities', label: 'Entities' },
    { id: 'preview', label: 'Preview' },
    { id: 'table', label: 'Rows' }
  ];

  files: IgLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: IgViewMode = 'surfaces';
  query = '';
  selectedSurfaceId = '';
  selectedEntityId = '';
  selectedRowIndex = 0;
  hiddenSurfaceIds = new Set<string>();
  view: Cad3dView = defaultCad3dView();
  rotating = false;
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

  get currentFile(): IgLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportIg(this.currentFile);
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

  get filteredSurfaces(): IgSurface[] {
    return this.parsed ? filterIgSurfaces(this.parsed.surfaces, this.query) : [];
  }

  get filteredEntities(): IgEntity[] {
    return this.parsed ? filterIgEntities(this.parsed.entities, this.query) : [];
  }

  get filteredColumns(): IgColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterIgRows(this.parsed.rows, this.query) : [];
  }

  get visibleSurfaces(): IgSurface[] {
    return this.filteredSurfaces.filter((s) => !this.hiddenSurfaceIds.has(s.id));
  }

  get visibleEntities(): IgEntity[] {
    if (!this.hiddenSurfaceIds.size) return this.filteredEntities;
    return this.filteredEntities.filter((e) => {
      if (!e.surface) return true;
      if (this.hiddenSurfaceIds.has(e.surface)) return false;
      const matched = this.parsed?.surfaces.find((s) => s.name === e.surface || s.id === e.surface);
      return !matched || !this.hiddenSurfaceIds.has(matched.id);
    });
  }

  get selectedSurface(): IgSurface | null {
    return this.filteredSurfaces.find((s) => s.id === this.selectedSurfaceId) ?? null;
  }

  get selectedEntity(): IgEntity | null {
    return this.filteredEntities.find((e) => e.id === this.selectedEntityId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildIgMetadataRows(this.parsed) : [];
  }

  get surfaceMetadataRows() {
    return this.selectedSurface ? buildIgSurfaceMetadata(this.selectedSurface) : [];
  }

  get entityMetadataRows() {
    return this.selectedEntity ? buildIgEntityMetadata(this.selectedEntity) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedEntityId || this.selectedSurfaceId);
  }

  get primarySuggestion() {
    const s = resolveIgSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
      else if (this.viewMode === 'preview' || this.viewMode === 'entities') this.shiftEntity(1);
      else this.shiftSurface(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'preview' || this.viewMode === 'entities') this.shiftEntity(-1);
      else this.shiftSurface(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.clearSearch();
    }
  }

  // ---------------------------------------------------------------------------
  // Template helpers
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: IgLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackBySurface(_i: number, surface: IgSurface): string {
    return surface.id;
  }

  trackByEntity(_i: number, entity: IgEntity): string {
    return entity.id;
  }

  trackByColumn(_i: number, column: IgColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatIgFileSize(bytes);
  }

  tint(type: string, index: number): string {
    return igTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isSurfaceHidden(id: string): boolean {
    return this.hiddenSurfaceIds.has(id);
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
    const { accepted, rejected } = filterValidIgFiles(files);
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
          const bytes = await readIgFileBytes(file);
          const record = createIgFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid IGES dump'}`;
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
    await this.handleFiles([createSampleIgFile()]);
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
    this.selectedSurfaceId = '';
    this.selectedEntityId = '';
    this.selectedRowIndex = 0;
    this.hiddenSurfaceIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
    this.view = defaultCad3dView();
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

  setViewMode(mode: IgViewMode): void {
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

  exportAs(format: IgExportFormat, event: Event): void {
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
        downloadTextFile(exportIgSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      } else if (format === 'schema-csv') {
        downloadTextFile(exportIgSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      } else if (format === 'rows-csv') {
        downloadTextFile(exportIgRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Surfaces, Entities, or Preview to export a PNG snapshot');
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
  // Selection / filter / surfaces
  // ---------------------------------------------------------------------------

  selectSurface(id: string): void {
    this.selectedSurfaceId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectEntity(id: string): void {
    this.selectedEntityId = id;
    const ent = this.filteredEntities.find((e) => e.id === id);
    if (ent?.surface) {
      const surf = this.filteredSurfaces.find((s) => s.id === ent.surface || s.name === ent.surface);
      if (surf) this.selectedSurfaceId = surf.id;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (row?.name) {
      const surf = this.filteredSurfaces.find((s) => s.id === row.name || s.name === row.name);
      if (surf) this.selectedSurfaceId = surf.id;
      const ent = this.filteredEntities.find((e) => e.id === row.name || e.name === row.name);
      if (ent) this.selectedEntityId = ent.id;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleSurfaceVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenSurfaceIds.has(id)) this.hiddenSurfaceIds.delete(id);
    else this.hiddenSurfaceIds.add(id);
    this.hiddenSurfaceIds = new Set(this.hiddenSurfaceIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  isolateSelectedSurface(): void {
    if (!this.selectedSurfaceId || !this.parsed) return;
    const surfaces = this.parsed.surfaces ?? [];
    this.hiddenSurfaceIds = new Set(surfaces.filter((s) => s.id !== this.selectedSurfaceId).map((s) => s.id));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  showAllSurfaces(): void {
    if (!this.hiddenSurfaceIds.size) return;
    this.hiddenSurfaceIds = new Set();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedSurfaceId && !this.filteredSurfaces.some((s) => s.id === this.selectedSurfaceId)) {
      this.selectedSurfaceId = this.filteredSurfaces[0]?.id ?? '';
    }
    if (this.selectedEntityId && !this.filteredEntities.some((e) => e.id === this.selectedEntityId)) {
      this.selectedEntityId = this.filteredEntities[0]?.id ?? '';
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
    this.selectedEntityId = '';
    this.selectedSurfaceId = '';
    this.selectedRowIndex = -1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // View / canvas
  // ---------------------------------------------------------------------------

  zoomBy(factor: number): void {
    if (!this.parsed || this.viewMode === 'table') return;
    this.view = { ...this.view, zoom: clampCadZoom(this.view.zoom * factor, 0.08, 12) };
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetView(): void {
    this.view = defaultCad3dView();
    this.fitView();
  }

  fitView(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed || this.viewMode === 'table') return;
    const { width, height } = sizeCadCanvas(canvas);
    this.view = fitCad3dView(toCad3dSurfaces(this.visibleSurfaces), width, height);
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
    this.rotating = true;
    this.pointerMoved = 0;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.rotating) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.pointerMoved += Math.abs(dx) + Math.abs(dy);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.view = {
      ...this.view,
      rotY: this.view.rotY + dx * 0.01,
      rotX: Math.max(-1.4, Math.min(1.4, this.view.rotX + dy * 0.01))
    };
    this.renderCanvas();
  }

  onCanvasPointerUp(event?: PointerEvent): void {
    const wasClick = this.rotating && this.pointerMoved <= 8;
    this.rotating = false;
    if (!wasClick || !event || !this.parsed || this.viewMode === 'table' || this.viewMode === 'entities') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const id = pickCad3dSolidAtScreen(toCad3dSurfaces(this.visibleSurfaces), this.view, canvas.width, canvas.height, sx, sy);
    if (id) this.selectSurface(id);
    else this.clearSelection();
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.parsed || this.viewMode === 'table') return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.view = { ...this.view, zoom: clampCadZoom(this.view.zoom * factor, 0.08, 12) };
    this.renderCanvas();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private shiftSurface(delta: number): void {
    const list = this.visibleSurfaces;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedSurfaceId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectSurface(next.id);
  }

  private shiftEntity(delta: number): void {
    const list = this.visibleEntities;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedEntityId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectEntity(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenSurfaceIds = new Set();
    this.selectedSurfaceId = this.parsed?.surfaces[0]?.id ?? '';
    this.selectedEntityId = this.parsed?.entities[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.view = defaultCad3dView();
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    if (this.viewMode === 'entities') {
      renderIgEntities(canvas, this.visibleEntities, this.selectedEntityId || null);
      return;
    }
    renderIgSurfaces(canvas, this.visibleSurfaces, this.selectedSurfaceId || null, this.view);
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
