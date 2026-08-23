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
import { buildDiagramInsightStats } from '../../utils/diagram-file.utils';
import {
  DBML_ACCEPT_ATTR,
  DBML_FORMATS_HINT,
  DBML_FORMATS_LABEL,
  DBML_RELATED_TOOLS,
  DBML_SUPPORTED_EXTENSIONS
} from '../../constants/dbml-viewer.constants';
import type { DbmlExportFormat, DbmlLoadedFile, DbmlRef, DbmlTable, DbmlViewMode } from '../../types/dbml-viewer.types';
import {
  buildDbmlMetadataRows,
  buildDbmlRefMetadata,
  buildDbmlTableMetadata,
  canExportDbml,
  canvasToPngDataUrl,
  createDbmlFileRecord,
  createSampleDbmlFile,
  dbmlTableColor,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDbmlRefsCsv,
  exportDbmlSummaryJson,
  exportDbmlTablesCsv,
  filterDbmlRefs,
  filterDbmlTables,
  filterValidDbmlFiles,
  formatDbmlFileSize,
  readDbmlFileBytes,
  renderDbmlDiagram,
  renderDbmlRefs,
  renderDbmlTables,
  resolveDbmlSuggestion
} from '../../utils/dbml-viewer.utils';

@Component({
  selector: 'lib-dbml-viewer',
  standalone: true,
  templateUrl: './dbml-viewer.html',
  styleUrls: ['./dbml-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbmlViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = DBML_ACCEPT_ATTR;
  readonly relatedTools = DBML_RELATED_TOOLS;
  readonly supportedExtensions = DBML_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = DBML_FORMATS_LABEL;
  readonly formatsHint = DBML_FORMATS_HINT;
  readonly viewModes: Array<{ id: DbmlViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'tables', label: 'Tables' },
    { id: 'refs', label: 'Refs' },
    { id: 'table', label: 'Table' }
  ];

  files: DbmlLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: DbmlViewMode = 'diagram';
  query = '';
  selectedTableId = '';
  selectedRefId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): DbmlLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportDbml(this.currentFile);
  }

  get insights() {
    return buildDiagramInsightStats(
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

  get selectedTable(): DbmlTable | null {
    return this.parsed?.tables.find((t) => t.id === this.selectedTableId) ?? null;
  }

  get selectedRef(): DbmlRef | null {
    return this.parsed?.refs.find((r) => r.id === this.selectedRefId) ?? null;
  }

  get filteredTables(): DbmlTable[] {
    return this.parsed ? filterDbmlTables(this.parsed.tables, this.query) : [];
  }

  get filteredRefs(): DbmlRef[] {
    return this.parsed ? filterDbmlRefs(this.parsed.refs, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildDbmlMetadataRows(this.parsed) : [];
  }

  get tableMetadataRows() {
    return this.selectedTable ? buildDbmlTableMetadata(this.selectedTable) : [];
  }

  get refMetadataRows() {
    return this.selectedRef ? buildDbmlRefMetadata(this.selectedRef) : [];
  }

  get primarySuggestion() {
    const s = resolveDbmlSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(_kind: string, index: number): string {
    return dbmlTableColor(index);
  }

  columnBadge(column: { pk: boolean; fk: boolean; unique: boolean }): string {
    if (column.pk) return 'PK';
    if (column.fk) return 'FK';
    if (column.unique) return 'UK';
    return '';
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
      if (this.viewMode === 'refs' || this.viewMode === 'table') this.shiftRef(1);
      else this.shiftTable(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'refs' || this.viewMode === 'table') this.shiftRef(-1);
      else this.shiftTable(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: DbmlLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByTable(_i: number, table: DbmlTable): string {
    return table.id;
  }

  trackByRef(_i: number, ref: DbmlRef): string {
    return ref.id;
  }

  formatSize(bytes: number): string {
    return formatDbmlFileSize(bytes);
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
    const { accepted, rejected } = filterValidDbmlFiles(files);
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
          const bytes = await readDbmlFileBytes(file);
          const record = createDbmlFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid DBML'}`;
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
    await this.handleFiles([createSampleDbmlFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectTable(id: string): void {
    this.selectedTableId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRef(id: string): void {
    this.selectedRefId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const table = this.filteredTables[0];
    if (table && !this.filteredTables.some((t) => t.id === this.selectedTableId)) this.selectedTableId = table.id;
    const ref = this.filteredRefs[0];
    if (ref && !this.filteredRefs.some((r) => r.id === this.selectedRefId)) this.selectedRefId = ref.id;
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
    this.selectedTableId = '';
    this.selectedRefId = '';
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

  setViewMode(mode: DbmlViewMode): void {
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

  exportAs(format: DbmlExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportDbmlSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'tables-csv') downloadTextFile(exportDbmlTablesCsv(file.parsed), `${file.name}.tables.csv`, 'text/csv');
      else if (format === 'refs-csv') downloadTextFile(exportDbmlRefsCsv(file.parsed), `${file.name}.refs.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Tables, or Refs to export a PNG snapshot');
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

  private shiftTable(delta: number): void {
    const list = this.filteredTables;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((t) => t.id === this.selectedTableId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectTable(next.id);
  }

  private shiftRef(delta: number): void {
    const list = this.filteredRefs;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedRefId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectRef(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedTableId = this.parsed?.tables[0]?.id ?? '';
    this.selectedRefId = this.parsed?.refs[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'diagram' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'diagram') {
      renderDbmlDiagram(canvas, this.parsed.tables, this.parsed.refs, this.selectedTableId || null);
    } else if (this.viewMode === 'tables') {
      renderDbmlTables(canvas, this.filteredTables, this.selectedTableId || null);
    } else renderDbmlRefs(canvas, this.filteredRefs, this.selectedRefId || null);
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
