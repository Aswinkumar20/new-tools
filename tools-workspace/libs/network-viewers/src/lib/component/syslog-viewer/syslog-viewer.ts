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
  SYSLOG_ACCEPT_ATTR,
  SYSLOG_FORMATS_HINT,
  SYSLOG_FORMATS_LABEL,
  SYSLOG_RELATED_TOOLS,
  SYSLOG_SUPPORTED_EXTENSIONS
} from '../../constants/syslog-viewer.constants';
import type {
  SyslogExportFormat,
  SyslogLoadedFile,
  SyslogMessage,
  SyslogViewMode
} from '../../types/syslog-viewer.types';
import {
  buildSyslogMessageMetadata,
  buildSyslogMetadataRows,
  canExportSyslog,
  canvasToPngDataUrl,
  createSampleSyslogFile,
  createSyslogFileRecord,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportSyslogFacilitiesCsv,
  exportSyslogMessagesCsv,
  exportSyslogSummaryJson,
  filterSyslogMessages,
  filterValidSyslogFiles,
  formatSyslogFileSize,
  readSyslogFileBytes,
  renderSyslogFacilities,
  renderSyslogSeverity,
  resolveSyslogSuggestion,
  syslogFacilityColor,
  syslogSeverityColor
} from '../../utils/syslog-viewer.utils';

@Component({
  selector: 'lib-syslog-viewer',
  standalone: true,
  templateUrl: './syslog-viewer.html',
  styleUrls: ['./syslog-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyslogViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = SYSLOG_ACCEPT_ATTR;
  readonly relatedTools = SYSLOG_RELATED_TOOLS;
  readonly supportedExtensions = SYSLOG_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = SYSLOG_FORMATS_LABEL;
  readonly formatsHint = SYSLOG_FORMATS_HINT;
  readonly viewModes: Array<{ id: SyslogViewMode; label: string }> = [
    { id: 'messages', label: 'Messages' },
    { id: 'facilities', label: 'Facilities' },
    { id: 'severity', label: 'Severity' },
    { id: 'table', label: 'Table' }
  ];

  files: SyslogLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: SyslogViewMode = 'messages';
  query = '';
  selectedId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): SyslogLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportSyslog(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildSyslogMetadataRows(this.parsed) : [];
  }

  get filteredMessages(): SyslogMessage[] {
    return this.parsed ? filterSyslogMessages(this.parsed.messages, this.query) : [];
  }

  get selectedMessage(): SyslogMessage | null {
    return this.filteredMessages.find((m) => m.id === this.selectedId) ?? this.filteredMessages[0] ?? null;
  }

  get messageMetadataRows() {
    return this.selectedMessage ? buildSyslogMessageMetadata(this.selectedMessage) : [];
  }

  get primarySuggestion() {
    const s = resolveSyslogSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  severityTint(severity: string): string {
    return syslogSeverityColor(severity);
  }

  facilityTint(name: string, index = 0): string {
    return syslogFacilityColor(name, index);
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
      this.shiftMessage(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.shiftMessage(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: SyslogLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByMessage(_i: number, message: SyslogMessage): string {
    return message.id;
  }

  formatSize(bytes: number): string {
    return formatSyslogFileSize(bytes);
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
    const { accepted, rejected } = filterValidSyslogFiles(files);
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
          const bytes = await readSyslogFileBytes(file);
          const record = createSyslogFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid syslog dump'}`;
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
    await this.handleFiles([createSampleSyslogFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectMessage(id: string): void {
    this.selectedId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const first = this.filteredMessages[0];
    if (first && !this.filteredMessages.some((m) => m.id === this.selectedId)) this.selectedId = first.id;
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
    this.selectedId = '';
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

  setViewMode(mode: SyslogViewMode): void {
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

  exportAs(format: SyslogExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportSyslogSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'messages-csv') downloadTextFile(exportSyslogMessagesCsv(file.parsed), `${file.name}.messages.csv`, 'text/csv');
      else if (format === 'facilities-csv') downloadTextFile(exportSyslogFacilitiesCsv(file.parsed), `${file.name}.facilities.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'facilities' && this.viewMode !== 'severity')) {
          this.toast.info('Open Facilities or Severity to export a PNG snapshot');
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

  private shiftMessage(delta: number): void {
    const list = this.filteredMessages;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((m) => m.id === this.selectedId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectMessage(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedId = this.parsed?.messages[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'facilities' && this.viewMode !== 'severity')) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(280, parent.clientHeight || 220));
    }
    if (this.viewMode === 'facilities') renderSyslogFacilities(canvas, this.parsed.facilities);
    else renderSyslogSeverity(canvas, this.parsed.severities);
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
