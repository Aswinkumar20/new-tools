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
  ORC_ACCEPT_ATTR,
  ORC_FORMATS_HINT,
  ORC_FORMATS_LABEL,
  ORC_RELATED_TOOLS,
  ORC_SUPPORTED_EXTENSIONS
} from '../../constants/orc-viewer.constants';
import type { OrcColumn, OrcExportFormat, OrcLoadedFile, OrcStripe, OrcViewMode } from '../../types/orc-viewer.types';
import {
  buildOrcColumnMetadata,
  buildOrcMetadataRows,
  buildOrcStripeMetadata,
  canExportOrc,
  canvasToPngDataUrl,
  createOrcFileRecord,
  createSampleOrcFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportOrcRowsCsv,
  exportOrcSchemaCsv,
  exportOrcSummaryJson,
  filterOrcColumns,
  filterOrcRows,
  filterValidOrcFiles,
  formatOrcFileSize,
  orcColumnColor,
  readOrcFileBytes,
  renderOrcPreview,
  renderOrcSchema,
  renderOrcStripes,
  resolveOrcSuggestion
} from '../../utils/orc-viewer.utils';
import { entriesFromRecord, previewRecordLabel, buildDataInsightStats } from '../../utils/data-file.utils';

@Component({
  selector: 'lib-orc-viewer',
  standalone: true,
  templateUrl: './orc-viewer.html',
  styleUrls: ['./orc-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrcViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = ORC_ACCEPT_ATTR;
  readonly relatedTools = ORC_RELATED_TOOLS;
  readonly supportedExtensions = ORC_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = ORC_FORMATS_LABEL;
  readonly formatsHint = ORC_FORMATS_HINT;
  readonly viewModes: Array<{ id: OrcViewMode; label: string }> = [
    { id: 'schema', label: 'Schema' },
    { id: 'preview', label: 'Preview' },
    { id: 'stripes', label: 'Stripes' },
    { id: 'table', label: 'Table' }
  ];

  files: OrcLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: OrcViewMode = 'schema';
  query = '';
  selectedColumnId = '';
  selectedRowIndex = 0;
  selectedStripeIndex = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): OrcLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportOrc(this.currentFile);
  }

  get insights() {
    return buildDataInsightStats(
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

  get selectedColumn(): OrcColumn | null {
    return this.parsed?.columns.find((c) => c.id === this.selectedColumnId) ?? null;
  }

  get filteredColumns(): OrcColumn[] {
    return this.parsed ? filterOrcColumns(this.parsed.columns, this.query) : [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterOrcRows(this.parsed.rows, this.query) : [];
  }

  get filteredStripes(): OrcStripe[] {
    return this.parsed?.stripes ?? [];
  }

  get selectedRow(): Record<string, string> | null {
    return this.filteredRows[this.selectedRowIndex] ?? null;
  }

  get selectedStripe(): OrcStripe | null {
    return this.filteredStripes[this.selectedStripeIndex] ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildOrcMetadataRows(this.parsed) : [];
  }

  get columnMetadataRows() {
    return this.selectedColumn ? buildOrcColumnMetadata(this.selectedColumn) : [];
  }

  get stripeMetadataRows() {
    return this.selectedStripe ? buildOrcStripeMetadata(this.selectedStripe) : [];
  }

  get primarySuggestion() {
    const s = resolveOrcSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  get selectedRowEntries() {
    return this.selectedRow ? entriesFromRecord(this.selectedRow) : [];
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  tint(type: string, index: number): string {
    return orcColumnColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  rowPreview(row: Record<string, string>, fallback = 'row'): string {
    return previewRecordLabel(row, fallback);
  }

  formatSize(bytes: number): string {
    return formatOrcFileSize(bytes);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Host listeners
  // ---------------------------------------------------------------------------

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
    if (event.key === 'Escape' && this.showExportMenu) {
      event.preventDefault();
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
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
      else if (this.viewMode === 'stripes') this.shiftStripe(1);
      else this.shiftColumn(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'preview' || this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'stripes') this.shiftStripe(-1);
      else this.shiftColumn(-1);
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: OrcLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByColumn(_i: number, column: OrcColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  trackByStripe(_i: number, stripe: OrcStripe): number {
    return stripe.index;
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
    const { accepted, rejected } = filterValidOrcFiles(files);
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
          const bytes = await readOrcFileBytes(file);
          const record = createOrcFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid ORC file'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no schema — metadata may still be available');
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
    await this.handleFiles([createSampleOrcFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
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
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedColumnId = '';
    this.selectedRowIndex = 0;
    this.selectedStripeIndex = 0;
    this.errorMessage = '';
    this.query = '';
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Selection / filter
  // ---------------------------------------------------------------------------

  selectColumn(id: string): void {
    this.selectedColumnId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectStripe(index: number): void {
    this.selectedStripeIndex = index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedColumnId && !this.filteredColumns.some((c) => c.id === this.selectedColumnId)) {
      this.selectedColumnId = this.filteredColumns[0]?.id ?? '';
    }
    if (this.selectedRowIndex >= this.filteredRows.length) {
      this.selectedRowIndex = Math.max(0, this.filteredRows.length - 1);
    }
    if (this.selectedStripeIndex >= this.filteredStripes.length) {
      this.selectedStripeIndex = Math.max(0, this.filteredStripes.length - 1);
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Suggestions / view mode / chrome / export
  // ---------------------------------------------------------------------------

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setViewMode(mode: OrcViewMode): void {
    if (this.viewMode === mode) return;
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
    if (!this.canExport) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: OrcExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportOrcSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportOrcSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportOrcRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Schema, Preview, or Stripes to export a PNG snapshot');
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
  // Private helpers
  // ---------------------------------------------------------------------------

  private shiftColumn(delta: number): void {
    const list = this.filteredColumns;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((c) => c.id === this.selectedColumnId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectColumn(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private shiftStripe(delta: number): void {
    const list = this.filteredStripes;
    if (!list.length) return;
    this.selectStripe(Math.min(list.length - 1, Math.max(0, this.selectedStripeIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedColumnId = this.parsed?.columns[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.selectedStripeIndex = 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'stripes' ? 220 : 200, parent.clientHeight || 240));
    }
    if (this.viewMode === 'schema') renderOrcSchema(canvas, this.filteredColumns, this.selectedColumnId || null);
    else if (this.viewMode === 'preview') renderOrcPreview(canvas, this.filteredRows, this.selectedRowIndex);
    else renderOrcStripes(canvas, this.filteredStripes, this.selectedStripeIndex);
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
