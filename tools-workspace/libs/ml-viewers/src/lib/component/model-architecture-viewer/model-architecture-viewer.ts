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
import {
  MA_ACCEPT_ATTR,
  MA_FORMATS_HINT,
  MA_FORMATS_LABEL,
  MA_RELATED_TOOLS,
  MA_SUPPORTED_EXTENSIONS
} from '../../constants/model-architecture-viewer.constants';
import type {
  MaBlock,
  MaColumn,
  MaExportFormat,
  MaLoadedFile,
  MaParam,
  MaViewMode
} from '../../types/model-architecture-viewer.types';
import {
  buildMaBlockMetadata,
  buildMaMetadataRows,
  buildMaParamMetadata,
  canExportMa,
  canvasToPngDataUrl,
  createMaFileRecord,
  createSampleMaFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportMaRowsCsv,
  exportMaSchemaCsv,
  exportMaSummaryJson,
  filterMaBlocks,
  filterMaParams,
  filterMaRows,
  filterValidMaFiles,
  formatMaFileSize,
  maTypeColor,
  readMaFileBytes,
  renderMaBlocks,
  renderMaParams,
  renderMaPreview,
  resolveMaSuggestion
} from '../../utils/model-architecture-viewer.utils';

@Component({
  selector: 'lib-model-architecture-viewer',
  standalone: true,
  templateUrl: './model-architecture-viewer.html',
  styleUrls: ['./model-architecture-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModelArchitectureViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = MA_ACCEPT_ATTR;
  readonly relatedTools = MA_RELATED_TOOLS;
  readonly supportedExtensions = MA_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = MA_FORMATS_LABEL;
  readonly formatsHint = MA_FORMATS_HINT;
  readonly viewModes: Array<{ id: MaViewMode; label: string }> = [
    { id: 'blocks', label: 'Blocks' },
    { id: 'params', label: 'Params' },
    { id: 'preview', label: 'Preview' },
    { id: 'table', label: 'Rows' }
  ];

  files: MaLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: MaViewMode = 'blocks';
  query = '';
  selectedBlockId = '';
  selectedParamId = '';
  selectedRowIndex = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): MaLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportMa(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get filteredBlocks(): MaBlock[] {
    return this.parsed ? filterMaBlocks(this.parsed.blocks, this.query) : [];
  }

  get filteredParams(): MaParam[] {
    return this.parsed ? filterMaParams(this.parsed.params, this.query) : [];
  }

  get filteredColumns(): MaColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterMaRows(this.parsed.rows, this.query) : [];
  }

  get selectedBlock(): MaBlock | null {
    return this.filteredBlocks.find((n) => n.id === this.selectedBlockId) ?? null;
  }

  get selectedParam(): MaParam | null {
    return this.filteredParams.find((s) => s.id === this.selectedParamId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildMaMetadataRows(this.parsed) : [];
  }

  get blockMetadataRows() {
    return this.selectedBlock ? buildMaBlockMetadata(this.selectedBlock) : [];
  }

  get paramMetadataRows() {
    return this.selectedParam ? buildMaParamMetadata(this.selectedParam) : [];
  }

  get primarySuggestion() {
    const s = resolveMaSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(type: string, index: number): string {
    return maTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
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
      if (this.viewMode === 'preview' || this.viewMode === 'table') this.shiftRow(1);
      else if (this.viewMode === 'params') this.shiftParam(1);
      else this.shiftBlock(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'preview' || this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'params') this.shiftParam(-1);
      else this.shiftBlock(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: MaLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByBlock(_i: number, block: MaBlock): string {
    return block.id;
  }

  trackByParam(_i: number, entry: MaParam): string {
    return entry.id;
  }

  trackByColumn(_i: number, column: MaColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatMaFileSize(bytes);
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
    const { accepted, rejected } = filterValidMaFiles(files);
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
          const bytes = await readMaFileBytes(file);
          const record = createMaFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid architecture dump'}`;
          this.toast.error(this.errorMessage);
        }
      }
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
    await this.handleFiles([createSampleMaFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectBlock(id: string): void {
    this.selectedBlockId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectParam(id: string): void {
    this.selectedParamId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedBlockId && !this.filteredBlocks.some((n) => n.id === this.selectedBlockId)) {
      this.selectedBlockId = this.filteredBlocks[0]?.id ?? '';
    }
    if (this.selectedParamId && !this.filteredParams.some((s) => s.id === this.selectedParamId)) {
      this.selectedParamId = this.filteredParams[0]?.id ?? '';
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
    this.renderCanvas();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedBlockId = '';
    this.selectedParamId = '';
    this.selectedRowIndex = 0;
    this.errorMessage = '';
    this.query = '';
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

  setViewMode(mode: MaViewMode): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: MaExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportMaSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportMaSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportMaRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Blocks, Params, or Preview to export a PNG snapshot');
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

  private shiftBlock(delta: number): void {
    const list = this.filteredBlocks;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedBlockId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectBlock(next.id);
  }

  private shiftParam(delta: number): void {
    const list = this.filteredParams;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedParamId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectParam(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedBlockId = this.parsed?.blocks[0]?.id ?? '';
    this.selectedParamId = this.parsed?.params[0]?.id ?? '';
    this.selectedRowIndex = 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'blocks' ? 220 : 200, parent.clientHeight || 240));
    }
    if (this.viewMode === 'blocks') renderMaBlocks(canvas, this.filteredBlocks, this.selectedBlockId || null);
    else if (this.viewMode === 'params') renderMaParams(canvas, this.filteredParams, this.selectedParamId || null);
    else renderMaPreview(canvas, this.filteredRows, this.selectedRowIndex);
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
