import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  SelectBoxComponent,
  ToastService,
  TooltipDirective,
  type SelectBoxOption
} from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  XES_ACCEPT_ATTR,
  XES_EXPORT_GROUP_LABELS,
  XES_EXPORT_OPTIONS,
  XES_PAGE_SIZE,
  XES_RELATED_TOOLS
} from '../../constants/xes-viewer.constants';
import type {
  Pm4jsXesImporter,
  XesActivityCount,
  XesEventRow,
  XesExportFormat,
  XesExportOption,
  XesLoadedFile,
  XesLogInsights,
  XesLogMetadata,
  XesLogStats,
  XesTraceSummary,
  XesViewMode
} from '../../types/xes-viewer.types';
import {
  buildXesActivityCounts,
  buildXesLogInsights,
  buildXesLogMetadata,
  buildXesLogStats,
  buildXesTraceSummaries,
  buildXesVariantCounts,
  downloadTextFile,
  downloadBlobFile,
  exportXesCasesAsCsv,
  exportXesCasesAsJson,
  exportXesCountsAsCsv,
  exportXesDfgAsDot,
  exportXesEventsAsCsv,
  exportXesEventsAsJson,
  exportXesFullReportAsCsv,
  exportXesFullReportAsPdfBlob,
  exportXesMarkdownReport,
  exportXesStartEndAsCsv,
  exportXesSummaryAsJson,
  exportXesTimelineAsCsv,
  filterValidXesFiles,
  filterXesEventRows,
  flattenXesEvents,
  formatXesFileSize,
  loadPm4js,
  parseXesWithPm4js,
  readXesFileText,
  resolveXesSuggestion,
  validateXesFileSize
} from '../../utils/xes-viewer.utils';

