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
  ME_ACCEPT_ATTR,
  ME_FORMATS_HINT,
  ME_FORMATS_LABEL,
  ME_RELATED_TOOLS,
  ME_SUPPORTED_EXTENSIONS
} from '../../constants/mep-model-viewer.constants';
import type { MeDiscipline, MeColumn, MeExportFormat, MeSystem, MeLoadedFile, MeElement, MeViewMode } from '../../types/mep-model-viewer.types';
import type { Cad3dView } from '../../utils/cad-3d.utils';
import { buildCadInsightStats, clampCadZoom, observeCadDocumentTheme } from '../../utils/cad-file.utils';
import {
  buildMeDisciplineMetadata,
  buildMeMetadataRows,
  buildMeSystemMetadata,
  buildMeElementMetadata,
  canExportMe,
  canvasToPngDataUrl,
  createMeFileRecord,
  createSampleMeFile,
  defaultCad3dView,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportMeRowsCsv,
  exportMeSchemaCsv,
  exportMeSummaryJson,
  filterMeDisciplines,
  filterMeSystems,
  filterMeElements,
  filterMeRows,
  filterValidMeFiles,
  fitCad3dView,
  pickCad3dSolidAtScreen,
  sizeCadCanvas,
  formatMeFileSize,
  meTypeColor,
  readMeFileBytes,
  renderMeDisciplines,
  renderMePreview,
  resolveMeSuggestion,
  toMeCad3d
} from '../../utils/mep-model-viewer.utils';

