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
  FP_ACCEPT_ATTR,
  FP_FORMATS_HINT,
  FP_FORMATS_LABEL,
  FP_RELATED_TOOLS,
  FP_SUPPORTED_EXTENSIONS
} from '../../constants/building-floor-plan-viewer.constants';
import type { FpLevel, FpColumn, FpExportFormat, FpRoom, FpLoadedFile, FpSpace, FpViewMode } from '../../types/building-floor-plan-viewer.types';
import {
  buildCadInsightStats,
  clampCadZoom,
  observeCadDocumentTheme,
  type CadViewTransform
} from '../../utils/cad-file.utils';
import {
  buildFpLevelMetadata,
  buildFpMetadataRows,
  buildFpRoomMetadata,
  buildFpSpaceMetadata,
  canExportFp,
  canvasToPngDataUrl,
  createFpFileRecord,
  createSampleFpFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportFpRowsCsv,
  exportFpSchemaCsv,
  exportFpSummaryJson,
  filterFpLevels,
  filterFpRooms,
  filterFpSpaces,
  filterFpRows,
  filterValidFpFiles,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatFpFileSize,
  fpTypeColor,
  readFpFileBytes,
  renderFpLevels,
  renderFpPlan,
  resolveFpSuggestion,
  toFpCadGeom
} from '../../utils/building-floor-plan-viewer.utils';

