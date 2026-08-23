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
import { RW_ACCEPT_ATTR, RW_FORMATS_HINT, RW_FORMATS_LABEL, RW_RELATED_TOOLS, RW_SUPPORTED_EXTENSIONS } from '../../constants/raw-image-viewer.constants';
import type { RwColumn, RwExif, RwExportFormat, RwChannel, RwLoadedFile, RwPreview, RwViewMode, RwViewTransform } from '../../types/raw-image-viewer.types';
import {
  buildRwExifMetadata,
  buildRwChannelMetadata,
  buildRwMetadataRows,
  canExportRw,
  canvasToPngDataUrl,
  createRwFileRecord,
  createSampleRwFile,
  defaultRwView,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportRwRowsCsv,
  exportRwSchemaCsv,
  exportRwSummaryJson,
  filterRwExifs,
  filterRwChannels,
  filterRwPreviews,
  filterRwRows,
  filterValidRwFiles,
  fitRwView,
  formatRwFileSize,
  readRwFileBytes,
  renderRwPreview,
  resolveRwSuggestion
} from '../../utils/raw-image-viewer.utils';

@Component({
  selector: 'lib-raw-image-viewer',
  standalone: true,
  templateUrl: './raw-image-viewer.html',
  styleUrls: ['./raw-image-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RawImageViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = RW_ACCEPT_ATTR;
  readonly relatedTools = RW_RELATED_TOOLS;
  readonly supportedExtensions = RW_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = RW_FORMATS_LABEL;
  readonly formatsHint = RW_FORMATS_HINT;
  readonly viewModes: Array<{ id: RwViewMode; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'exif', label: 'EXIF' },
    { id: 'channels', label: 'Channels' },
    { id: 'table', label: 'Rows' }
  ];

  files: RwLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: RwViewMode = 'preview';
  query = '';
  selectedChannelId = '';
  selectedExifId = '';
  selectedRowIndex = 0;
  hiddenChannelIds = new Set<string>();
  view: RwViewTransform = defaultRwView();
  panning = false;

  private dragDepth = 0;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): RwLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportRw(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get filteredChannels(): RwChannel[] {
    return this.parsed ? filterRwChannels(this.parsed.channels, this.query) : [];
  }

  get filteredExifs(): RwExif[] {
    return this.parsed ? filterRwExifs(this.parsed.exifs, this.query) : [];
  }

  get filteredPreviews(): RwPreview[] {
    return this.parsed ? filterRwPreviews(this.parsed.previews, this.query) : [];
  }

  get filteredColumns(): RwColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterRwRows(this.parsed.rows, this.query) : [];
  }

  get visiblePreviews(): RwPreview[] {
    return this.filteredPreviews;
  }

  get selectedChannel(): RwChannel | null {
    return this.filteredChannels.find((l) => l.id === this.selectedChannelId) ?? this.filteredChannels[0] ?? null;
  }

  get selectedExif(): RwExif | null {
    return this.filteredExifs.find((e) => e.id === this.selectedExifId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildRwMetadataRows(this.parsed) : [];
  }

  get channelMetadataRows() {
    return this.selectedChannel ? buildRwChannelMetadata(this.selectedChannel) : [];
  }

  get exifMetadataRows() {
    return this.selectedExif ? buildRwExifMetadata(this.selectedExif) : [];
  }

  get zoomPercent(): number {
    return Math.round(this.view.scale * 100);
  }

  get primarySuggestion() {
    const s = resolveRwSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isChannelHidden(id: string): boolean {
    return this.hiddenChannelIds.has(id);
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
      else if (this.viewMode === 'exif') this.shiftExif(1);
      else this.shiftChannel(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'exif') this.shiftExif(-1);
      else this.shiftChannel(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: RwLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByChannel(_i: number, layer: RwChannel): string {
    return layer.id;
  }

  trackByExif(_i: number, effect: RwExif): string {
    return effect.id;
  }

  trackByColumn(_i: number, column: RwColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatRwFileSize(bytes);
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
    const { accepted, rejected } = filterValidRwFiles(files);
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
          const bytes = await readRwFileBytes(file);
          const record = createRwFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid RAW dump'}`;
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
    await this.handleFiles([createSampleRwFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.fitView();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectChannel(id: string): void {
    this.selectedChannelId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectExif(id: string): void {
    this.selectedExifId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row?.name) return;
    if (this.filteredChannels.some((l) => l.id === row.name || l.name === row.name)) this.selectedChannelId = row.name;
    if (this.filteredExifs.some((e) => e.name === row.name || e.id === row.name)) {
      this.selectedExifId = this.filteredExifs.find((e) => e.name === row.name || e.id === row.name)?.id ?? '';
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleChannelVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenChannelIds.has(id)) this.hiddenChannelIds.delete(id);
    else this.hiddenChannelIds.add(id);
    this.hiddenChannelIds = new Set(this.hiddenChannelIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedChannelId && !this.filteredChannels.some((l) => l.id === this.selectedChannelId)) {
      this.selectedChannelId = this.filteredChannels[0]?.id ?? '';
    }
    if (this.selectedExifId && !this.filteredExifs.some((e) => e.id === this.selectedExifId)) {
      this.selectedExifId = this.filteredExifs[0]?.id ?? '';
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
    this.selectedChannelId = '';
    this.selectedExifId = '';
    this.selectedRowIndex = 0;
    this.hiddenChannelIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.view = defaultRwView();
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

  setViewMode(mode: RwViewMode): void {
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

  exportAs(format: RwExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportRwSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportRwSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportRwRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
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
    this.view = fitRwView(this.visiblePreviews, width, height);
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

  private shiftChannel(delta: number): void {
    const list = this.filteredChannels;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((l) => l.id === this.selectedChannelId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectChannel(next.id);
  }

  private shiftExif(delta: number): void {
    const list = this.filteredExifs;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedExifId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectExif(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenChannelIds = new Set();
    this.selectedChannelId = this.parsed?.channels[0]?.id ?? '';
    this.selectedExifId = this.parsed?.exifs[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.view = defaultRwView();
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
    renderRwPreview(canvas, this.visiblePreviews, this.selectedChannelId || null, this.view);
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
