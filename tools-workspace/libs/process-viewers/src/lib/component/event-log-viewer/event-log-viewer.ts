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
  EVENT_LOG_ACCEPT_ATTR,
  EVENT_LOG_FORMATS_HINT,
  EVENT_LOG_FORMATS_LABEL,
  EVENT_LOG_RELATED_TOOLS,
  EVENT_LOG_SUPPORTED_EXTENSIONS
} from '../../constants/event-log-viewer.constants';
import type {
  EventLogActivity,
  EventLogCase,
  EventLogEvent,
  EventLogExportFormat,
  EventLogLoadedFile,
  EventLogViewMode
} from '../../types/event-log-viewer.types';
import {
  buildEventLogActivityMetadata,
  buildEventLogCaseMetadata,
  buildEventLogEventMetadata,
  buildEventLogMetadataRows,
  canExportEventLog,
  canvasToPngDataUrl,
  createEventLogFileRecord,
  createSampleEventLogFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportEventLogCasesCsv,
  exportEventLogEventsCsv,
  exportEventLogSummaryJson,
  filterEventLogActivities,
  filterEventLogCases,
  filterEventLogEvents,
  filterValidEventLogFiles,
  formatEventLogDuration,
  formatEventLogFileSize,
  eventLogCaseColor,
  eventLogFrequencyColor,
  readEventLogFileBytes,
  renderEventLogActivities,
  renderEventLogCases,
  renderEventLogEvents,
  resolveEventLogSuggestion
} from '../../utils/event-log-viewer.utils';

@Component({
  selector: 'lib-event-log-viewer',
  standalone: true,
  templateUrl: './event-log-viewer.html',
  styleUrls: ['./event-log-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventLogViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = EVENT_LOG_ACCEPT_ATTR;
  readonly relatedTools = EVENT_LOG_RELATED_TOOLS;
  readonly supportedExtensions = EVENT_LOG_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = EVENT_LOG_FORMATS_LABEL;
  readonly formatsHint = EVENT_LOG_FORMATS_HINT;
  readonly viewModes: Array<{ id: EventLogViewMode; label: string }> = [
    { id: 'cases', label: 'Cases' },
    { id: 'activities', label: 'Activities' },
    { id: 'events', label: 'Events' },
    { id: 'table', label: 'Table' }
  ];

  files: EventLogLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: EventLogViewMode = 'cases';
  query = '';
  selectedCaseId = '';
  selectedActivityId = '';
  selectedEventId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): EventLogLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportEventLog(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildEventLogMetadataRows(this.parsed) : [];
  }

  get filteredCases(): EventLogCase[] {
    return this.parsed ? filterEventLogCases(this.parsed.cases, this.query) : [];
  }

  get filteredActivities(): EventLogActivity[] {
    return this.parsed ? filterEventLogActivities(this.parsed.activities, this.query) : [];
  }

  get filteredEvents(): EventLogEvent[] {
    return this.parsed ? filterEventLogEvents(this.parsed.events, this.query) : [];
  }

  get selectedCase(): EventLogCase | null {
    return this.filteredCases.find((c) => c.id === this.selectedCaseId) ?? this.filteredCases[0] ?? null;
  }

  get selectedActivity(): EventLogActivity | null {
    return this.filteredActivities.find((a) => a.id === this.selectedActivityId) ?? this.filteredActivities[0] ?? null;
  }

  get selectedEvent(): EventLogEvent | null {
    return this.filteredEvents.find((e) => e.id === this.selectedEventId) ?? this.filteredEvents[0] ?? null;
  }

  get caseMetadataRows() {
    return this.selectedCase ? buildEventLogCaseMetadata(this.selectedCase) : [];
  }

  get activityMetadataRows() {
    return this.selectedActivity ? buildEventLogActivityMetadata(this.selectedActivity) : [];
  }

  get eventMetadataRows() {
    return this.selectedEvent ? buildEventLogEventMetadata(this.selectedEvent) : [];
  }

  get primarySuggestion() {
    const s = resolveEventLogSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  frequencyTint(pct: number): string {
    return eventLogFrequencyColor(pct);
  }

  caseTint(index: number): string {
    return eventLogCaseColor(index);
  }

  formatDuration(ms: number): string {
    return formatEventLogDuration(ms);
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
      if (this.viewMode === 'activities') this.shiftActivity(1);
      else if (this.viewMode === 'events') this.shiftEvent(1);
      else this.shiftCase(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'activities') this.shiftActivity(-1);
      else if (this.viewMode === 'events') this.shiftEvent(-1);
      else this.shiftCase(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: EventLogLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByCase(_i: number, item: EventLogCase): string {
    return item.id;
  }

  trackByActivity(_i: number, activity: EventLogActivity): string {
    return activity.id;
  }

  trackByEvent(_i: number, event: EventLogEvent): string {
    return event.id;
  }

  formatSize(bytes: number): string {
    return formatEventLogFileSize(bytes);
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
    const { accepted, rejected } = filterValidEventLogFiles(files);
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
          const bytes = await readEventLogFileBytes(file);
          const record = createEventLogFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid event log'}`;
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
    await this.handleFiles([createSampleEventLogFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectCase(id: string): void {
    this.selectedCaseId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectActivity(id: string): void {
    this.selectedActivityId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectEvent(id: string): void {
    this.selectedEventId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const item = this.filteredCases[0];
    if (item && !this.filteredCases.some((c) => c.id === this.selectedCaseId)) this.selectedCaseId = item.id;
    const activity = this.filteredActivities[0];
    if (activity && !this.filteredActivities.some((a) => a.id === this.selectedActivityId)) this.selectedActivityId = activity.id;
    const event = this.filteredEvents[0];
    if (event && !this.filteredEvents.some((e) => e.id === this.selectedEventId)) this.selectedEventId = event.id;
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
    this.selectedCaseId = '';
    this.selectedActivityId = '';
    this.selectedEventId = '';
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

  setViewMode(mode: EventLogViewMode): void {
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

  exportAs(format: EventLogExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportEventLogSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'cases-csv') downloadTextFile(exportEventLogCasesCsv(file.parsed), `${file.name}.cases.csv`, 'text/csv');
      else if (format === 'events-csv') downloadTextFile(exportEventLogEventsCsv(file.parsed), `${file.name}.events.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Cases, Activities, or Events to export a PNG snapshot');
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

  private shiftCase(delta: number): void {
    const list = this.filteredCases;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((c) => c.id === this.selectedCaseId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectCase(next.id);
  }

  private shiftActivity(delta: number): void {
    const list = this.filteredActivities;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((a) => a.id === this.selectedActivityId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectActivity(next.id);
  }

  private shiftEvent(delta: number): void {
    const list = this.filteredEvents;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedEventId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectEvent(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedCaseId = this.parsed?.cases[0]?.id ?? '';
    this.selectedActivityId = this.parsed?.activities[0]?.id ?? '';
    this.selectedEventId = this.parsed?.events[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'events' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'cases') renderEventLogCases(canvas, this.filteredCases, this.selectedCase?.id ?? null);
    else if (this.viewMode === 'activities') renderEventLogActivities(canvas, this.filteredActivities, this.selectedActivity?.id ?? null);
    else renderEventLogEvents(canvas, this.filteredEvents, this.selectedEvent?.id ?? null);
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
