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
import { AI_ACCEPT_ATTR, AI_FORMATS_HINT, AI_FORMATS_LABEL, AI_RELATED_TOOLS, AI_SUPPORTED_EXTENSIONS } from '../../constants/ai-file-viewer.constants';
import type { AiArtboard, AiColumn, AiExportFormat, AiLayer, AiLoadedFile, AiPath, AiViewMode, AiViewTransform } from '../../types/ai-file-viewer.types';
import {
  buildAiArtboardMetadata,
  buildAiLayerMetadata,
  buildAiMetadataRows,
  buildAiPathMetadata,
  canExportAi,
  canvasToPngDataUrl,
  createSampleAiFile,
  createAiFileRecord,
  defaultAiView,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportAiRowsCsv,
  exportAiSchemaCsv,
  exportAiSummaryJson,
  filterAiArtboards,
  filterAiLayers,
  filterAiRows,
  filterAiPaths,
  filterValidAiFiles,
  fitAiView,
  formatAiFileSize,
  readAiFileBytes,
  renderAiPreview,
  resolveAiSuggestion
} from '../../utils/ai-file-viewer.utils';

@Component({
  selector: 'lib-ai-file-viewer',
  standalone: true,
  templateUrl: './ai-file-viewer.html',
  styleUrls: ['./ai-file-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiFileViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = AI_ACCEPT_ATTR;
  readonly relatedTools = AI_RELATED_TOOLS;
  readonly supportedExtensions = AI_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = AI_FORMATS_LABEL;
  readonly formatsHint = AI_FORMATS_HINT;
  readonly viewModes: Array<{ id: AiViewMode; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'artboards', label: 'Artboards' },
    { id: 'layers', label: 'Layers' },
    { id: 'table', label: 'Rows' }
  ];

  files: AiLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: AiViewMode = 'preview';
  query = '';
  selectedPathId = '';
  selectedLayerId = '';
  selectedArtboardId = '';
  selectedRowIndex = 0;
  hiddenLayerIds = new Set<string>();
  view: AiViewTransform = defaultAiView();
  panning = false;

  private dragDepth = 0;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): AiLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportAi(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get filteredPaths(): AiPath[] {
    return this.parsed ? filterAiPaths(this.parsed.paths, this.query) : [];
  }

  get filteredArtboards(): AiArtboard[] {
    return this.parsed ? filterAiArtboards(this.parsed.artboards, this.query) : [];
  }

  get filteredLayers(): AiLayer[] {
    return this.parsed ? filterAiLayers(this.parsed.layers, this.query) : [];
  }

  get filteredColumns(): AiColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterAiRows(this.parsed.rows, this.query) : [];
  }

  get visiblePaths(): AiPath[] {
    return this.filteredPaths.filter((s) => !this.hiddenLayerIds.has(s.layer));
  }

  get selectedPath(): AiPath | null {
    return this.filteredPaths.find((s) => s.id === this.selectedPathId) ?? this.filteredPaths[0] ?? null;
  }

  get selectedLayer(): AiLayer | null {
    return this.filteredLayers.find((l) => l.id === this.selectedLayerId) ?? null;
  }

  get selectedArtboard(): AiArtboard | null {
    return this.filteredArtboards.find((a) => a.id === this.selectedArtboardId) ?? this.filteredArtboards[0] ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildAiMetadataRows(this.parsed) : [];
  }

  get pathMetadataRows() {
    return this.selectedPath ? buildAiPathMetadata(this.selectedPath) : [];
  }

  get layerMetadataRows() {
    return this.selectedLayer ? buildAiLayerMetadata(this.selectedLayer) : [];
  }

  get artboardMetadataRows() {
    return this.selectedArtboard ? buildAiArtboardMetadata(this.selectedArtboard) : [];
  }

  get zoomPercent(): number {
    return Math.round(this.view.scale * 100);
  }

  get primarySuggestion() {
    const s = resolveAiSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isLayerHidden(id: string): boolean {
    return this.hiddenLayerIds.has(id);
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
      else if (this.viewMode === 'artboards') this.shiftArtboard(1);
      else if (this.viewMode === 'layers') this.shiftLayer(1);
      else this.shiftPath(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'artboards') this.shiftArtboard(-1);
      else if (this.viewMode === 'layers') this.shiftLayer(-1);
      else this.shiftPath(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: AiLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByPath(_i: number, shape: AiPath): string {
    return shape.id;
  }

  trackByArtboard(_i: number, board: AiArtboard): string {
    return board.id;
  }

  trackByLayer(_i: number, layer: AiLayer): string {
    return layer.id;
  }

  trackByColumn(_i: number, column: AiColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatAiFileSize(bytes);
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
    const { accepted, rejected } = filterValidAiFiles(files);
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
          const bytes = await readAiFileBytes(file);
          const record = createAiFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid AI dump'}`;
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
    await this.handleFiles([createSampleAiFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.fitView();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectPath(id: string): void {
    this.selectedPathId = id;
    const shape = this.filteredPaths.find((s) => s.id === id);
    if (shape) this.selectedLayerId = shape.layer;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectLayer(id: string): void {
    this.selectedLayerId = id;
    const next = this.filteredPaths.find((s) => s.layer === id);
    if (next) this.selectedPathId = next.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectArtboard(id: string): void {
    this.selectedArtboardId = id;
    const next = this.filteredPaths.find((s) => s.artboard === id);
    if (next) this.selectedPathId = next.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row?.name) return;
    if (this.filteredPaths.some((s) => s.id === row.name || s.name === row.name)) this.selectedPathId = row.name;
    if (this.filteredLayers.some((l) => l.id === row.name || l.name === row.name)) this.selectedLayerId = row.name;
    if (this.filteredArtboards.some((a) => a.id === row.name || a.name === row.name)) this.selectedArtboardId = row.name;
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
    if (this.selectedPathId && !this.filteredPaths.some((s) => s.id === this.selectedPathId)) {
      this.selectedPathId = this.filteredPaths[0]?.id ?? '';
    }
    if (this.selectedLayerId && !this.filteredLayers.some((l) => l.id === this.selectedLayerId)) {
      this.selectedLayerId = this.filteredLayers[0]?.id ?? '';
    }
    if (this.selectedArtboardId && !this.filteredArtboards.some((a) => a.id === this.selectedArtboardId)) {
      this.selectedArtboardId = this.filteredArtboards[0]?.id ?? '';
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
    this.selectedPathId = '';
    this.selectedLayerId = '';
    this.selectedArtboardId = '';
    this.selectedRowIndex = 0;
    this.hiddenLayerIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.view = defaultAiView();
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

  setViewMode(mode: AiViewMode): void {
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

  exportAs(format: AiExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportAiSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportAiSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportAiRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
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
    this.view = fitAiView(this.visiblePaths, width, height);
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

  private shiftPath(delta: number): void {
    const list = this.filteredPaths;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedPathId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPath(next.id);
  }

  private shiftArtboard(delta: number): void {
    const list = this.filteredArtboards;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((a) => a.id === this.selectedArtboardId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectArtboard(next.id);
  }

  private shiftLayer(delta: number): void {
    const list = this.filteredLayers;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((l) => l.id === this.selectedLayerId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLayer(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenLayerIds = new Set();
    this.selectedPathId = this.parsed?.paths[0]?.id ?? '';
    this.selectedLayerId = this.parsed?.layers[0]?.id ?? '';
    this.selectedArtboardId = this.parsed?.artboards[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.view = defaultAiView();
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
    renderAiPreview(canvas, this.visiblePaths, this.selectedPathId || null, this.view);
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
