import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { LX_ACCEPT_ATTR, LX_FORMATS_HINT, LX_FORMATS_LABEL, LX_RELATED_TOOLS, LX_SUPPORTED_EXTENSIONS } from '../../constants/latex-viewer.constants';
import type { LxColumn, LxCommand, LxEnv, LxExportFormat, LxLoadedFile, LxSection, LxViewMode } from '../../types/latex-viewer.types';
import {
  buildLxCommandMetadata,
  buildLxEnvMetadata,
  buildLxMetadataRows,
  buildLxSectionMetadata,
  canExportLx,
  createLxFileRecord,
  createSampleLxFile,
  downloadBinaryFile,
  downloadTextFile,
  exportLxRowsCsv,
  exportLxSchemaCsv,
  exportLxSourceTex,
  exportLxSummaryJson,
  filterLxCommands,
  filterLxEnvs,
  filterLxRows,
  filterLxSections,
  filterValidLxFiles,
  formatLxFileSize,
  readLxFileBytes,
  resolveLxSuggestion
} from '../../utils/latex-viewer.utils';

@Component({
  selector: 'lib-latex-viewer',
  standalone: true,
  templateUrl: './latex-viewer.html',
  styleUrls: ['./latex-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LatexViewerComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = LX_ACCEPT_ATTR;
  readonly relatedTools = LX_RELATED_TOOLS;
  readonly supportedExtensions = LX_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = LX_FORMATS_LABEL;
  readonly formatsHint = LX_FORMATS_HINT;
  readonly viewModes: Array<{ id: LxViewMode; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'structure', label: 'Structure' },
    { id: 'source', label: 'Source' },
    { id: 'table', label: 'Rows' }
  ];

  files: LxLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: LxViewMode = 'preview';
  query = '';
  selectedSectionId = '';
  selectedCommandId = '';
  selectedEnvId = '';
  selectedRowIndex = 0;

  private dragDepth = 0;

  get currentFile(): LxLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportLx(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get filteredSections(): LxSection[] {
    return this.parsed ? filterLxSections(this.parsed.sections, this.query) : [];
  }

  get filteredCommands(): LxCommand[] {
    return this.parsed ? filterLxCommands(this.parsed.commands, this.query) : [];
  }

  get filteredEnvs(): LxEnv[] {
    return this.parsed ? filterLxEnvs(this.parsed.envs, this.query) : [];
  }

  get filteredColumns(): LxColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterLxRows(this.parsed.rows, this.query) : [];
  }

  get selectedSection(): LxSection | null {
    return this.filteredSections.find((s) => s.id === this.selectedSectionId) ?? this.filteredSections[0] ?? null;
  }

  get selectedCommand(): LxCommand | null {
    return this.filteredCommands.find((c) => c.id === this.selectedCommandId) ?? null;
  }

  get selectedEnv(): LxEnv | null {
    return this.filteredEnvs.find((e) => e.id === this.selectedEnvId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildLxMetadataRows(this.parsed) : [];
  }

  get sectionMetadataRows() {
    return this.selectedSection ? buildLxSectionMetadata(this.selectedSection) : [];
  }

  get commandMetadataRows() {
    return this.selectedCommand ? buildLxCommandMetadata(this.selectedCommand) : [];
  }

  get envMetadataRows() {
    return this.selectedEnv ? buildLxEnvMetadata(this.selectedEnv) : [];
  }

  get primarySuggestion() {
    const s = resolveLxSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
      else this.shiftSection(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else this.shiftSection(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: LxLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackBySection(_i: number, section: LxSection): string {
    return section.id;
  }

  trackByCommand(_i: number, command: LxCommand): string {
    return command.id;
  }

  trackByEnv(_i: number, env: LxEnv): string {
    return env.id;
  }

  trackByColumn(_i: number, column: LxColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatLxFileSize(bytes);
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
    const { accepted, rejected } = filterValidLxFiles(files);
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
          const bytes = await readLxFileBytes(file);
          const record = createLxFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid LaTeX dump'}`;
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
    await this.handleFiles([createSampleLxFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.cdr.markForCheck();
  }

  selectSection(id: string): void {
    this.selectedSectionId = id;
    this.cdr.markForCheck();
  }

  selectCommand(id: string): void {
    this.selectedCommandId = id;
    this.cdr.markForCheck();
  }

  selectEnv(id: string): void {
    this.selectedEnvId = id;
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row?.name) return;
    if (this.filteredSections.some((s) => s.id === row.name || s.name === row.name)) this.selectedSectionId = row.name;
    if (this.filteredCommands.some((c) => c.name === row.name || c.id === row.name)) {
      this.selectedCommandId = this.filteredCommands.find((c) => c.name === row.name || c.id === row.name)?.id ?? '';
    }
    if (this.filteredEnvs.some((e) => e.id === row.name || e.name === row.name)) this.selectedEnvId = row.name;
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedSectionId && !this.filteredSections.some((s) => s.id === this.selectedSectionId)) {
      this.selectedSectionId = this.filteredSections[0]?.id ?? '';
    }
    if (this.selectedCommandId && !this.filteredCommands.some((c) => c.id === this.selectedCommandId)) {
      this.selectedCommandId = this.filteredCommands[0]?.id ?? '';
    }
    if (this.selectedEnvId && !this.filteredEnvs.some((e) => e.id === this.selectedEnvId)) {
      this.selectedEnvId = this.filteredEnvs[0]?.id ?? '';
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
    this.selectedSectionId = '';
    this.selectedCommandId = '';
    this.selectedEnvId = '';
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

  setViewMode(mode: LxViewMode): void {
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

  exportAs(format: LxExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportLxSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportLxSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportLxRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'source-tex') downloadTextFile(exportLxSourceTex(file.parsed), `${file.name}.source.tex`, 'application/x-tex');
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private shiftSection(delta: number): void {
    const list = this.filteredSections;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedSectionId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectSection(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedSectionId = this.parsed?.sections[0]?.id ?? '';
    this.selectedCommandId = this.parsed?.commands[0]?.id ?? '';
    this.selectedEnvId = this.parsed?.envs[0]?.id ?? '';
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
