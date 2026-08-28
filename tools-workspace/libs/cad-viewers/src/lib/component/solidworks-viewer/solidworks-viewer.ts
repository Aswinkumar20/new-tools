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
  SW_ACCEPT_ATTR,
  SW_FORMATS_HINT,
  SW_FORMATS_LABEL,
  SW_RELATED_TOOLS,
  SW_SUPPORTED_EXTENSIONS
} from '../../constants/solidworks-viewer.constants';
import type { SwAssembly, SwColumn, SwExportFormat, SwInstance, SwLoadedFile, SwPart, SwViewMode } from '../../types/solidworks-viewer.types';
import type { Cad3dView } from '../../utils/cad-3d.utils';
import { buildCadInsightStats, clampCadZoom, observeCadDocumentTheme } from '../../utils/cad-file.utils';
import {
  buildSwAssemblyMetadata,
  buildSwPartMetadata,
  buildSwMetadataRows,
  canExportSw,
  canvasToPngDataUrl,
  createSampleSwFile,
  createSwFileRecord,
  defaultCad3dView,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportSwRowsCsv,
  exportSwSchemaCsv,
  exportSwSummaryJson,
  filterSwAssemblies,
  filterSwParts,
  filterSwInstances,
  filterSwRows,
  filterValidSwFiles,
  fitCad3dView,
  formatSwFileSize,
  pickCad3dSolidAtScreen,
  readSwFileBytes,
  renderSwAssemblies,
  renderSwParts,
  renderSwInstances,
  resolveSwSuggestion,
  sizeCadCanvas,
  swTypeColor,
  toCad3dParts,
  toCad3dInstances
} from '../../utils/solidworks-viewer.utils';

