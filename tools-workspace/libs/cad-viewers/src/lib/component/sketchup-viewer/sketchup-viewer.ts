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
  SK_ACCEPT_ATTR,
  SK_FORMATS_HINT,
  SK_FORMATS_LABEL,
  SK_RELATED_TOOLS,
  SK_SUPPORTED_EXTENSIONS
} from '../../constants/sketchup-viewer.constants';
import type { SkColumn, SkComponent as SkComp, SkExportFormat, SkGroup, SkInstance, SkLoadedFile, SkViewMode } from '../../types/sketchup-viewer.types';
import type { Cad3dView } from '../../utils/cad-3d.utils';
import { buildCadInsightStats, clampCadZoom, observeCadDocumentTheme } from '../../utils/cad-file.utils';
import {
  buildSkComponentMetadata,
  buildSkGroupMetadata,
  buildSkMetadataRows,
  canExportSk,
  canvasToPngDataUrl,
  createSampleSkFile,
  createSkFileRecord,
  defaultCad3dView,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportSkRowsCsv,
  exportSkSchemaCsv,
  exportSkSummaryJson,
  filterSkComponents,
  filterSkGroups,
  filterSkInstances,
  filterSkRows,
  filterValidSkFiles,
  fitCad3dView,
  formatSkFileSize,
  pickCad3dSolidAtScreen,
  readSkFileBytes,
  renderSkComponents,
  renderSkGroups,
  renderSkInstances,
  resolveSkSuggestion,
  sizeCadCanvas,
  skTypeColor,
  toCad3dGroups,
  toCad3dInstances
} from '../../utils/sketchup-viewer.utils';

