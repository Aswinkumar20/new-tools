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
  JN_ACCEPT_ATTR,
  JN_FORMATS_HINT,
  JN_FORMATS_LABEL,
  JN_RELATED_TOOLS,
  JN_SUPPORTED_EXTENSIONS
} from '../../constants/json-viewer.constants';
import type {
  JnColumn,
  JnExportFormat,
  JnLoadedFile,
  JnNode,
  JnSchemaEntry,
  JnViewMode
} from '../../types/json-viewer.types';
import {
  buildJnMetadataRows,
  buildJnNodeMetadata,
  buildJnSchemaMetadata,
  canExportJn,
  canvasToPngDataUrl,
  createJnFileRecord,
  createSampleJnFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportJnRowsCsv,
  exportJnSchemaCsv,
  exportJnSummaryJson,
  filterJnNodes,
  filterJnRows,
  filterJnSchema,
  filterValidJnFiles,
  formatJnFileSize,
  jnTypeColor,
  readJnFileBytes,
  renderJnPreview,
  renderJnSchema,
  renderJnTree,
  resolveJnSuggestion
} from '../../utils/json-viewer.utils';
import { entriesFromRecord, previewRecordLabel, buildDataInsightStats } from '../../utils/data-file.utils';

@Component({
  selector: 'lib-json-viewer',
  standalone: true,
  templateUrl: './json-viewer.html',
  styleUrls: ['./json-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JsonViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = JN_ACCEPT_ATTR;
  readonly relatedTools = JN_RELATED_TOOLS;
  readonly supportedExtensions = JN_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = JN_FORMATS_LABEL;
  readonly formatsHint = JN_FORMATS_HINT;
  readonly viewModes: Array<{ id: JnViewMode; label: string }> = [
    { id: 'tree', label: 'Tree' },
    { id: 'schema', label: 'Schema' },
    { id: 'preview', label: 'Preview' },
    { id: 'table', label: 'Rows' }
  ];

  files: JnLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: JnViewMode = 'tree';
  query = '';
  selectedNodeId = '';
  selectedSchemaId = '';
  selectedRowIndex = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): JnLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportJn(this.currentFile);
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

  get filteredNodes(): JnNode[] {
    return this.parsed ? filterJnNodes(this.parsed.nodes, this.query) : [];
  }

  get filteredSchema(): JnSchemaEntry[] {
    return this.parsed ? filterJnSchema(this.parsed.schema, this.query) : [];
  }

  get filteredColumns(): JnColumn[] {
    return this.parsed?.columns ?? [];
  }

  get selectedRow(): Record<string, string> | null {
    return this.filteredRows[this.selectedRowIndex] ?? null;
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterJnRows(this.parsed.rows, this.query) : [];
  }

  get selectedNode(): JnNode | null {
    return this.filteredNodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  get selectedSchema(): JnSchemaEntry | null {
    return this.filteredSchema.find((s) => s.id === this.selectedSchemaId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildJnMetadataRows(this.parsed) : [];
  }

  get nodeMetadataRows() {
    return this.selectedNode ? buildJnNodeMetadata(this.selectedNode) : [];
  }

  get schemaMetadataRows() {
    return this.selectedSchema ? buildJnSchemaMetadata(this.selectedSchema) : [];
  }

  get primarySuggestion() {
    const s = resolveJnSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  get selectedRowEntries() {
    return this.selectedRow ? entriesFromRecord(this.selectedRow) : [];
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  tint(type: string, index: number): string {
    return jnTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  rowPreview(row: Record<string, string>, fallback = 'row'): string {
    return previewRecordLabel(row, fallback);
  }

  indentPx(depth: number): number {
    return Math.min(8, depth) * 12;
  }

  formatSize(bytes: number): string {
    return formatJnFileSize(bytes);
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
      else if (this.viewMode === 'schema') this.shiftSchema(1);
      else this.shiftNode(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'preview' || this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'schema') this.shiftSchema(-1);
      else this.shiftNode(-1);
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: JnLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByNode(_i: number, node: JnNode): string {
    return node.id;
  }

  trackBySchema(_i: number, entry: JnSchemaEntry): string {
    return entry.id;
  }

  trackByColumn(_i: number, column: JnColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
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
    const { accepted, rejected } = filterValidJnFiles(files);
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
          const bytes = await readJnFileBytes(file);
          const record = createJnFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid JSON file'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no structure — metadata may still be available');
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
    await this.handleFiles([createSampleJnFile()]);
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
    this.selectedNodeId = '';
    this.selectedSchemaId = '';
    this.selectedRowIndex = 0;
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

  selectNode(id: string): void {
    this.selectedNodeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectSchema(id: string): void {
    this.selectedSchemaId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedNodeId && !this.filteredNodes.some((n) => n.id === this.selectedNodeId)) {
      this.selectedNodeId = this.filteredNodes[0]?.id ?? '';
    }
    if (this.selectedSchemaId && !this.filteredSchema.some((s) => s.id === this.selectedSchemaId)) {
      this.selectedSchemaId = this.filteredSchema[0]?.id ?? '';
    }
    if (this.selectedRowIndex >= this.filteredRows.length) {
      this.selectedRowIndex = Math.max(0, this.filteredRows.length - 1);
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

  setViewMode(mode: JnViewMode): void {
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

  exportAs(format: JnExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/json');
      else if (format === 'summary-json') downloadTextFile(exportJnSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportJnSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportJnRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Tree, Schema, or Preview to export a PNG snapshot');
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

  private shiftNode(delta: number): void {
    const list = this.filteredNodes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedNodeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectNode(next.id);
  }

  private shiftSchema(delta: number): void {
    const list = this.filteredSchema;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedSchemaId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectSchema(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedNodeId = this.parsed?.nodes[0]?.id ?? '';
    this.selectedSchemaId = this.parsed?.schema[0]?.id ?? '';
    this.selectedRowIndex = 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'tree' ? 220 : 200, parent.clientHeight || 240));
    }
    if (this.viewMode === 'tree') renderJnTree(canvas, this.filteredNodes, this.selectedNodeId || null);
    else if (this.viewMode === 'schema') renderJnSchema(canvas, this.filteredSchema, this.selectedSchemaId || null);
    else renderJnPreview(canvas, this.filteredRows, this.selectedRowIndex);
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
