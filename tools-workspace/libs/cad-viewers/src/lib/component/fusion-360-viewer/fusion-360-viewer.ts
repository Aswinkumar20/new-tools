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
  FU_ACCEPT_ATTR,
  FU_FORMATS_HINT,
  FU_FORMATS_LABEL,
  FU_RELATED_TOOLS,
  FU_SUPPORTED_EXTENSIONS
} from '../../constants/fusion-360-viewer.constants';
import type { FuComponent, FuColumn, FuExportFormat, FuInstance, FuLoadedFile, FuBody, FuViewMode } from '../../types/fusion-360-viewer.types';
import type { Cad3dView } from '../../utils/cad-3d.utils';
import { buildCadInsightStats, clampCadZoom, observeCadDocumentTheme } from '../../utils/cad-file.utils';
import {
  buildFuComponentMetadata,
  buildFuMetadataRows,
  buildFuBodyMetadata,
  canExportFu,
  canvasToPngDataUrl,
  createFuFileRecord,
  createSampleFuFile,
  defaultCad3dView,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportFuRowsCsv,
  exportFuSchemaCsv,
  exportFuSummaryJson,
  filterFuComponents,
  filterFuInstances,
  filterFuBodies,
  filterFuRows,
  filterValidFuFiles,
  fitCad3dView,
  pickCad3dSolidAtScreen,
  sizeCadCanvas,
  formatFuFileSize,
  fuTypeColor,
  readFuFileBytes,
  renderFuComponents,
  renderFuInstances,
  renderFuBodies,
  resolveFuSuggestion,
  toCad3dInstances,
  toCad3dBodies
} from '../../utils/fusion-360-viewer.utils';