@Component({
  selector: 'lib-solidworks-viewer',
  standalone: true,
  templateUrl: './solidworks-viewer.html',
  styleUrls: ['./solidworks-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SolidworksViewerComponent implements AfterViewInit, OnDestroy {
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
  readonly acceptAttr = SW_ACCEPT_ATTR;
  readonly relatedTools = SW_RELATED_TOOLS;
  readonly supportedExtensions = SW_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = SW_FORMATS_LABEL;
  readonly formatsHint = SW_FORMATS_HINT;
  readonly viewModes: Array<{ id: SwViewMode; label: string }> = [
    { id: 'parts', label: 'Parts' },
    { id: 'assemblies', label: 'Assemblies' },
    { id: 'preview', label: 'Preview' },
    { id: 'table', label: 'Rows' }
  ];

  // ─── File / parse state ─────────────────────────────────────────────────────
  files: SwLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';

  // ─── UI chrome ──────────────────────────────────────────────────────────────
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: SwViewMode = 'parts';
  query = '';
  isFullscreen = false;

  // ─── Selection / visibility ─────────────────────────────────────────────────
  selectedPartId = '';
  selectedAssemblyId = '';
  selectedInstanceId = '';
  selectedRowIndex = 0;
  hiddenPartIds = new Set<string>();

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
  get currentFile(): SwLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportSw(this.currentFile);
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

  get filteredParts(): SwPart[] {
    return this.parsed ? filterSwParts(this.parsed.parts, this.query) : [];
  }

  get filteredAssemblies(): SwAssembly[] {
    return this.parsed ? filterSwAssemblies(this.parsed.assemblies, this.query) : [];
  }

  get filteredInstances(): SwInstance[] {
    return this.parsed ? filterSwInstances(this.parsed.instances, this.query) : [];
  }

  get filteredColumns(): SwColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterSwRows(this.parsed.rows, this.query) : [];
  }

  get visibleParts(): SwPart[] {
    if (!this.hiddenPartIds.size) return this.filteredParts;
    return this.filteredParts.filter((g) => !this.hiddenPartIds.has(g.id));
  }

  get visibleInstances(): SwInstance[] {
    if (!this.hiddenPartIds.size) return this.filteredInstances;
    return this.filteredInstances.filter((inst) => !this.isPartKeyHidden(inst.part));
  }

  get selectedPart(): SwPart | null {
    return this.filteredParts.find((s) => s.id === this.selectedPartId) ?? null;
  }

  get selectedAssembly(): SwAssembly | null {
    return this.filteredAssemblies.find((e) => e.id === this.selectedAssemblyId) ?? null;
  }

  get selectedInstance(): SwInstance | null {
    return this.filteredInstances.find((inst) => inst.id === this.selectedInstanceId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildSwMetadataRows(this.parsed) : [];
  }

  get partMetadataRows() {
    return this.selectedPart ? buildSwPartMetadata(this.selectedPart) : [];
  }

  get assemblyMetadataRows() {
    return this.selectedAssembly ? buildSwAssemblyMetadata(this.selectedAssembly) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedAssemblyId || this.selectedPartId || this.selectedInstanceId);
  }

  get primarySuggestion() {
    const s = resolveSwSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
      else if (this.viewMode === 'assemblies') this.shiftAssembly(1);
      else this.shiftPart(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'preview') this.shiftInstance(-1);
      else if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'assemblies') this.shiftAssembly(-1);
      else this.shiftPart(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ─── TrackBy / format helpers ───────────────────────────────────────────────
  trackByFileId(_i: number, file: SwLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByPart(_i: number, part: SwPart): string {
    return part.id;
  }

  trackByAssembly(_i: number, assembly: SwAssembly): string {
    return assembly.id;
  }

  trackByInstance(_i: number, instance: SwInstance): string {
    return instance.id;
  }

  trackByColumn(_i: number, column: SwColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatSwFileSize(bytes);
  }

  tint(type: string, index: number): string {
    return swTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isPartHidden(id: string): boolean {
    return this.hiddenPartIds.has(id);
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
    const { accepted, rejected } = filterValidSwFiles(files);
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
          const bytes = await readSwFileBytes(file);
          const record = createSwFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid SolidWorks dump'}`;
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
    await this.handleFiles([createSampleSwFile()]);
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
    this.selectedPartId = '';
    this.selectedAssemblyId = '';
    this.selectedInstanceId = '';
    this.selectedRowIndex = 0;
    this.hiddenPartIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.dismissedSuggestionId = null;
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.viewMode = 'parts';
    this.view = defaultCad3dView();
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ─── Selection / filter / visibility ────────────────────────────────────────
  selectPart(id: string): void {
    this.selectedPartId = id;
    const group = this.filteredParts.find((g) => g.id === id);
    const hit = this.visibleInstances.find(
      (inst) => inst.part === id || (!!group && (inst.part === group.name || inst.part === group.id))
    );
    if (hit) this.selectedInstanceId = hit.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectAssembly(id: string): void {
    this.selectedAssemblyId = id;
    const component = this.filteredAssemblies.find((c) => c.id === id);
    const hit = this.visibleInstances.find(
      (inst) =>
        inst.assembly === id || (!!component && (inst.assembly === component.name || inst.assembly === component.id))
    );
    if (hit) {
      this.selectedInstanceId = hit.id;
      this.selectPartFromInstance(hit);
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectInstance(id: string): void {
    this.selectedInstanceId = id;
    const inst = this.filteredInstances.find((i) => i.id === id);
    if (inst) {
      this.selectPartFromInstance(inst);
      if (inst.assembly) {
        const component = this.parsed?.assemblies.find((c) => c.id === inst.assembly || c.name === inst.assembly);
        this.selectedAssemblyId = component?.id ?? this.selectedAssemblyId;
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
    if (kind === 'assembly' || this.parsed.assemblies.some((c) => c.name === name || c.id === name)) {
      const component = this.parsed.assemblies.find((c) => c.name === name || c.id === name);
      if (component) this.selectAssembly(component.id);
    } else if (kind === 'instance' || this.parsed.instances.some((i) => i.name === name || i.id === name)) {
      const inst = this.parsed.instances.find((i) => i.name === name || i.id === name);
      if (inst) this.selectInstance(inst.id);
    } else if (name) {
      const group = this.parsed.parts.find((g) => g.name === name || g.id === name);
      if (group) this.selectPart(group.id);
      else this.selectedPartId = name;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  togglePartVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenPartIds.has(id)) this.hiddenPartIds.delete(id);
    else this.hiddenPartIds.add(id);
    this.hiddenPartIds = new Set(this.hiddenPartIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedPartId && !this.filteredParts.some((s) => s.id === this.selectedPartId)) {
      this.selectedPartId = this.filteredParts[0]?.id ?? '';
    }
    if (this.selectedAssemblyId && !this.filteredAssemblies.some((e) => e.id === this.selectedAssemblyId)) {
      this.selectedAssemblyId = this.filteredAssemblies[0]?.id ?? '';
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
    this.selectedAssemblyId = '';
    this.selectedPartId = '';
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

  setViewMode(mode: SwViewMode): void {
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

  exportAs(format: SwExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportSwSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportSwSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportSwRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Parts, Assemblies, or Preview to export a PNG snapshot');
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
        ? toCad3dInstances(this.visibleParts, this.visibleInstances)
        : toCad3dParts(this.visibleParts);
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
    if (!wasClick || !event || !this.parsed || this.viewMode === 'table' || this.viewMode === 'assemblies') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const solids =
      this.viewMode === 'preview'
        ? toCad3dInstances(this.visibleParts, this.visibleInstances)
        : toCad3dParts(this.visibleParts);
    const id = pickCad3dSolidAtScreen(solids, this.view, canvas.width, canvas.height, sx, sy);
    if (!id) {
      this.clearSelection();
      return;
    }
    if (this.viewMode === 'preview') this.selectInstance(id);
    else this.selectPart(id);
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.parsed || this.viewMode === 'table') return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.view = { ...this.view, zoom: clampCadZoom(this.view.zoom * factor, 0.08, 12) };
    this.renderCanvas();
  }

  // ─── Private helpers ────────────────────────────────────────────────────────
  private isPartKeyHidden(groupKey: string): boolean {
    if (this.hiddenPartIds.has(groupKey)) return true;
    const group = this.parsed?.parts.find((g) => g.id === groupKey || g.name === groupKey);
    return !!group && this.hiddenPartIds.has(group.id);
  }

  private selectPartFromInstance(inst: SwInstance): void {
    if (!inst.part) return;
    const group = this.parsed?.parts.find((g) => g.id === inst.part || g.name === inst.part);
    this.selectedPartId = group?.id ?? this.selectedPartId;
  }

  private shiftPart(delta: number): void {
    const list = this.visibleParts;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedPartId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPart(next.id);
  }

  private shiftAssembly(delta: number): void {
    const list = this.filteredAssemblies;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedAssemblyId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectAssembly(next.id);
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
    this.hiddenPartIds = new Set();
    this.selectedPartId = this.parsed?.parts[0]?.id ?? '';
    this.selectedAssemblyId = this.parsed?.assemblies[0]?.id ?? '';
    this.selectedInstanceId = this.parsed?.instances[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.view = defaultCad3dView();
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    if (this.viewMode === 'assemblies') {
      renderSwAssemblies(canvas, this.filteredAssemblies, this.selectedAssemblyId || null);
      return;
    }
    if (this.viewMode === 'preview') {
      renderSwInstances(canvas, this.visibleParts, this.visibleInstances, this.selectedInstanceId || null, this.view);
      return;
    }
    renderSwParts(canvas, this.visibleParts, this.selectedPartId || null, this.view);
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
