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
  SIEM_ACCEPT_ATTR,
  SIEM_FORMATS_HINT,
  SIEM_FORMATS_LABEL,
  SIEM_RELATED_TOOLS,
  SIEM_SUPPORTED_EXTENSIONS
} from '../../constants/siem-log-viewer.constants';
import type {
  SiemCorrelation,
  SiemEvent,
  SiemExportFormat,
  SiemLoadedFile,
  SiemViewMode
} from '../../types/siem-log-viewer.types';
import {
  buildCorrelationMetadata,
  buildSiemEventMetadata,
  buildSiemMetadataRows,
  canExportSiem,
  canvasToPngDataUrl,
  createSampleSiemFile,
  createSiemFileRecord,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportSiemCorrelationsCsv,
  exportSiemEventsCsv,
  exportSiemSummaryJson,
  filterSiemCorrelations,
  filterSiemEvents,
  filterValidSiemFiles,
  formatSiemFileSize,
  readSiemFileBytes,
  renderSiemCorrelations,
  renderSiemSeverity,
  resolveSiemSuggestion,
  severityColor
} from '../../utils/siem-log-viewer.utils';

@Component({
  selector: 'lib-siem-log-viewer',
  standalone: true,
  templateUrl: './siem-log-viewer.html',
  styleUrls: ['./siem-log-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SiemLogViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = SIEM_ACCEPT_ATTR;
  readonly relatedTools = SIEM_RELATED_TOOLS;
  readonly supportedExtensions = SIEM_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = SIEM_FORMATS_LABEL;
  readonly formatsHint = SIEM_FORMATS_HINT;
  readonly viewModes: Array<{ id: SiemViewMode; label: string }> = [
    { id: 'events', label: 'Events' },
    { id: 'correlate', label: 'Correlate' },
    { id: 'severity', label: 'Severity' },
    { id: 'table', label: 'Table' }
  ];

  files: SiemLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: SiemViewMode = 'events';
  query = '';
  selectedId = '';
  selectedCorrId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): SiemLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportSiem(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildSiemMetadataRows(this.parsed) : [];
  }

  get filteredEvents(): SiemEvent[] {
    return this.parsed ? filterSiemEvents(this.parsed.events, this.query) : [];
  }

  get filteredCorrelations(): SiemCorrelation[] {
    return this.parsed ? filterSiemCorrelations(this.parsed.correlations, this.query) : [];
  }

  get selectedEvent(): SiemEvent | null {
    return this.filteredEvents.find((e) => e.id === this.selectedId) ?? this.filteredEvents[0] ?? null;
  }

  get selectedCorrelation(): SiemCorrelation | null {
    return this.filteredCorrelations.find((c) => c.id === this.selectedCorrId) ?? this.filteredCorrelations[0] ?? null;
  }

  get relatedCorrelationEvents(): SiemEvent[] {
    const corr = this.selectedCorrelation;
    if (!corr || !this.parsed) return [];
    return this.parsed.events.filter(
      (e) => corr.rules.includes(e.rule) && (corr.srcs.includes(e.src) || corr.hosts.includes(e.host))
    );
  }

  get eventMetadataRows() {
    return this.selectedEvent ? buildSiemEventMetadata(this.selectedEvent) : [];
  }

  get correlationMetadataRows() {
    return this.selectedCorrelation ? buildCorrelationMetadata(this.selectedCorrelation) : [];
  }

  get primarySuggestion() {
    const s = resolveSiemSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  severityTint(severity: string): string {
    return severityColor(severity);
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
      if (this.viewMode === 'correlate') this.shiftCorrelation(1);
      else this.shiftEvent(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'correlate') this.shiftCorrelation(-1);
      else this.shiftEvent(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: SiemLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByEvent(_i: number, event: SiemEvent): string {
    return event.id;
  }

  trackByCorr(_i: number, corr: SiemCorrelation): string {
    return corr.id;
  }

  formatSize(bytes: number): string {
    return formatSiemFileSize(bytes);
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
    const { accepted, rejected } = filterValidSiemFiles(files);
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
          const bytes = await readSiemFileBytes(file);
          const record = createSiemFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid SIEM export'}`;
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
    await this.handleFiles([createSampleSiemFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectEvent(id: string): void {
    this.selectedId = id;
    this.cdr.markForCheck();
  }

  selectCorrelation(id: string): void {
    this.selectedCorrId = id;
    const related = this.relatedCorrelationEvents[0];
    if (related) this.selectedId = related.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const firstEvent = this.filteredEvents[0];
    if (firstEvent && !this.filteredEvents.some((e) => e.id === this.selectedId)) this.selectedId = firstEvent.id;
    const firstCorr = this.filteredCorrelations[0];
    if (firstCorr && !this.filteredCorrelations.some((c) => c.id === this.selectedCorrId)) this.selectedCorrId = firstCorr.id;
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
    this.selectedCorrId = '';
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

  setViewMode(mode: SiemViewMode): void {
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

  exportAs(format: SiemExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportSiemSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'events-csv') downloadTextFile(exportSiemEventsCsv(file.parsed), `${file.name}.events.csv`, 'text/csv');
      else if (format === 'correlations-csv') downloadTextFile(exportSiemCorrelationsCsv(file.parsed), `${file.name}.correlations.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'correlate' && this.viewMode !== 'severity')) {
          this.toast.info('Open Correlate or Severity to export a PNG snapshot');
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

  private shiftEvent(delta: number): void {
    const list = this.filteredEvents;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectEvent(next.id);
  }

  private shiftCorrelation(delta: number): void {
    const list = this.filteredCorrelations;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((c) => c.id === this.selectedCorrId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectCorrelation(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedId = this.parsed?.events[0]?.id ?? '';
    this.selectedCorrId = this.parsed?.correlations[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'correlate' && this.viewMode !== 'severity')) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(320, parent.clientHeight || 240));
    }
    if (this.viewMode === 'correlate') {
      renderSiemCorrelations(canvas, this.filteredCorrelations, this.selectedCorrelation?.id ?? null);
    } else {
      renderSiemSeverity(canvas, this.parsed.severities);
    }
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
