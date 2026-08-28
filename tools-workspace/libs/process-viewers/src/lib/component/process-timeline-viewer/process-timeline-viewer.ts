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
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import {
  PROCESS_TIMELINE_ACCEPT_ATTR,
  PROCESS_TIMELINE_FORMATS_HINT,
  PROCESS_TIMELINE_FORMATS_LABEL,
  PROCESS_TIMELINE_RELATED_TOOLS,
  PROCESS_TIMELINE_SUPPORTED_EXTENSIONS
} from '../../constants/process-timeline-viewer.constants';
import type {
  ProcessTimelineExportFormat,
  ProcessTimelineItem,
  ProcessTimelineLane,
  ProcessTimelineLoadedFile,
  ProcessTimelineViewMode
} from '../../types/process-timeline-viewer.types';
import {
  buildProcessTimelineMetadataRows,
  buildTimelineItemMetadata,
  buildTimelineLaneMetadata,
  canExportProcessTimeline,
  canvasToPngDataUrl,
  createProcessTimelineFileRecord,
  createSampleProcessTimelineFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportProcessTimelineCsv,
  exportProcessTimelineLanesCsv,
  exportProcessTimelineSummaryJson,
  filterTimelineItems,
  filterTimelineLanes,
  filterValidProcessTimelineFiles,
  formatProcessTimelineFileSize,
  formatTimelineDuration,
  processTimelineColor,
  readProcessTimelineFileBytes,
  renderTimelineEvents,
  renderTimelineGantt,
  renderTimelineLanes,
  resolveProcessTimelineSuggestion
} from '../../utils/process-timeline-viewer.utils';

