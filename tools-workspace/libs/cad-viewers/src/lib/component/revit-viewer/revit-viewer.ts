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
  RV_ACCEPT_ATTR,
  RV_FORMATS_HINT,
  RV_FORMATS_LABEL,
  RV_RELATED_TOOLS,
  RV_SUPPORTED_EXTENSIONS
} from '../../constants/revit-viewer.constants';
import type { RvColumn, RvExportFormat, RvFamily, RvInstance, RvLoadedFile, RvType, RvViewMode } from '../../types/revit-viewer.types';
import type { Cad3dView } from '../../utils/cad-3d.utils';
import { buildCadInsightStats, clampCadZoom, observeCadDocumentTheme } from '../../utils/cad-file.utils';
import {
  buildRvFamilyMetadata,
  buildRvInstanceMetadata,
  buildRvMetadataRows,
  buildRvTypeMetadata,
  canExportRv,
  canvasToPngDataUrl,
  createRvFileRecord,
  createSampleRvFile,
  defaultCad3dView,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportRvRowsCsv,
  exportRvSchemaCsv,
  exportRvSummaryJson,
  filterRvFamilies,
  filterRvInstances,
  filterRvRows,
  filterRvTypes,
  filterValidRvFiles,
  fitCad3dView,
  formatRvFileSize,
  pickCad3dSolidAtScreen,
  readRvFileBytes,
  renderRvFamilies,
  renderRvNavigate,
  resolveRvSuggestion,
  rvTypeColor,
  sizeCadCanvas,
  toRvCad3d
} from '../../utils/revit-viewer.utils';

