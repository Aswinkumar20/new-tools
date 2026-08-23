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
  AV_ACCEPT_ATTR,
  AV_FORMATS_HINT,
  AV_FORMATS_LABEL,
  AV_RELATED_TOOLS,
  AV_SUPPORTED_EXTENSIONS
} from '../../constants/avro-viewer.constants';
import type { AvExportFormat, AvField, AvLoadedFile, AvRecord, AvViewMode } from '../../types/avro-viewer.types';
import {
  avFieldColor,
  buildAvFieldMetadata,
  buildAvMetadataRows,
  buildAvRecordMetadata,
  canExportAv,
  canvasToPngDataUrl,
  createAvFileRecord,
  createSampleAvFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportAvRecordsCsv,
  exportAvSchemaCsv,
  exportAvSummaryJson,
  filterAvFields,
  filterAvRecords,
  filterValidAvFiles,
  formatAvFileSize,
  readAvFileBytes,
  renderAvDiagram,
  renderAvSample,
  renderAvSchema,
  resolveAvSuggestion
} from '../../utils/avro-viewer.utils';
import { previewRecordLabel, buildDataInsightStats } from '../../utils/data-file.utils';

@Component({
  selector: 'lib-avro-viewer',
  standalone: true,
  templateUrl: './avro-viewer.html',
  styleUrls: ['./avro-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvroViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = AV_ACCEPT_ATTR;
  readonly relatedTools = AV_RELATED_TOOLS;
  readonly supportedExtensions = AV_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = AV_FORMATS_LABEL;
  readonly formatsHint = AV_FORMATS_HINT;
  readonly viewModes: Array<{ id: AvViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'schema', label: 'Schema' },
    { id: 'sample', label: 'Sample' },
    { id: 'table', label: 'Table' }
  ];

  files: AvLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: AvViewMode = 'diagram';
  query = '';
  selectedFieldId = '';
  selectedRecordId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): AvLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportAv(this.currentFile);
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

  get selectedField(): AvField | null {
    return this.parsed?.fields.find((f) => f.id === this.selectedFieldId) ?? null;
  }

  get selectedRecord(): AvRecord | null {
    return this.parsed?.records.find((r) => r.id === this.selectedRecordId) ?? null;
  }

  get filteredFields(): AvField[] {
    return this.parsed ? filterAvFields(this.parsed.fields, this.query) : [];
  }

  get filteredRecords(): AvRecord[] {
    return this.parsed ? filterAvRecords(this.parsed.records, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildAvMetadataRows(this.parsed) : [];
  }

  get fieldMetadataRows() {
    return this.selectedField ? buildAvFieldMetadata(this.selectedField) : [];
  }

  get recordMetadataRows() {
    return this.selectedRecord ? buildAvRecordMetadata(this.selectedRecord) : [];
  }

  get primarySuggestion() {
    const s = resolveAvSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(type: string, index: number): string {
    return avFieldColor(type, index);
  }

  recordValue(record: AvRecord, field: string): string {
    return record.values[field] || '';
  }

  recordPreview(record: AvRecord, fallback = ''): string {
    return previewRecordLabel(record.values, fallback || record.id);
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
      if (this.viewMode === 'sample' || this.viewMode === 'table') this.shiftRecord(1);
      else this.shiftField(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'sample' || this.viewMode === 'table') this.shiftRecord(-1);
      else this.shiftField(-1);
    }
  }

  trackByFileId(_i: number, file: AvLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByField(_i: number, field: AvField): string {
    return field.id;
  }

  trackByRecord(_i: number, record: AvRecord): string {
    return record.id;
  }

  formatSize(bytes: number): string {
    return formatAvFileSize(bytes);
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
    const { accepted, rejected } = filterValidAvFiles(files);
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
          const bytes = await readAvFileBytes(file);
          const record = createAvFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Avro file'}`;
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
    await this.handleFiles([createSampleAvFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectField(id: string): void {
    this.selectedFieldId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRecord(id: string): void {
    this.selectedRecordId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const field = this.filteredFields[0];
    if (field && !this.filteredFields.some((f) => f.id === this.selectedFieldId)) this.selectedFieldId = field.id;
    const rec = this.filteredRecords[0];
    if (rec && !this.filteredRecords.some((r) => r.id === this.selectedRecordId)) this.selectedRecordId = rec.id;
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
    this.selectedFieldId = '';
    this.selectedRecordId = '';
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

  setViewMode(mode: AvViewMode): void {
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

  exportAs(format: AvExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportAvSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportAvSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'records-csv') downloadTextFile(exportAvRecordsCsv(file.parsed), `${file.name}.records.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Schema, or Sample to export a PNG snapshot');
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

  private shiftField(delta: number): void {
    const list = this.filteredFields;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((f) => f.id === this.selectedFieldId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectField(next.id);
  }

  private shiftRecord(delta: number): void {
    const list = this.filteredRecords;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedRecordId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectRecord(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedFieldId = this.parsed?.fields[0]?.id ?? '';
    this.selectedRecordId = this.parsed?.records[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'diagram' ? 260 : 200, parent.clientHeight || 240));
    }
    if (this.viewMode === 'diagram') renderAvDiagram(canvas, this.parsed.recordName, this.parsed.fields, this.selectedFieldId || null);
    else if (this.viewMode === 'schema') renderAvSchema(canvas, this.filteredFields, this.selectedFieldId || null);
    else renderAvSample(canvas, this.filteredRecords, this.selectedRecordId || null);
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
