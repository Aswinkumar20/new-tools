import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { RT_ACCEPT_ATTR, RT_FORMATS_HINT, RT_FORMATS_LABEL, RT_RELATED_TOOLS, RT_SUPPORTED_EXTENSIONS } from '../../constants/rtf-viewer.constants';
import type { RtColumn, RtStyle, RtSpan, RtExportFormat, RtLoadedFile, RtBlock, RtViewMode } from '../../types/rtf-viewer.types';
import {
  buildRtStyleMetadata,
  buildRtSpanMetadata,
  buildRtMetadataRows,
  buildRtBlockMetadata,
  canExportRt,
  createRtFileRecord,
  createSampleRtFile,
  downloadBinaryFile,
  downloadTextFile,
  exportRtRowsCsv,
  exportRtSchemaCsv,
  exportRtHtml,
  exportRtSummaryJson,
  filterRtStyles,
  filterRtSpans,
  filterRtRows,
  filterRtBlocks,
  filterValidRtFiles,
  formatRtFileSize,
  readRtFileBytes,
  resolveRtSuggestion
} from '../../utils/rtf-viewer.utils';

@Component({
  selector: 'lib-rtf-viewer',
  standalone: true,
  templateUrl: './rtf-viewer.html',
  styleUrls: ['./rtf-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RtfViewerComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = RT_ACCEPT_ATTR;
  readonly relatedTools = RT_RELATED_TOOLS;
  readonly supportedExtensions = RT_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = RT_FORMATS_LABEL;
  readonly formatsHint = RT_FORMATS_HINT;
  readonly viewModes: Array<{ id: RtViewMode; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'styles', label: 'Styles' },
    { id: 'blocks', label: 'Blocks' },
    { id: 'table', label: 'Rows' }
  ];

  files: RtLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: RtViewMode = 'preview';
  query = '';
  selectedBlockId = '';
  selectedStyleId = '';
  selectedSpanId = '';
  selectedRowIndex = 0;

  private dragDepth = 0;

  get currentFile(): RtLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportRt(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get filteredBlocks(): RtBlock[] {
    return this.parsed ? filterRtBlocks(this.parsed.blocks, this.query) : [];
  }

  get filteredStyles(): RtStyle[] {
    return this.parsed ? filterRtStyles(this.parsed.styles, this.query) : [];
  }

  get filteredSpans(): RtSpan[] {
    return this.parsed ? filterRtSpans(this.parsed.spans, this.query) : [];
  }

  get filteredColumns(): RtColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterRtRows(this.parsed.rows, this.query) : [];
  }

  get selectedBlock(): RtBlock | null {
    return this.filteredBlocks.find((s) => s.id === this.selectedBlockId) ?? this.filteredBlocks[0] ?? null;
  }

  get selectedStyle(): RtStyle | null {
    return this.filteredStyles.find((c) => c.id === this.selectedStyleId) ?? null;
  }

  get selectedSpan(): RtSpan | null {
    return this.filteredSpans.find((e) => e.id === this.selectedSpanId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildRtMetadataRows(this.parsed) : [];
  }

  get blockMetadataRows() {
    return this.selectedBlock ? buildRtBlockMetadata(this.selectedBlock) : [];
  }

  get styleMetadataRows() {
    return this.selectedStyle ? buildRtStyleMetadata(this.selectedStyle) : [];
  }

  get spanMetadataRows() {
    return this.selectedSpan ? buildRtSpanMetadata(this.selectedSpan) : [];
  }

  get primarySuggestion() {
    const s = resolveRtSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
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
      else if (this.viewMode === 'styles') this.shiftStyle(1);
      else this.shiftBlock(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'styles') this.shiftStyle(-1);
      else this.shiftBlock(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: RtLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByBlock(_i: number, section: RtBlock): string {
    return section.id;
  }

  trackByStyle(_i: number, command: RtStyle): string {
    return command.id;
  }

  trackBySpan(_i: number, env: RtSpan): string {
    return env.id;
  }

  trackByColumn(_i: number, column: RtColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatRtFileSize(bytes);
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
    const { accepted, rejected } = filterValidRtFiles(files);
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
          const bytes = await readRtFileBytes(file);
          const record = createRtFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid RTF dump'}`;
          this.toast.error(this.errorMessage);
        }
      }
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
    await this.handleFiles([createSampleRtFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.cdr.markForCheck();
  }

  selectBlock(id: string): void {
    this.selectedBlockId = id;
    this.cdr.markForCheck();
  }

  selectStyle(id: string): void {
    this.selectedStyleId = id;
    this.cdr.markForCheck();
  }

  selectSpan(id: string): void {
    this.selectedSpanId = id;
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row?.name) return;
    if (this.filteredBlocks.some((s) => s.id === row.name || s.name === row.name)) this.selectedBlockId = row.name;
    if (this.filteredStyles.some((c) => c.name === row.name || c.id === row.name)) {
      this.selectedStyleId = this.filteredStyles.find((c) => c.name === row.name || c.id === row.name)?.id ?? '';
    }
    if (this.filteredSpans.some((e) => e.id === row.name || e.name === row.name)) this.selectedSpanId = row.name;
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedBlockId && !this.filteredBlocks.some((s) => s.id === this.selectedBlockId)) {
      this.selectedBlockId = this.filteredBlocks[0]?.id ?? '';
    }
    if (this.selectedStyleId && !this.filteredStyles.some((c) => c.id === this.selectedStyleId)) {
      this.selectedStyleId = this.filteredStyles[0]?.id ?? '';
    }
    if (this.selectedSpanId && !this.filteredSpans.some((e) => e.id === this.selectedSpanId)) {
      this.selectedSpanId = this.filteredSpans[0]?.id ?? '';
    }
    if (this.selectedRowIndex >= this.filteredRows.length) this.selectedRowIndex = Math.max(0, this.filteredRows.length - 1);
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
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedBlockId = '';
    this.selectedStyleId = '';
    this.selectedSpanId = '';
    this.selectedRowIndex = 0;
    this.errorMessage = '';
    this.query = '';
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

  setViewMode(mode: RtViewMode): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: RtExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportRtSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportRtSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportRtRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'html') downloadTextFile(exportRtHtml(file.parsed), `${file.name}.html`, 'text/html');
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private shiftBlock(delta: number): void {
    const list = this.filteredBlocks;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedBlockId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectBlock(next.id);
  }

  private shiftStyle(delta: number): void {
    const list = this.filteredStyles;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedStyleId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectStyle(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedBlockId = this.parsed?.blocks[0]?.id ?? '';
    this.selectedStyleId = this.parsed?.styles[0]?.id ?? '';
    this.selectedSpanId = this.parsed?.spans[0]?.id ?? '';
    this.selectedRowIndex = 0;
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