@Component({
  selector: 'lib-building-floor-plan-viewer',
  standalone: true,
  templateUrl: './building-floor-plan-viewer.html',
  styleUrls: ['./building-floor-plan-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BuildingFloorPlanViewerComponent implements AfterViewInit, OnDestroy {
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

  readonly acceptAttr = FP_ACCEPT_ATTR;
  readonly relatedTools = FP_RELATED_TOOLS;
  readonly supportedExtensions = FP_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = FP_FORMATS_LABEL;
  readonly formatsHint = FP_FORMATS_HINT;
  readonly viewModes: Array<{ id: FpViewMode; label: string }> = [
    { id: 'plan', label: 'Plan' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'levels', label: 'Levels' },
    { id: 'table', label: 'Rows' }
  ];

  files: FpLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: FpViewMode = 'plan';
  query = '';
  selectedSpaceId = '';
  selectedLevelId = '';
  selectedRoomId = '';
  selectedRowIndex = 0;
  hiddenLevelIds = new Set<string>();
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

  get currentFile(): FpLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportFp(this.currentFile);
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

  get filteredSpaces(): FpSpace[] {
    return this.parsed ? filterFpSpaces(this.parsed.spaces, this.query) : [];
  }

  get filteredLevels(): FpLevel[] {
    return this.parsed ? filterFpLevels(this.parsed.levels, this.query) : [];
  }

  get filteredRooms(): FpRoom[] {
    return this.parsed ? filterFpRooms(this.parsed.rooms, this.query) : [];
  }

  get filteredColumns(): FpColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterFpRows(this.parsed.rows, this.query) : [];
  }

  get visibleSpaces(): FpSpace[] {
    return this.filteredSpaces.filter((s) => !this.hiddenLevelIds.has(s.level));
  }

  get selectedSpace(): FpSpace | null {
    return this.filteredSpaces.find((s) => s.id === this.selectedSpaceId) ?? null;
  }

  get selectedLevel(): FpLevel | null {
    return this.filteredLevels.find((e) => e.id === this.selectedLevelId) ?? null;
  }

  get selectedRoom(): FpRoom | null {
    return this.filteredRooms.find((inst) => inst.id === this.selectedRoomId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildFpMetadataRows(this.parsed) : [];
  }

  get spaceMetadataRows() {
    return this.selectedSpace ? buildFpSpaceMetadata(this.selectedSpace) : [];
  }

  get levelMetadataRows() {
    return this.selectedLevel ? buildFpLevelMetadata(this.selectedLevel) : [];
  }

  get roomMetadataRows() {
    return this.selectedRoom ? buildFpRoomMetadata(this.selectedRoom) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedLevelId || this.selectedRoomId || this.selectedSpaceId);
  }

  get primarySuggestion() {
    const s = resolveFpSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
      else if (this.viewMode === 'rooms') this.shiftRoom(1);
      else if (this.viewMode === 'levels') this.shiftLevel(1);
      else this.shiftSpace(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'rooms') this.shiftRoom(-1);
      else if (this.viewMode === 'levels') this.shiftLevel(-1);
      else this.shiftSpace(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.clearSearch();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy / formatting
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: FpLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackBySpace(_i: number, part: FpSpace): string {
    return part.id;
  }

  trackByLevel(_i: number, assembly: FpLevel): string {
    return assembly.id;
  }

  trackByRoom(_i: number, instance: FpRoom): string {
    return instance.id;
  }

  trackByColumn(_i: number, column: FpColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  tint(type: string, index: number): string {
    return fpTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isLevelHidden(id: string): boolean {
    return this.hiddenLevelIds.has(id);
  }

  formatSize(bytes: number): string {
    return formatFpFileSize(bytes);
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
    const { accepted, rejected } = filterValidFpFiles(files);
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
          const bytes = await readFpFileBytes(file);
          const record = createFpFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid floor-plan dump'}`;
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
    await this.handleFiles([createSampleFpFile()]);
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
    this.selectedSpaceId = '';
    this.selectedLevelId = '';
    this.selectedRoomId = '';
    this.selectedRowIndex = 0;
    this.hiddenLevelIds = new Set();
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

  setViewMode(mode: FpViewMode): void {
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

  exportAs(format: FpExportFormat, event: Event): void {
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
        downloadTextFile(exportFpSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      } else if (format === 'schema-csv') {
        downloadTextFile(exportFpSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      } else if (format === 'rows-csv') {
        downloadTextFile(exportFpRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Plan, Levels, or Rooms to export a PNG snapshot');
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
  // Selection / filter / levels
  // ---------------------------------------------------------------------------

  selectSpace(id: string): void {
    this.selectedSpaceId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectLevel(id: string): void {
    this.selectedLevelId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRoom(id: string): void {
    this.selectedRoomId = id;
    const room = this.filteredRooms.find((r) => r.id === id);
    if (room) {
      const hit = this.visibleSpaces.find((e) => e.name === room.name || e.id === room.name);
      if (hit) this.selectedSpaceId = hit.id;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (row?.name) {
      const space = this.filteredSpaces.find((s) => s.id === row.name || s.name === row.name);
      if (space) this.selectedSpaceId = space.id;
      const level = this.filteredLevels.find((e) => e.id === row.name || e.name === row.name);
      if (level) this.selectedLevelId = level.id;
      const room = this.filteredRooms.find((inst) => inst.id === row.name || inst.name === row.name);
      if (room) this.selectedRoomId = room.id;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleLevelVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenLevelIds.has(id)) this.hiddenLevelIds.delete(id);
    else this.hiddenLevelIds.add(id);
    this.hiddenLevelIds = new Set(this.hiddenLevelIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  showAllLevels(): void {
    if (!this.hiddenLevelIds.size) return;
    this.hiddenLevelIds = new Set();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  isolateSelectedLevel(): void {
    if (!this.selectedLevelId || !this.parsed) return;
    const levels = this.parsed.levels ?? [];
    this.hiddenLevelIds = new Set(levels.filter((l) => l.id !== this.selectedLevelId && l.name !== this.selectedLevelId).map((l) => l.name));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedSpaceId && !this.filteredSpaces.some((s) => s.id === this.selectedSpaceId)) {
      this.selectedSpaceId = this.filteredSpaces[0]?.id ?? '';
    }
    if (this.selectedLevelId && !this.filteredLevels.some((e) => e.id === this.selectedLevelId)) {
      this.selectedLevelId = this.filteredLevels[0]?.id ?? '';
    }
    if (this.selectedRoomId && !this.filteredRooms.some((inst) => inst.id === this.selectedRoomId)) {
      this.selectedRoomId = this.filteredRooms[0]?.id ?? '';
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
    this.selectedLevelId = '';
    this.selectedRoomId = '';
    this.selectedSpaceId = '';
    this.selectedRowIndex = -1;
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
    const solids = toFpCadGeom(this.visibleSpaces);
    this.view = fitCadView(solids, width, height);
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
    const id = pickCadEntityAtScreen(toFpCadGeom(this.visibleSpaces), this.view, canvas.height, sx, sy);
    if (id) this.selectSpace(id);
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

  private shiftSpace(delta: number): void {
    const list = this.visibleSpaces;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedSpaceId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectSpace(next.id);
  }

  private shiftLevel(delta: number): void {
    const list = this.filteredLevels;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedLevelId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLevel(next.id);
  }

  private shiftRoom(delta: number): void {
    const list = this.filteredRooms;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((inst) => inst.id === this.selectedRoomId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectRoom(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    const base = this.selectedRowIndex < 0 ? 0 : this.selectedRowIndex;
    this.selectRow(Math.min(list.length - 1, Math.max(0, base + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenLevelIds = new Set();
    this.selectedSpaceId = this.parsed?.spaces[0]?.id ?? '';
    this.selectedLevelId = this.parsed?.levels[0]?.id ?? '';
    this.selectedRoomId = this.parsed?.rooms[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.view = { scale: 1, offsetX: 0, offsetY: 0 };
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    if (this.viewMode === 'levels') {
      renderFpLevels(canvas, this.filteredLevels, this.selectedLevelId || null);
      return;
    }
    let selectedId = this.selectedSpaceId || null;
    if (this.viewMode === 'rooms' && this.selectedRoom) {
      selectedId =
        this.visibleSpaces.find((e) => e.name === this.selectedRoom?.name || e.id === this.selectedRoom?.name)?.id ??
        selectedId;
    }
    renderFpPlan(canvas, this.visibleSpaces, selectedId, this.view);
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
