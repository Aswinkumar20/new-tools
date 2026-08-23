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
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { HC_ACCEPT_ATTR, HC_FORMATS_HINT, HC_FORMATS_LABEL, HC_RELATED_TOOLS, HC_SUPPORTED_EXTENSIONS } from '../../constants/heic-viewer.constants';
import type { HcColumn, HcMeta, HcExportFormat, HcFrame, HcLoadedFile, HcPreview, HcViewMode, HcViewTransform } from '../../types/heic-viewer.types';
import {
  buildHcMetaMetadata,
  buildHcFrameMetadata,
  buildHcMetadataRows,
  canExportHc,
  canvasToPngDataUrl,
  createHcFileRecord,
  createSampleHcFile,
  defaultHcView,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportHcRowsCsv,
  exportHcSchemaCsv,
  exportHcSummaryJson,
  filterHcMetas,
  filterHcFrames,
  filterHcPreviews,
  filterHcRows,
  filterValidHcFiles,
  fitHcView,
  formatHcFileSize,
  readHcFileBytes,
  renderHcPreview,
  resolveHcSuggestion
} from '../../utils/heic-viewer.utils';

@Component({
  selector: 'lib-heic-viewer',
  standalone: true,
  templateUrl: './heic-viewer.html',
  styleUrls: ['./heic-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeicViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = HC_ACCEPT_ATTR;
  readonly relatedTools = HC_RELATED_TOOLS;
  readonly supportedExtensions = HC_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = HC_FORMATS_LABEL;
  readonly formatsHint = HC_FORMATS_HINT;
  readonly viewModes: Array<{ id: HcViewMode; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'frames', label: 'Frames' },
    { id: 'table', label: 'Rows' }
  ];

  files: HcLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: HcViewMode = 'preview';
  query = '';
  selectedFrameId = '';
  selectedMetaId = '';
  selectedRowIndex = 0;
  hiddenFrameIds = new Set<string>();
  view: HcViewTransform = defaultHcView();
  panning = false;

  private dragDepth = 0;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): HcLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportHc(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get filteredFrames(): HcFrame[] {
    return this.parsed ? filterHcFrames(this.parsed.frames, this.query) : [];
  }

  get filteredMetas(): HcMeta[] {
    return this.parsed ? filterHcMetas(this.parsed.metas, this.query) : [];
  }

  get filteredPreviews(): HcPreview[] {
    return this.parsed ? filterHcPreviews(this.parsed.previews, this.query) : [];
  }

  get filteredColumns(): HcColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterHcRows(this.parsed.rows, this.query) : [];
  }

  get visiblePreviews(): HcPreview[] {
    return this.filteredPreviews;
  }

  get selectedFrame(): HcFrame | null {
    return this.filteredFrames.find((l) => l.id === this.selectedFrameId) ?? this.filteredFrames[0] ?? null;
  }

  get selectedMeta(): HcMeta | null {
    return this.filteredMetas.find((e) => e.id === this.selectedMetaId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildHcMetadataRows(this.parsed) : [];
  }

  get frameMetadataRows() {
    return this.selectedFrame ? buildHcFrameMetadata(this.selectedFrame) : [];
  }

  get metaMetadataRows() {
    return this.selectedMeta ? buildHcMetaMetadata(this.selectedMeta) : [];
  }

  get zoomPercent(): number {
    return Math.round(this.view.scale * 100);
  }

  get primarySuggestion() {
    const s = resolveHcSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isFrameHidden(id: string): boolean {
    return this.hiddenFrameIds.has(id);
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
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
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(1);
      else if (this.viewMode === 'metadata') this.shiftMeta(1);
      else this.shiftFrame(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'metadata') this.shiftMeta(-1);
      else this.shiftFrame(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: HcLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByFrame(_i: number, layer: HcFrame): string {
    return layer.id;
  }

  trackByMeta(_i: number, effect: HcMeta): string {
    return effect.id;
  }

  trackByColumn(_i: number, column: HcColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatHcFileSize(bytes);
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
    const { accepted, rejected } = filterValidHcFiles(files);
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
          const bytes = await readHcFileBytes(file);
          const record = createHcFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid HEIC dump'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.fitView();
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.warnings.length) this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleHcFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.fitView();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectFrame(id: string): void {
    this.selectedFrameId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectMeta(id: string): void {
    this.selectedMetaId = id;
    const fx = this.filteredMetas.find((e) => e.id === id);
    if (fx) {
      const frame = this.filteredFrames.find((f) => f.id === fx.name || f.name === fx.name);
      if (frame) this.selectedFrameId = frame.id;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row?.name) return;
    if (this.filteredFrames.some((l) => l.id === row.name || l.name === row.name)) this.selectedFrameId = row.name;
    if (this.filteredMetas.some((e) => e.name === row.name || e.id === row.name)) {
      this.selectedMetaId = this.filteredMetas.find((e) => e.name === row.name || e.id === row.name)?.id ?? '';
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleFrameVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenFrameIds.has(id)) this.hiddenFrameIds.delete(id);
    else this.hiddenFrameIds.add(id);
    this.hiddenFrameIds = new Set(this.hiddenFrameIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedFrameId && !this.filteredFrames.some((l) => l.id === this.selectedFrameId)) {
      this.selectedFrameId = this.filteredFrames[0]?.id ?? '';
    }
    if (this.selectedMetaId && !this.filteredMetas.some((e) => e.id === this.selectedMetaId)) {
      this.selectedMetaId = this.filteredMetas[0]?.id ?? '';
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
    this.selectedFrameId = '';
    this.selectedMetaId = '';
    this.selectedRowIndex = 0;
    this.hiddenFrameIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.view = defaultHcView();
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

  setViewMode(mode: HcViewMode): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => {
      if (mode === 'preview') {
        this.fitView();
        this.renderCanvas();
      }
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
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: HcExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportHcSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportHcSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportHcRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode !== 'preview') {
          this.toast.info('Open Preview to export a PNG snapshot');
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (url) downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  fitView(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    const width = parent ? Math.max(320, parent.clientWidth) : canvas.width || 640;
    const height = parent ? Math.max(220, Math.min(360, parent.clientHeight || 320)) : canvas.height || 320;
    this.view = fitHcView(this.visiblePreviews, width, height);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomBy(factor: number): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const sx = canvas.width / 2;
    const sy = canvas.height / 2;
    this.view = {
      scale: this.view.scale * factor,
      offsetX: sx * (1 - factor) + this.view.offsetX * factor,
      offsetY: sy * (1 - factor) + this.view.offsetY * factor
    };
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onCanvasPointerDown(event: PointerEvent): void {
    this.panning = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.panning) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.view = { ...this.view, offsetX: this.view.offsetX + dx, offsetY: this.view.offsetY + dy };
    this.renderCanvas();
  }

  onCanvasPointerUp(): void {
    this.panning = false;
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.parsed) return;
    event.preventDefault();
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.view = {
      scale: this.view.scale * factor,
      offsetX: sx * (1 - factor) + this.view.offsetX * factor,
      offsetY: sy * (1 - factor) + this.view.offsetY * factor
    };
    this.renderCanvas();
  }

  private shiftFrame(delta: number): void {
    const list = this.filteredFrames;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((l) => l.id === this.selectedFrameId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectFrame(next.id);
  }

  private shiftMeta(delta: number): void {
    const list = this.filteredMetas;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedMetaId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectMeta(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenFrameIds = new Set();
    this.selectedFrameId = this.parsed?.frames[0]?.id ?? '';
    this.selectedMetaId = this.parsed?.metas[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.view = defaultHcView();
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode !== 'preview') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(220, Math.min(360, parent.clientHeight || 320));
    }
    renderHcPreview(canvas, this.visiblePreviews, this.selectedFrameId || null, this.view);
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