@Component({
  selector: 'lib-process-timeline-viewer',
  standalone: true,
  templateUrl: './process-timeline-viewer.html',
  styleUrls: ['./process-timeline-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcessTimelineViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = PROCESS_TIMELINE_ACCEPT_ATTR;
  readonly relatedTools = PROCESS_TIMELINE_RELATED_TOOLS;
  readonly supportedExtensions = PROCESS_TIMELINE_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PROCESS_TIMELINE_FORMATS_LABEL;
  readonly formatsHint = PROCESS_TIMELINE_FORMATS_HINT;
  readonly viewModes: Array<{ id: ProcessTimelineViewMode; label: string }> = [
    { id: 'gantt', label: 'Gantt' },
    { id: 'lanes', label: 'Lanes' },
    { id: 'events', label: 'Events' },
    { id: 'table', label: 'Table' }
  ];

  files: ProcessTimelineLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: ProcessTimelineViewMode = 'gantt';
  query = '';
  selectedItemId = '';
  selectedLaneId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): ProcessTimelineLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportProcessTimeline(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildProcessTimelineMetadataRows(this.parsed) : [];
  }

  get filteredItems(): ProcessTimelineItem[] {
    return this.parsed ? filterTimelineItems(this.parsed.items, this.query) : [];
  }

  get filteredCaseLanes(): ProcessTimelineLane[] {
    if (!this.parsed) return [];
    const lanes = this.parsed.caseLanes
      .map((lane) => ({
        ...lane,
        items: filterTimelineItems(lane.items, this.query)
      }))
      .filter((lane) => lane.items.length);
    return filterTimelineLanes(lanes, this.query);
  }

  get filteredResourceLanes(): ProcessTimelineLane[] {
    if (!this.parsed) return [];
    const lanes = this.parsed.resourceLanes
      .map((lane) => ({
        ...lane,
        items: filterTimelineItems(lane.items, this.query)
      }))
      .filter((lane) => lane.items.length);
    return filterTimelineLanes(lanes, this.query);
  }

  get activeLanes(): ProcessTimelineLane[] {
    return this.viewMode === 'lanes' ? this.filteredResourceLanes : this.filteredCaseLanes;
  }

  get selectedItem(): ProcessTimelineItem | null {
    return this.filteredItems.find((it) => it.id === this.selectedItemId) ?? null;
  }

  get selectedLane(): ProcessTimelineLane | null {
    return this.activeLanes.find((l) => l.id === this.selectedLaneId) ?? null;
  }

  get itemMetadataRows() {
    return this.selectedItem ? buildTimelineItemMetadata(this.selectedItem) : [];
  }

  get laneMetadataRows() {
    return this.selectedLane ? buildTimelineLaneMetadata(this.selectedLane) : [];
  }

  get primarySuggestion() {
    const s = resolveProcessTimelineSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(index: number): string {
    return processTimelineColor(index);
  }

  formatDuration(ms: number): string {
    return formatTimelineDuration(ms);
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
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    if (event.key === 'Escape' && this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    if (!this.parsed) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'lanes' || this.viewMode === 'gantt') this.shiftLane(1);
      else this.shiftItem(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'lanes' || this.viewMode === 'gantt') this.shiftLane(-1);
      else this.shiftItem(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: ProcessTimelineLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByItem(_i: number, item: ProcessTimelineItem): string {
    return item.id;
  }

  trackByLane(_i: number, lane: ProcessTimelineLane): string {
    return lane.id;
  }

  formatSize(bytes: number): string {
    return formatProcessTimelineFileSize(bytes);
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
    const { accepted, rejected } = filterValidProcessTimelineFiles(files);
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
          const bytes = await readProcessTimelineFileBytes(file);
          const record = createProcessTimelineFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid timeline'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.errorMessage = '';
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no timeline events — metadata may still be available');
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
    await this.handleFiles([createSampleProcessTimelineFile()]);
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
    this.selectedItemId = '';
    this.selectedLaneId = '';
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

  selectItem(id: string): void {
    this.selectedItemId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectLane(id: string): void {
    this.selectedLaneId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedItemId && !this.filteredItems.some((it) => it.id === this.selectedItemId)) {
      this.selectedItemId = this.filteredItems[0]?.id ?? '';
    }
    if (this.selectedLaneId && !this.activeLanes.some((l) => l.id === this.selectedLaneId)) {
      this.selectedLaneId = this.activeLanes[0]?.id ?? '';
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

  setViewMode(mode: ProcessTimelineViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    if (mode === 'lanes') {
      this.selectedLaneId = this.filteredResourceLanes[0]?.id ?? '';
    } else if (mode === 'gantt') {
      this.selectedLaneId = this.filteredCaseLanes[0]?.id ?? '';
    }
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

  exportAs(format: ProcessTimelineExportFormat, event: Event): void {
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
      else if (format === 'summary-json') downloadTextFile(exportProcessTimelineSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'timeline-csv') downloadTextFile(exportProcessTimelineCsv(file.parsed), `${file.name}.timeline.csv`, 'text/csv');
      else if (format === 'lanes-csv') downloadTextFile(exportProcessTimelineLanesCsv(file.parsed), `${file.name}.lanes.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Gantt, Lanes, or Events to export a PNG snapshot');
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

  private shiftItem(delta: number): void {
    const list = this.filteredItems;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((it) => it.id === this.selectedItemId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectItem(next.id);
  }

  private shiftLane(delta: number): void {
    const list = this.activeLanes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((l) => l.id === this.selectedLaneId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLane(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedItemId = this.parsed?.items[0]?.id ?? '';
    this.selectedLaneId = this.parsed?.caseLanes[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'gantt' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'gantt') {
      renderTimelineGantt(
        canvas,
        this.filteredCaseLanes,
        this.filteredItems,
        { startMs: this.parsed.startMs, endMs: this.parsed.endMs },
        this.selectedItemId || null
      );
    } else if (this.viewMode === 'lanes') {
      renderTimelineLanes(canvas, this.filteredResourceLanes, this.selectedLaneId || null);
    } else {
      renderTimelineEvents(canvas, this.filteredItems, this.selectedItemId || null);
    }
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