@Component({
  selector: 'lib-revit-viewer',
  standalone: true,
  templateUrl: './revit-viewer.html',
  styleUrls: ['./revit-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RevitViewerComponent implements AfterViewInit, OnDestroy {
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
  readonly acceptAttr = RV_ACCEPT_ATTR;
  readonly relatedTools = RV_RELATED_TOOLS;
  readonly supportedExtensions = RV_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = RV_FORMATS_LABEL;
  readonly formatsHint = RV_FORMATS_HINT;
  readonly viewModes: Array<{ id: RvViewMode; label: string }> = [
    { id: 'navigate', label: 'Navigate' },
    { id: 'families', label: 'Families' },
    { id: 'types', label: 'Types' },
    { id: 'table', label: 'Rows' }
  ];

  // ─── File / parse state ─────────────────────────────────────────────────────
  files: RvLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';

  // ─── UI chrome ──────────────────────────────────────────────────────────────
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: RvViewMode = 'navigate';
  query = '';
  isFullscreen = false;

  // ─── Selection / visibility ─────────────────────────────────────────────────
  selectedInstanceId = '';
  selectedFamilyId = '';
  selectedTypeId = '';
  selectedRowIndex = 0;
  hiddenFamilyIds = new Set<string>();

  // ─── Canvas interaction ─────────────────────────────────────────────────────
  view: Cad3dView = defaultCad3dView();
  rotating = false;

  private dragDepth = 0;
  private lastX = 0;
  private lastY = 0;
  private pointerMoved = 0;
  private resizeObserver: ResizeObserver | null = null;
  private stopThemeWatch: (() => void) | null = null;

  // ─── Derived state ──────────────────────────────────────────────────────────
  get currentFile(): RvLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportRv(this.currentFile);
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

  get filteredInstances(): RvInstance[] {
    return this.parsed ? filterRvInstances(this.parsed.instances, this.query) : [];
  }

  get filteredFamilies(): RvFamily[] {
    return this.parsed ? filterRvFamilies(this.parsed.families, this.query) : [];
  }

  get filteredTypes(): RvType[] {
    return this.parsed ? filterRvTypes(this.parsed.types, this.query) : [];
  }

  get filteredColumns(): RvColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterRvRows(this.parsed.rows, this.query) : [];
  }

  get visibleInstances(): RvInstance[] {
    if (!this.hiddenFamilyIds.size) return this.filteredInstances;
    return this.filteredInstances.filter((inst) => !this.isFamilyKeyHidden(inst.family));
  }

  get visibleTypes(): RvType[] {
    if (!this.hiddenFamilyIds.size) return this.filteredTypes;
    return this.filteredTypes.filter((t) => !this.isFamilyKeyHidden(t.family));
  }

  get selectedInstance(): RvInstance | null {
    return this.filteredInstances.find((s) => s.id === this.selectedInstanceId) ?? null;
  }

  get selectedFamily(): RvFamily | null {
    return this.filteredFamilies.find((e) => e.id === this.selectedFamilyId) ?? null;
  }

  get selectedType(): RvType | null {
    return this.filteredTypes.find((typ) => typ.id === this.selectedTypeId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildRvMetadataRows(this.parsed) : [];
  }

  get instanceMetadataRows() {
    return this.selectedInstance ? buildRvInstanceMetadata(this.selectedInstance) : [];
  }

  get familyMetadataRows() {
    return this.selectedFamily ? buildRvFamilyMetadata(this.selectedFamily) : [];
  }

  get typeMetadataRows() {
    return this.selectedType ? buildRvTypeMetadata(this.selectedType) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedFamilyId || this.selectedInstanceId || this.selectedTypeId);
  }

  get primarySuggestion() {
    const s = resolveRvSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
      else if (this.viewMode === 'types') this.shiftType(1);
      else if (this.viewMode === 'families') this.shiftFamily(1);
      else this.shiftInstance(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'types') this.shiftType(-1);
      else if (this.viewMode === 'families') this.shiftFamily(-1);
      else this.shiftInstance(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ─── TrackBy / format helpers ───────────────────────────────────────────────
  trackByFileId(_i: number, file: RvLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByInstance(_i: number, inst: RvInstance): string {
    return inst.id;
  }

  trackByFamily(_i: number, family: RvFamily): string {
    return family.id;
  }

  trackByType(_i: number, typ: RvType): string {
    return typ.id;
  }

  trackByColumn(_i: number, column: RvColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatRvFileSize(bytes);
  }

  tint(type: string, index: number): string {
    return rvTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isFamilyHidden(id: string): boolean {
    return this.hiddenFamilyIds.has(id);
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
    const { accepted, rejected } = filterValidRvFiles(files);
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
          const bytes = await readRvFileBytes(file);
          const record = createRvFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Revit dump'}`;
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
    await this.handleFiles([createSampleRvFile()]);
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
    this.selectedInstanceId = '';
    this.selectedFamilyId = '';
    this.selectedTypeId = '';
    this.selectedRowIndex = 0;
    this.hiddenFamilyIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.dismissedSuggestionId = null;
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.viewMode = 'navigate';
    this.view = defaultCad3dView();
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ─── Selection / filter / visibility ────────────────────────────────────────
  selectInstance(id: string): void {
    this.selectedInstanceId = id;
    const inst = this.filteredInstances.find((s) => s.id === id);
    if (inst?.family) {
      const family = this.parsed?.families.find((f) => f.id === inst.family || f.name === inst.family);
      this.selectedFamilyId = family?.id ?? this.selectedFamilyId;
    }
    if (inst?.type) {
      const typ = this.parsed?.types.find((t) => t.id === inst.type || t.name === inst.type);
      this.selectedTypeId = typ?.id ?? this.selectedTypeId;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectFamily(id: string): void {
    this.selectedFamilyId = id;
    const family = this.filteredFamilies.find((f) => f.id === id);
    const hit = this.visibleInstances.find(
      (inst) => inst.family === id || (!!family && (inst.family === family.name || inst.family === family.id))
    );
    if (hit) this.selectedInstanceId = hit.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectType(id: string): void {
    this.selectedTypeId = id;
    const typ = this.filteredTypes.find((t) => t.id === id);
    if (typ?.family) {
      const family = this.parsed?.families.find((f) => f.id === typ.family || f.name === typ.family);
      this.selectedFamilyId = family?.id ?? this.selectedFamilyId;
    }
    const hit = this.visibleInstances.find(
      (inst) => inst.type === id || (!!typ && (inst.type === typ.name || inst.family === typ.family))
    );
    if (hit) this.selectedInstanceId = hit.id;
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
    const kind = (row['kind'] || row['type'] || row['Type'] || '').toLowerCase();
    if (kind === 'family' || this.parsed.families.some((f) => f.name === name || f.id === name)) {
      const family = this.parsed.families.find((f) => f.name === name || f.id === name);
      if (family) this.selectFamily(family.id);
    } else if (kind === 'type' || this.parsed.types.some((t) => t.name === name || t.id === name)) {
      const typ = this.parsed.types.find((t) => t.name === name || t.id === name);
      if (typ) this.selectType(typ.id);
    } else if (name) {
      const inst = this.parsed.instances.find((s) => s.name === name || s.id === name);
      if (inst) this.selectInstance(inst.id);
      else this.selectedInstanceId = name;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleFamilyVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenFamilyIds.has(id)) this.hiddenFamilyIds.delete(id);
    else this.hiddenFamilyIds.add(id);
    this.hiddenFamilyIds = new Set(this.hiddenFamilyIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedInstanceId && !this.filteredInstances.some((s) => s.id === this.selectedInstanceId)) {
      this.selectedInstanceId = this.filteredInstances[0]?.id ?? '';
    }
    if (this.selectedFamilyId && !this.filteredFamilies.some((e) => e.id === this.selectedFamilyId)) {
      this.selectedFamilyId = this.filteredFamilies[0]?.id ?? '';
    }
    if (this.selectedTypeId && !this.filteredTypes.some((typ) => typ.id === this.selectedTypeId)) {
      this.selectedTypeId = this.filteredTypes[0]?.id ?? '';
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
    this.selectedFamilyId = '';
    this.selectedInstanceId = '';
    this.selectedTypeId = '';
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

  setViewMode(mode: RvViewMode): void {
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

  exportAs(format: RvExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportRvSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportRvSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportRvRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Navigate, Families, or Types to export a PNG snapshot');
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
    this.view = fitCad3dView(toRvCad3d(this.visibleInstances), width, height);
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
    if (!wasClick || !event || !this.parsed || this.viewMode === 'table' || this.viewMode === 'families') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const id = pickCad3dSolidAtScreen(toRvCad3d(this.visibleInstances), this.view, canvas.width, canvas.height, sx, sy);
    if (id) this.selectInstance(id);
    else this.clearSelection();
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.parsed || this.viewMode === 'table') return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.view = { ...this.view, zoom: clampCadZoom(this.view.zoom * factor, 0.08, 12) };
    this.renderCanvas();
  }

  // ─── Private helpers ────────────────────────────────────────────────────────
  private isFamilyKeyHidden(familyKey: string): boolean {
    if (this.hiddenFamilyIds.has(familyKey)) return true;
    const family = this.parsed?.families.find((f) => f.id === familyKey || f.name === familyKey);
    return !!family && this.hiddenFamilyIds.has(family.id);
  }

  private shiftInstance(delta: number): void {
    const list = this.visibleInstances;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedInstanceId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectInstance(next.id);
  }

  private shiftFamily(delta: number): void {
    const list = this.filteredFamilies;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedFamilyId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectFamily(next.id);
  }

  private shiftType(delta: number): void {
    const list = this.visibleTypes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((typ) => typ.id === this.selectedTypeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectType(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenFamilyIds = new Set();
    this.selectedInstanceId = this.parsed?.instances[0]?.id ?? '';
    this.selectedFamilyId = this.parsed?.families[0]?.id ?? '';
    this.selectedTypeId = this.parsed?.types[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.view = defaultCad3dView();
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    if (this.viewMode === 'families') {
      renderRvFamilies(canvas, this.filteredFamilies, this.selectedFamilyId || null);
      return;
    }
    let selectedId = this.selectedInstanceId || null;
    if (this.viewMode === 'types' && this.selectedType) {
      selectedId =
        this.visibleInstances.find(
          (inst) =>
            inst.type === this.selectedType?.name ||
            inst.type === this.selectedType?.id ||
            inst.family === this.selectedType?.family
        )?.id ?? selectedId;
    }
    renderRvNavigate(canvas, this.visibleInstances, selectedId, this.view);
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