@Component({
  selector: 'lib-sketchup-viewer',
  standalone: true,
  templateUrl: './sketchup-viewer.html',
  styleUrls: ['./sketchup-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SketchupViewerComponent implements AfterViewInit, OnDestroy {
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
  readonly acceptAttr = SK_ACCEPT_ATTR;
  readonly relatedTools = SK_RELATED_TOOLS;
  readonly supportedExtensions = SK_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = SK_FORMATS_LABEL;
  readonly formatsHint = SK_FORMATS_HINT;
  readonly viewModes: Array<{ id: SkViewMode; label: string }> = [
    { id: 'groups', label: 'Groups' },
    { id: 'components', label: 'Components' },
    { id: 'preview', label: 'Preview' },
    { id: 'table', label: 'Rows' }
  ];

  // ─── File / parse state ─────────────────────────────────────────────────────
  files: SkLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';

  // ─── UI chrome ──────────────────────────────────────────────────────────────
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: SkViewMode = 'groups';
  query = '';
  isFullscreen = false;

  // ─── Selection / visibility ─────────────────────────────────────────────────
  selectedGroupId = '';
  selectedComponentId = '';
  selectedInstanceId = '';
  selectedRowIndex = 0;
  hiddenGroupIds = new Set<string>();

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
  get currentFile(): SkLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportSk(this.currentFile);
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

  get filteredGroups(): SkGroup[] {
    return this.parsed ? filterSkGroups(this.parsed.groups, this.query) : [];
  }

  get filteredComponents(): SkComp[] {
    return this.parsed ? filterSkComponents(this.parsed.components, this.query) : [];
  }

  get filteredInstances(): SkInstance[] {
    return this.parsed ? filterSkInstances(this.parsed.instances, this.query) : [];
  }

  get filteredColumns(): SkColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterSkRows(this.parsed.rows, this.query) : [];
  }

  get visibleGroups(): SkGroup[] {
    if (!this.hiddenGroupIds.size) return this.filteredGroups;
    return this.filteredGroups.filter((g) => !this.hiddenGroupIds.has(g.id));
  }

  get visibleInstances(): SkInstance[] {
    if (!this.hiddenGroupIds.size) return this.filteredInstances;
    return this.filteredInstances.filter((inst) => !this.isGroupKeyHidden(inst.group));
  }

  get selectedGroup(): SkGroup | null {
    return this.filteredGroups.find((s) => s.id === this.selectedGroupId) ?? null;
  }

  get selectedComponent(): SkComp | null {
    return this.filteredComponents.find((e) => e.id === this.selectedComponentId) ?? null;
  }

  get selectedInstance(): SkInstance | null {
    return this.filteredInstances.find((inst) => inst.id === this.selectedInstanceId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildSkMetadataRows(this.parsed) : [];
  }

  get groupMetadataRows() {
    return this.selectedGroup ? buildSkGroupMetadata(this.selectedGroup) : [];
  }

  get componentMetadataRows() {
    return this.selectedComponent ? buildSkComponentMetadata(this.selectedComponent) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedComponentId || this.selectedGroupId || this.selectedInstanceId);
  }

  get primarySuggestion() {
    const s = resolveSkSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
      if (this.viewMode === 'preview') this.shiftInstance(1);
      else if (this.viewMode === 'table') this.shiftRow(1);
      else if (this.viewMode === 'components') this.shiftComponent(1);
      else this.shiftGroup(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'preview') this.shiftInstance(-1);
      else if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'components') this.shiftComponent(-1);
      else this.shiftGroup(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ─── TrackBy / format helpers ───────────────────────────────────────────────
  trackByFileId(_i: number, file: SkLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByGroup(_i: number, part: SkGroup): string {
    return part.id;
  }

  trackByComponent(_i: number, assembly: SkComp): string {
    return assembly.id;
  }

  trackByInstance(_i: number, instance: SkInstance): string {
    return instance.id;
  }

  trackByColumn(_i: number, column: SkColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatSkFileSize(bytes);
  }

  tint(type: string, index: number): string {
    return skTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isGroupHidden(id: string): boolean {
    return this.hiddenGroupIds.has(id);
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
    const { accepted, rejected } = filterValidSkFiles(files);
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
          const bytes = await readSkFileBytes(file);
          const record = createSkFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid SketchUp dump'}`;
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
    await this.handleFiles([createSampleSkFile()]);
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
    this.selectedGroupId = '';
    this.selectedComponentId = '';
    this.selectedInstanceId = '';
    this.selectedRowIndex = 0;
    this.hiddenGroupIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.dismissedSuggestionId = null;
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.viewMode = 'groups';
    this.view = defaultCad3dView();
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ─── Selection / filter / visibility ────────────────────────────────────────
  selectGroup(id: string): void {
    this.selectedGroupId = id;
    const group = this.filteredGroups.find((g) => g.id === id);
    const hit = this.visibleInstances.find(
      (inst) => inst.group === id || (!!group && (inst.group === group.name || inst.group === group.id))
    );
    if (hit) this.selectedInstanceId = hit.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectComponent(id: string): void {
    this.selectedComponentId = id;
    const component = this.filteredComponents.find((c) => c.id === id);
    const hit = this.visibleInstances.find(
      (inst) =>
        inst.component === id || (!!component && (inst.component === component.name || inst.component === component.id))
    );
    if (hit) {
      this.selectedInstanceId = hit.id;
      this.selectGroupFromInstance(hit);
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectInstance(id: string): void {
    this.selectedInstanceId = id;
    const inst = this.filteredInstances.find((i) => i.id === id);
    if (inst) {
      this.selectGroupFromInstance(inst);
      if (inst.component) {
        const component = this.parsed?.components.find((c) => c.id === inst.component || c.name === inst.component);
        this.selectedComponentId = component?.id ?? this.selectedComponentId;
      }
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
    const kind = (row['kind'] || row['type'] || row['Type'] || '').toLowerCase();
    if (kind === 'component' || this.parsed.components.some((c) => c.name === name || c.id === name)) {
      const component = this.parsed.components.find((c) => c.name === name || c.id === name);
      if (component) this.selectComponent(component.id);
    } else if (kind === 'instance' || this.parsed.instances.some((i) => i.name === name || i.id === name)) {
      const inst = this.parsed.instances.find((i) => i.name === name || i.id === name);
      if (inst) this.selectInstance(inst.id);
    } else if (name) {
      const group = this.parsed.groups.find((g) => g.name === name || g.id === name);
      if (group) this.selectGroup(group.id);
      else this.selectedGroupId = name;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleGroupVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenGroupIds.has(id)) this.hiddenGroupIds.delete(id);
    else this.hiddenGroupIds.add(id);
    this.hiddenGroupIds = new Set(this.hiddenGroupIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedGroupId && !this.filteredGroups.some((s) => s.id === this.selectedGroupId)) {
      this.selectedGroupId = this.filteredGroups[0]?.id ?? '';
    }
    if (this.selectedComponentId && !this.filteredComponents.some((e) => e.id === this.selectedComponentId)) {
      this.selectedComponentId = this.filteredComponents[0]?.id ?? '';
    }
    if (this.selectedInstanceId && !this.filteredInstances.some((inst) => inst.id === this.selectedInstanceId)) {
      this.selectedInstanceId = this.filteredInstances[0]?.id ?? '';
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
    this.selectedComponentId = '';
    this.selectedGroupId = '';
    this.selectedInstanceId = '';
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

  setViewMode(mode: SkViewMode): void {
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

  exportAs(format: SkExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportSkSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportSkSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportSkRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Groups, Components, or Preview to export a PNG snapshot');
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
    const solids =
      this.viewMode === 'preview'
        ? toCad3dInstances(this.visibleGroups, this.visibleInstances)
        : toCad3dGroups(this.visibleGroups);
    this.view = fitCad3dView(solids, width, height);
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
    if (!wasClick || !event || !this.parsed || this.viewMode === 'table' || this.viewMode === 'components') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const solids =
      this.viewMode === 'preview'
        ? toCad3dInstances(this.visibleGroups, this.visibleInstances)
        : toCad3dGroups(this.visibleGroups);
    const id = pickCad3dSolidAtScreen(solids, this.view, canvas.width, canvas.height, sx, sy);
    if (!id) {
      this.clearSelection();
      return;
    }
    if (this.viewMode === 'preview') this.selectInstance(id);
    else this.selectGroup(id);
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.parsed || this.viewMode === 'table') return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.view = { ...this.view, zoom: clampCadZoom(this.view.zoom * factor, 0.08, 12) };
    this.renderCanvas();
  }

  // ─── Private helpers ────────────────────────────────────────────────────────
  private isGroupKeyHidden(groupKey: string): boolean {
    if (this.hiddenGroupIds.has(groupKey)) return true;
    const group = this.parsed?.groups.find((g) => g.id === groupKey || g.name === groupKey);
    return !!group && this.hiddenGroupIds.has(group.id);
  }

  private selectGroupFromInstance(inst: SkInstance): void {
    if (!inst.group) return;
    const group = this.parsed?.groups.find((g) => g.id === inst.group || g.name === inst.group);
    this.selectedGroupId = group?.id ?? this.selectedGroupId;
  }

  private shiftGroup(delta: number): void {
    const list = this.visibleGroups;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedGroupId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectGroup(next.id);
  }

  private shiftComponent(delta: number): void {
    const list = this.filteredComponents;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedComponentId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectComponent(next.id);
  }

  private shiftInstance(delta: number): void {
    const list = this.visibleInstances;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((inst) => inst.id === this.selectedInstanceId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectInstance(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenGroupIds = new Set();
    this.selectedGroupId = this.parsed?.groups[0]?.id ?? '';
    this.selectedComponentId = this.parsed?.components[0]?.id ?? '';
    this.selectedInstanceId = this.parsed?.instances[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.view = defaultCad3dView();
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    if (this.viewMode === 'components') {
      renderSkComponents(canvas, this.filteredComponents, this.selectedComponentId || null);
      return;
    }
    if (this.viewMode === 'preview') {
      renderSkInstances(canvas, this.visibleGroups, this.visibleInstances, this.selectedInstanceId || null, this.view);
      return;
    }
    renderSkGroups(canvas, this.visibleGroups, this.selectedGroupId || null, this.view);
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