@Component({
  selector: 'lib-fusion-360-viewer',
  standalone: true,
  templateUrl: './fusion-360-viewer.html',
  styleUrls: ['./fusion-360-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Fusion360ViewerComponent implements AfterViewInit, OnDestroy {
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

  readonly acceptAttr = FU_ACCEPT_ATTR;
  readonly relatedTools = FU_RELATED_TOOLS;
  readonly supportedExtensions = FU_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = FU_FORMATS_LABEL;
  readonly formatsHint = FU_FORMATS_HINT;
  readonly viewModes: Array<{ id: FuViewMode; label: string }> = [
    { id: 'bodies', label: 'Bodies' },
    { id: 'components', label: 'Components' },
    { id: 'preview', label: 'Preview' },
    { id: 'table', label: 'Rows' }
  ];

  files: FuLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: FuViewMode = 'bodies';
  query = '';
  selectedBodyId = '';
  selectedComponentId = '';
  selectedInstanceId = '';
  selectedRowIndex = 0;
  hiddenBodyIds = new Set<string>();
  view: Cad3dView = defaultCad3dView();
  rotating = false;
  isFullscreen = false;

  private dragDepth = 0;
  private lastX = 0;
  private lastY = 0;
  private pointerMoved = 0;
  private resizeObserver: ResizeObserver | null = null;
  private stopThemeWatch: (() => void) | null = null;

  get currentFile(): FuLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportFu(this.currentFile);
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

  get filteredBodies(): FuBody[] {
    return this.parsed ? filterFuBodies(this.parsed.bodies, this.query) : [];
  }

  get filteredComponents(): FuComponent[] {
    return this.parsed ? filterFuComponents(this.parsed.components, this.query) : [];
  }

  get filteredInstances(): FuInstance[] {
    return this.parsed ? filterFuInstances(this.parsed.instances, this.query) : [];
  }

  get filteredColumns(): FuColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterFuRows(this.parsed.rows, this.query) : [];
  }

  get visibleBodies(): FuBody[] {
    return this.filteredBodies.filter((s) => !this.hiddenBodyIds.has(s.id));
  }

  get selectedBody(): FuBody | null {
    return this.filteredBodies.find((s) => s.id === this.selectedBodyId) ?? null;
  }

  get selectedComponent(): FuComponent | null {
    return this.filteredComponents.find((e) => e.id === this.selectedComponentId) ?? null;
  }

  get selectedInstance(): FuInstance | null {
    return this.filteredInstances.find((inst) => inst.id === this.selectedInstanceId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildFuMetadataRows(this.parsed) : [];
  }

  get bodyMetadataRows() {
    return this.selectedBody ? buildFuBodyMetadata(this.selectedBody) : [];
  }

  get componentMetadataRows() {
    return this.selectedComponent ? buildFuComponentMetadata(this.selectedComponent) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedBodyId || this.selectedComponentId || this.selectedInstanceId);
  }

  get primarySuggestion() {
    const s = resolveFuSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(type: string, index: number): string {
    return fuTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isBodyHidden(id: string): boolean {
    return this.hiddenBodyIds.has(id);
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
      if (this.viewMode === 'preview' || this.viewMode === 'table') this.shiftRow(1);
      else if (this.viewMode === 'components') this.shiftComponent(1);
      else this.shiftBody(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'preview' || this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'components') this.shiftComponent(-1);
      else this.shiftBody(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: FuLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByBody(_i: number, body: FuBody): string {
    return body.id;
  }

  trackByComponent(_i: number, component: FuComponent): string {
    return component.id;
  }

  trackByInstance(_i: number, instance: FuInstance): string {
    return instance.id;
  }

  trackByColumn(_i: number, column: FuColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatFuFileSize(bytes);
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
    const { accepted, rejected } = filterValidFuFiles(files);
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
          const bytes = await readFuFileBytes(file);
          const record = createFuFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Fusion dump'}`;
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
    await this.handleFiles([createSampleFuFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.fitView();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectBody(id: string): void {
    this.selectedBodyId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectComponent(id: string): void {
    this.selectedComponentId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectInstance(id: string): void {
    this.selectedInstanceId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row?.name) return;
    if (this.filteredBodies.some((s) => s.id === row.name || s.name === row.name)) this.selectedBodyId = row.name;
    if (this.filteredComponents.some((e) => e.id === row.name || e.name === row.name)) this.selectedComponentId = row.name;
    if (this.filteredInstances.some((inst) => inst.id === row.name || inst.name === row.name)) this.selectedInstanceId = row.name;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleBodyVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenBodyIds.has(id)) this.hiddenBodyIds.delete(id);
    else this.hiddenBodyIds.add(id);
    this.hiddenBodyIds = new Set(this.hiddenBodyIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedBodyId && !this.filteredBodies.some((s) => s.id === this.selectedBodyId)) {
      this.selectedBodyId = this.filteredBodies[0]?.id ?? '';
    }
    if (this.selectedComponentId && !this.filteredComponents.some((e) => e.id === this.selectedComponentId)) {
      this.selectedComponentId = this.filteredComponents[0]?.id ?? '';
    }
    if (this.selectedInstanceId && !this.filteredInstances.some((inst) => inst.id === this.selectedInstanceId)) {
      this.selectedInstanceId = this.filteredInstances[0]?.id ?? '';
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
    this.selectedBodyId = '';
    this.selectedComponentId = '';
    this.selectedInstanceId = '';
    this.selectedRowIndex = 0;
    this.hiddenBodyIds = new Set();
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

  setViewMode(mode: FuViewMode): void {
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

  exportAs(format: FuExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportFuSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportFuSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportFuRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Bodies, Components, or Preview to export a PNG snapshot');
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
    this.selectedBodyId = '';
    this.selectedComponentId = '';
    this.selectedInstanceId = '';
    this.selectedRowIndex = -1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fitView(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const { width, height } = sizeCadCanvas(canvas);
    const solids =
      this.viewMode === 'preview'
        ? toCad3dInstances(this.visibleBodies, this.filteredInstances)
        : toCad3dBodies(this.visibleBodies);
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
    const id = pickCad3dSolidAtScreen(this.viewMode === 'preview' ? toCad3dInstances(this.visibleBodies, this.filteredInstances) : toCad3dBodies(this.visibleBodies), this.view, canvas.width, canvas.height, sx, sy);
    if (id) this.selectInstance(id);
    else this.clearSelection();
  }


  onCanvasWheel(event: WheelEvent): void {
    if (!this.parsed) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.view = { ...this.view, zoom: clampCadZoom(this.view.zoom * factor, 0.08, 12) };
    this.renderCanvas();
  }

  private shiftBody(delta: number): void {
    const list = this.filteredBodies;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedBodyId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectBody(next.id);
  }

  private shiftComponent(delta: number): void {
    const list = this.filteredComponents;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedComponentId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectComponent(next.id);
  }

  private shiftInstance(delta: number): void {
    const list = this.filteredInstances;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((inst) => inst.id === this.selectedInstanceId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectInstance(next.id);
  }

  private shiftRow(delta: number): void {
    if (this.viewMode === 'preview') {
      this.shiftInstance(delta);
      return;
    }
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenBodyIds = new Set();
    this.selectedBodyId = this.parsed?.bodies[0]?.id ?? '';
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
      renderFuComponents(canvas, this.filteredComponents, this.selectedComponentId || null);
      return;
    }
    if (this.viewMode === 'preview') {
      renderFuInstances(canvas, this.visibleBodies, this.filteredInstances, this.selectedInstanceId || null, this.view);
      return;
    }
    renderFuBodies(canvas, this.visibleBodies, this.selectedBodyId || null, this.view);
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