@Component({
  selector: 'lib-mep-model-viewer',
  standalone: true,
  templateUrl: './mep-model-viewer.html',
  styleUrls: ['./mep-model-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MepModelViewerComponent implements AfterViewInit, OnDestroy {
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

  readonly acceptAttr = ME_ACCEPT_ATTR;
  readonly relatedTools = ME_RELATED_TOOLS;
  readonly supportedExtensions = ME_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = ME_FORMATS_LABEL;
  readonly formatsHint = ME_FORMATS_HINT;
  readonly viewModes: Array<{ id: MeViewMode; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'systems', label: 'Systems' },
    { id: 'disciplines', label: 'Disciplines' },
    { id: 'table', label: 'Rows' }
  ];

  files: MeLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: MeViewMode = 'preview';
  query = '';
  selectedElementId = '';
  selectedDiscId = '';
  selectedSystemId = '';
  selectedRowIndex = 0;
  hiddenDisciplineIds = new Set<string>();
  view: Cad3dView = defaultCad3dView();
  rotating = false;
  isFullscreen = false;

  private dragDepth = 0;
  private lastX = 0;
  private lastY = 0;
  private pointerMoved = 0;
  private resizeObserver: ResizeObserver | null = null;
  private stopThemeWatch: (() => void) | null = null;

  get currentFile(): MeLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportMe(this.currentFile);
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

  get filteredElements(): MeElement[] {
    return this.parsed ? filterMeElements(this.parsed.elements, this.query) : [];
  }

  get filteredDisciplines(): MeDiscipline[] {
    return this.parsed ? filterMeDisciplines(this.parsed.disciplines, this.query) : [];
  }

  get filteredSystems(): MeSystem[] {
    return this.parsed ? filterMeSystems(this.parsed.systems, this.query) : [];
  }

  get filteredColumns(): MeColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterMeRows(this.parsed.rows, this.query) : [];
  }

  get visibleElements(): MeElement[] {
    return this.filteredElements.filter((s) => !this.hiddenDisciplineIds.has(String(s.discipline)));
  }

  get selectedElement(): MeElement | null {
    return this.filteredElements.find((s) => s.id === this.selectedElementId) ?? null;
  }

  get selectedDiscipline(): MeDiscipline | null {
    return this.filteredDisciplines.find((e) => e.id === this.selectedDiscId) ?? null;
  }

  get selectedSystem(): MeSystem | null {
    return this.filteredSystems.find((inst) => inst.id === this.selectedSystemId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildMeMetadataRows(this.parsed) : [];
  }

  get elementMetadataRows() {
    return this.selectedElement ? buildMeElementMetadata(this.selectedElement) : [];
  }

  get discMetadataRows() {
    return this.selectedDiscipline ? buildMeDisciplineMetadata(this.selectedDiscipline) : [];
  }

  get systemMetadataRows() {
    return this.selectedSystem ? buildMeSystemMetadata(this.selectedSystem) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedDiscId || this.selectedElementId || this.selectedSystemId);
  }

  get primarySuggestion() {
    const s = resolveMeSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(type: string, index: number): string {
    return meTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isDiscHidden(id: string): boolean {
    return this.hiddenDisciplineIds.has(id);
  }

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
    this.stopThemeWatch?.();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen = !!document.fullscreenElement;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
    }
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
      else if (this.viewMode === 'systems') this.shiftSystem(1);
      else if (this.viewMode === 'disciplines') this.shiftDisc(1);
      else this.shiftElement(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'systems') this.shiftSystem(-1);
      else if (this.viewMode === 'disciplines') this.shiftDisc(-1);
      else this.shiftElement(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: MeLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByElement(_i: number, part: MeElement): string {
    return part.id;
  }

  trackByDiscipline(_i: number, assembly: MeDiscipline): string {
    return assembly.id;
  }

  trackBySystem(_i: number, instance: MeSystem): string {
    return instance.id;
  }

  trackByColumn(_i: number, column: MeColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatMeFileSize(bytes);
  }

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
    const { accepted, rejected } = filterValidMeFiles(files);
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
          const bytes = await readMeFileBytes(file);
          const record = createMeFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid MEP dump'}`;
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
    await this.handleFiles([createSampleMeFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.fitView();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectElement(id: string): void {
    this.selectedElementId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectDiscipline(id: string): void {
    this.selectedDiscId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectSystem(id: string): void {
    this.selectedSystemId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row?.name) return;
    if (this.filteredElements.some((s) => s.id === row.name || s.name === row.name)) this.selectedElementId = row.name;
    if (this.filteredDisciplines.some((e) => e.id === row.name || e.name === row.name)) this.selectedDiscId = row.name;
    if (this.filteredSystems.some((inst) => inst.id === row.name || inst.name === row.name)) this.selectedSystemId = row.name;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleDiscVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenDisciplineIds.has(id)) this.hiddenDisciplineIds.delete(id);
    else this.hiddenDisciplineIds.add(id);
    this.hiddenDisciplineIds = new Set(this.hiddenDisciplineIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedElementId && !this.filteredElements.some((s) => s.id === this.selectedElementId)) {
      this.selectedElementId = this.filteredElements[0]?.id ?? '';
    }
    if (this.selectedDiscId && !this.filteredDisciplines.some((e) => e.id === this.selectedDiscId)) {
      this.selectedDiscId = this.filteredDisciplines[0]?.id ?? '';
    }
    if (this.selectedSystemId && !this.filteredSystems.some((inst) => inst.id === this.selectedSystemId)) {
      this.selectedSystemId = this.filteredSystems[0]?.id ?? '';
    }
    if (this.selectedRowIndex >= this.filteredRows.length) this.selectedRowIndex = Math.max(0, this.filteredRows.length - 1);
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
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedElementId = '';
    this.selectedDiscId = '';
    this.selectedSystemId = '';
    this.selectedRowIndex = 0;
    this.hiddenDisciplineIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.view = defaultCad3dView();
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setViewMode(mode: MeViewMode): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
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
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: MeExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportMeSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportMeSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportMeRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Preview, Disciplines, or Systems to export a PNG snapshot');
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

  async toggleFullscreen(): Promise<void> {
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

  clearSearch(): void {
    this.query = '';
    this.onFilterChange();
  }

  clearSelection(): void {
    this.selectedDiscId = '';
    this.selectedElementId = '';
    this.selectedSystemId = '';
    this.selectedRowIndex = -1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fitView(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const { width, height } = sizeCadCanvas(canvas);
    const solids = toMeCad3d(this.visibleElements);
    this.view = fitCad3dView(solids, width, height);
    this.renderCanvas();
    this.cdr.markForCheck();
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
    if (!wasClick || !event || !this.parsed || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const id = pickCad3dSolidAtScreen(toMeCad3d(this.visibleElements), this.view, canvas.width, canvas.height, sx, sy);
    if (id) this.selectElement(id);
    else this.clearSelection();
  }


  onCanvasWheel(event: WheelEvent): void {
    if (!this.parsed) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.view = { ...this.view, zoom: clampCadZoom(this.view.zoom * factor, 0.08, 12) };
    this.renderCanvas();
  }

  private shiftElement(delta: number): void {
    const list = this.filteredElements;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedElementId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectElement(next.id);
  }

  private shiftDisc(delta: number): void {
    const list = this.filteredDisciplines;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedDiscId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectDiscipline(next.id);
  }

  private shiftSystem(delta: number): void {
    const list = this.filteredSystems;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((inst) => inst.id === this.selectedSystemId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectSystem(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenDisciplineIds = new Set();
    this.selectedElementId = this.parsed?.elements[0]?.id ?? '';
    this.selectedDiscId = this.parsed?.disciplines[0]?.id ?? '';
    this.selectedSystemId = this.parsed?.systems[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.view = defaultCad3dView();
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    if (this.viewMode === 'disciplines') {
      renderMeDisciplines(canvas, this.filteredDisciplines, this.selectedDiscId || null);
      return;
    }
    let selectedId = this.selectedElementId || null;
    if (this.viewMode === 'systems' && this.selectedSystem) {
      selectedId =
        this.visibleElements.find((e) => e.system === this.selectedSystem?.name || e.name === this.selectedSystem?.name)?.id ?? selectedId;
    }
    renderMePreview(canvas, this.visibleElements, selectedId, this.view);
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