@Component({
  selector: 'lib-xes-viewer',
  standalone: true,
  templateUrl: './xes-viewer.html',
  styleUrls: ['./xes-viewer.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    Navigation,
    TooltipDirective,
    SelectBoxComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class XesViewerComponent implements OnInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = XES_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = XES_RELATED_TOOLS;
  readonly exportOptions: ReadonlyArray<XesExportOption> = XES_EXPORT_OPTIONS;
  readonly pageSize = XES_PAGE_SIZE;

  xesFiles: XesLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  libraryReady = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  dismissedSuggestionId: string | null = null;

  viewMode: XesViewMode = 'insights';
  searchText = '';
  selectedCaseId: string | null = null;
  selectedActivity: string | null = null;
  pageIndex = 0;

  allEvents: XesEventRow[] = [];
  filteredEvents: XesEventRow[] = [];
  traces: XesTraceSummary[] = [];
  activityCounts: XesActivityCount[] = [];
  variantCounts: XesActivityCount[] = [];
  stats: XesLogStats | null = null;
  metadata: XesLogMetadata | null = null;
  insights: XesLogInsights | null = null;
  uniqueActivities: string[] = [];
  activityOptions: Array<SelectBoxOption<string | null>> = [
    { label: 'All activities', value: null }
  ];
  expandedEventId: string | null = null;
  expandedTraceIndex: number | null = null;

  private importer: Pm4jsXesImporter | null = null;
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  get primarySuggestion() {
    const suggestion = resolveXesSuggestion({
      hasFiles: this.xesFiles.length > 0,
      hasError: !!this.errorMessage,
      eventCount: this.allEvents.length
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  get pagedEvents(): XesEventRow[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredEvents.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredEvents.length / this.pageSize));
  }

  get currentFile(): XesLoadedFile | null {
    if (this.currentFileIndex < 0) {
      return null;
    }
    return this.xesFiles[this.currentFileIndex] ?? null;
  }

  get canExport(): boolean {
    return this.xesFiles.length > 0 && !!this.currentFile;
  }

  get exportGroups(): Array<{ group: string; label: string; options: XesExportOption[] }> {
    const order = ['events', 'cases', 'analytics', 'source'];
    return order
      .map((group) => ({
        group,
        label: XES_EXPORT_GROUP_LABELS[group] ?? group,
        options: this.exportOptions.filter((option) => option.group === group)
      }))
      .filter((group) => group.options.length > 0);
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
    if (isPlatformBrowser(this.platformId)) {
      loadPm4js()
        .then((api) => {
          this.importer = api.XesImporter;
          this.libraryReady = true;
          this.cdr.markForCheck();
        })
        .catch((error: unknown) => {
          this.errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to load PM4JS (process mining library). Please refresh the page.';
          this.cdr.markForCheck();
        });
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.markForCheck();
  }

  setupDragAndDrop(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  @HostListener('window:dragenter')
  onDragEnter(): void {
    this.showDropZone = true;
    this.cdr.markForCheck();
  }

  @HostListener('window:dragleave')
  onDragLeave(): void {
    this.showDropZone = false;
    this.cdr.markForCheck();
  }

  @HostListener('window:drop', ['$event'])
  onDrop(e: DragEvent): void {
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void this.handleFiles(Array.from(files));
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    if (!this.importer) {
      this.errorMessage = 'PM4JS is still loading. Please wait a moment and try again.';
      this.cdr.markForCheck();
      return;
    }

    const validFiles = filterValidXesFiles(files);
    if (validFiles.length === 0) {
      this.errorMessage = 'Please select valid XES files (.xes or .xml event logs).';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      for (const file of validFiles) {
        const sizeError = validateXesFileSize(file);
        if (sizeError) {
          this.errorMessage = sizeError;
          continue;
        }
        await this.loadXesFile(file);
      }
    } catch (error) {
      this.errorMessage = `Failed to load file: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadXesFile(file: File): Promise<void> {
    if (!this.importer) {
      throw new Error('PM4JS library not loaded');
    }

    const text = await readXesFileText(file);
    const log = parseXesWithPm4js(text, this.importer);

    this.xesFiles.push({
      name: file.name,
      file,
      size: file.size,
      log,
      sourceText: text,
      loaded: true
    });

    if (this.xesFiles.length === 1 || this.currentFileIndex < 0) {
      this.selectFile(this.xesFiles.length - 1);
    }

    this.toast.success(`Loaded ${file.name}`);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.xesFiles.length) {
      return;
    }
    this.currentFileIndex = index;
    this.searchText = '';
    this.selectedCaseId = null;
    this.selectedActivity = null;
    this.pageIndex = 0;
    this.viewMode = 'insights';
    this.renderCurrentLog();
  }

  removeFile(index: number): void {
    if (index < 0 || index >= this.xesFiles.length) {
      return;
    }
    this.xesFiles.splice(index, 1);
    if (this.xesFiles.length === 0) {
      this.clearAll(false);
      return;
    }
    if (this.currentFileIndex >= this.xesFiles.length) {
      this.currentFileIndex = this.xesFiles.length - 1;
    }
    this.renderCurrentLog();
  }

  clearAll(showToast = true): void {
    this.xesFiles = [];
    this.currentFileIndex = -1;
    this.allEvents = [];
    this.filteredEvents = [];
    this.traces = [];
    this.activityCounts = [];
    this.variantCounts = [];
    this.stats = null;
    this.metadata = null;
    this.insights = null;
    this.uniqueActivities = [];
    this.activityOptions = [{ label: 'All activities', value: null }];
    this.expandedEventId = null;
    this.expandedTraceIndex = null;
    this.searchText = '';
    this.selectedCaseId = null;
    this.selectedActivity = null;
    this.pageIndex = 0;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.showExportMenu = false;
    if (showToast) {
      this.toast.info('Cleared XES files');
    }
    this.cdr.markForCheck();
  }

  renderCurrentLog(): void {
    const current = this.currentFile;
    if (!current) {
      this.cdr.markForCheck();
      return;
    }

    this.allEvents = flattenXesEvents(current.log);
    this.traces = buildXesTraceSummaries(current.log);
    this.activityCounts = buildXesActivityCounts(this.allEvents);
    this.variantCounts = buildXesVariantCounts(current.log);
    this.stats = buildXesLogStats(current.log, this.allEvents);
    this.metadata = buildXesLogMetadata(current.log, this.allEvents);
    this.insights = buildXesLogInsights(
      current.log,
      this.allEvents,
      this.traces,
      this.variantCounts
    );
    this.uniqueActivities = [...new Set(this.allEvents.map((row) => row.activity))].sort((a, b) =>
      a.localeCompare(b)
    );
    this.activityOptions = [
      { label: 'All activities', value: null },
      ...this.uniqueActivities.map((activity) => ({ label: activity, value: activity }))
    ];
    this.expandedEventId = null;
    this.expandedTraceIndex = null;
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredEvents = filterXesEventRows(this.allEvents, {
      searchText: this.searchText,
      caseId: this.selectedCaseId,
      activity: this.selectedActivity
    });
    this.pageIndex = 0;
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  setViewMode(mode: XesViewMode): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
  }

  selectCase(caseId: string | null): void {
    this.selectedCaseId = caseId;
    this.viewMode = 'events';
    this.applyFilters();
  }

  selectActivity(activity: string | null): void {
    this.selectedActivity = activity;
    this.viewMode = 'events';
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedCaseId = null;
    this.selectedActivity = null;
    this.applyFilters();
  }

  nextPage(): void {
    if (this.pageIndex < this.totalPages - 1) {
      this.pageIndex += 1;
      this.cdr.markForCheck();
    }
  }

  previousPage(): void {
    if (this.pageIndex > 0) {
      this.pageIndex -= 1;
      this.cdr.markForCheck();
    }
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  async exportAs(format: XesExportFormat, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.showExportMenu = false;

    const current = this.currentFile;
    if (!current) {
      this.toast.error('No event log loaded');
      this.cdr.markForCheck();
      return;
    }
    const insights = this.insights;
    if (!insights) {
      this.toast.error('Analytics are not ready yet');
      this.cdr.markForCheck();
      return;
    }

    const base = current.name.replace(/\.(xes|xml)$/i, '') || 'event-log';
    const option = this.exportOptions.find((item) => item.id === format);
    const label = option?.label ?? format;
    const needsEvents =
      format === 'events-csv' ||
      format === 'events-tsv' ||
      format === 'events-json' ||
      format === 'timeline-csv';

    if (needsEvents && this.filteredEvents.length === 0) {
      this.toast.error('No events to export');
      this.cdr.markForCheck();
      return;
    }

    const reportPayload = {
      fileName: current.name,
      stats: this.stats,
      metadata: this.metadata,
      insights,
      activities: this.activityCounts,
      variants: this.variantCounts
    };

    try {
      const downloads: Partial<Record<XesExportFormat, () => void | Promise<void>>> = {
        'events-csv': () =>
          downloadTextFile(
            exportXesEventsAsCsv(this.filteredEvents),
            `${base}-events.csv`,
            'text/csv;charset=utf-8'
          ),
        'events-tsv': () =>
          downloadTextFile(
            exportXesEventsAsCsv(this.filteredEvents, '\t'),
            `${base}-events.tsv`,
            'text/tab-separated-values;charset=utf-8'
          ),
        'events-json': () =>
          downloadTextFile(
            exportXesEventsAsJson(this.filteredEvents),
            `${base}-events.json`,
            'application/json;charset=utf-8'
          ),
        'timeline-csv': () =>
          downloadTextFile(
            exportXesTimelineAsCsv(this.filteredEvents),
            `${base}-timeline.csv`,
            'text/csv;charset=utf-8'
          ),
        'cases-csv': () =>
          downloadTextFile(
            exportXesCasesAsCsv(this.traces),
            `${base}-cases.csv`,
            'text/csv;charset=utf-8'
          ),
        'cases-json': () =>
          downloadTextFile(
            exportXesCasesAsJson(this.traces),
            `${base}-cases.json`,
            'application/json;charset=utf-8'
          ),
        'activities-csv': () =>
          downloadTextFile(
            exportXesCountsAsCsv(this.activityCounts, 'activity', 'events'),
            `${base}-activities.csv`,
            'text/csv;charset=utf-8'
          ),
        'variants-csv': () =>
          downloadTextFile(
            exportXesCountsAsCsv(this.variantCounts, 'variant', 'cases'),
            `${base}-variants.csv`,
            'text/csv;charset=utf-8'
          ),
        'transitions-csv': () =>
          downloadTextFile(
            exportXesCountsAsCsv(insights.transitions, 'transition', 'count', true),
            `${base}-transitions.csv`,
            'text/csv;charset=utf-8'
          ),
        'resources-csv': () =>
          downloadTextFile(
            exportXesCountsAsCsv(insights.resources, 'resource', 'events', true),
            `${base}-resources.csv`,
            'text/csv;charset=utf-8'
          ),
        'start-end-csv': () =>
          downloadTextFile(
            exportXesStartEndAsCsv(insights),
            `${base}-start-end.csv`,
            'text/csv;charset=utf-8'
          ),
        'dfg-dot': () =>
          downloadTextFile(
            exportXesDfgAsDot(insights.transitions),
            `${base}-dfg.dot`,
            'text/vnd.graphviz;charset=utf-8'
          ),
        'summary-json': () =>
          downloadTextFile(
            exportXesSummaryAsJson(reportPayload),
            `${base}-summary.json`,
            'application/json;charset=utf-8'
          ),
        'markdown-report': () =>
          downloadTextFile(
            exportXesMarkdownReport(reportPayload),
            `${base}-report.md`,
            'text/markdown;charset=utf-8'
          ),
        'full-report-csv': () =>
          downloadTextFile(
            exportXesFullReportAsCsv(reportPayload),
            `${base}-full-report.csv`,
            'text/csv;charset=utf-8'
          ),
        'full-report-pdf': async () => {
          const blob = await exportXesFullReportAsPdfBlob(reportPayload);
          downloadBlobFile(blob, `${base}-full-report.pdf`);
        },
        'original-xes': () =>
          downloadTextFile(
            current.sourceText,
            current.name.endsWith('.xes') || current.name.endsWith('.xml')
              ? current.name
              : `${base}.xes`,
            'application/xml;charset=utf-8'
          )
      };

      const run = downloads[format];
      if (!run) {
        this.toast.error('Unknown export format');
      } else {
        await run();
        this.toast.success(`Exported ${label}`);
      }
    } catch (error) {
      this.toast.error(
        `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    this.cdr.markForCheck();
  }

  toggleEventDetail(row: XesEventRow): void {
    this.expandedEventId = this.expandedEventId === row.id ? null : row.id;
    this.cdr.markForCheck();
  }

  toggleTraceDetail(trace: XesTraceSummary): void {
    this.expandedTraceIndex = this.expandedTraceIndex === trace.index ? null : trace.index;
    this.cdr.markForCheck();
  }

  /** Share of all cases following a variant, or of all events for an activity. */
  sharePercent(count: number, total: number): string {
    if (total <= 0) {
      return '0%';
    }
    return `${((count / total) * 100).toFixed(1)}%`;
  }

  formatShare(share: number): string {
    return `${share.toFixed(1)}%`;
  }

  formatFileSize(bytes: number): string {
    return formatXesFileSize(bytes);
  }

  trackByEventId(_index: number, row: XesEventRow): string {
    return row.id;
  }

  trackByTraceIndex(_index: number, trace: XesTraceSummary): number {
    return trace.index;
  }

  trackByName(_index: number, item: { name: string }): string {
    return item.name;
  }

  trackByLabel(_index: number, item: { label: string }): string {
    return item.label;
  }
}
