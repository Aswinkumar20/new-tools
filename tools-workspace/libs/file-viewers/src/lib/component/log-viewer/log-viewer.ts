import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { Subject, combineLatest, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { fvCopyText } from '../../shared/fv-clipboard.util';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  LOG_ACCEPT_ATTR,
  LOG_AUTO_SCROLL_DELAY_MS,
  LOG_CHART_RENDER_DELAY_MS,
  LOG_RELATED_TOOLS,
  LOG_SCROLL_BOTTOM_THRESHOLD_PX,
  LOG_SCROLL_TOP_BUTTON_THRESHOLD_PX,
  LOG_SEARCH_DEBOUNCE_MS
} from '../../constants/log-viewer.constants';
import { LogViewerService } from '../../services/log-viewer.service';
import type { LogEntry, LogFilter, LogStats } from '../../types/log-viewer.types';
import { LogLevel } from '../../types/log-viewer.types';
import {
  buildLogLevelChartConfig,
  formatLogLevelPercentage,
  formatLogTimestamp,
  getLogLevelClass,
  getLogLevelColor,
  getLogLevelIcon,
  isValidLogFile,
  loadChartJsLibrary,
  previewLogMessage,
  resolveLogSuggestion
} from '../../utils/log-viewer.utils';

@Component({
  selector: 'lib-log-viewer',
  standalone: true,
  templateUrl: './log-viewer.html',
  styleUrls: ['./log-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LogViewerService]
})
export class LogViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  readonly LogLevel = LogLevel;
  readonly acceptAttr = LOG_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = LOG_RELATED_TOOLS;

  @Input() logs: string[] | LogEntry[] = [];
  @Input() title?: string;
  @Input() autoScroll = true;
  @Input() liveMode = false;
  @Input() theme: 'light' | 'dark' = 'light';
  @Input() compact = false;

  @Output() filtered = new EventEmitter<LogEntry[]>();
  @Output() logSelected = new EventEmitter<LogEntry>();

  @ViewChild('logContainer') logContainer!: ElementRef<HTMLElement>;
  @ViewChild('statsChart') statsChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  allLogEntries: LogEntry[] = [];
  filteredLogEntries: LogEntry[] = [];
  displayedLogEntries: LogEntry[] = [];

  filter: LogFilter = {
    searchText: '',
    levels: [],
    regexEnabled: false
  };

  searchText$ = new Subject<string>();
  searchText = '';
  selectedLevels = new Set<LogLevel>();
  showFilters = false;
  showStats = false;
  showAbout = false;
  isDarkTheme = false;
  stats: LogStats | null = null;
  chartInstance: { destroy(): void; resize?: () => void } | null = null;

  showDropZone = false;
  loading = false;
  errorMessage = '';
  loadedFileName = '';
  loadedFileContent = '';
  wordWrap = true;
  dismissedSuggestionId: string | null = null;

  scrollPosition = 0;
  isAtBottom = true;
  showScrollToTop = false;
  showScrollToBottom = false;

  private destroy$ = new Subject<void>();
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  constructor(
    private readonly logService: LogViewerService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {
    this.isDarkTheme = this.theme === 'dark';
  }

  get allLevels(): LogLevel[] {
    return Object.values(LogLevel);
  }

  get primarySuggestion() {
    const suggestion = resolveLogSuggestion({
      hasLogs: this.allLogEntries.length > 0,
      hasError: !!this.errorMessage,
      errorCount: this.getLevelCount(LogLevel.ERROR) + this.getLevelCount(LogLevel.FATAL),
      regexEnabled: this.filter.regexEnabled,
      searchText: this.searchText
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnInit(): void {
    this.setupFiltering();
    this.setupDragAndDrop();
    this.processLogs();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      loadChartJsLibrary().catch(() => undefined);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyChart();
    this.cleanup();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.markForCheck();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.cdr.markForCheck();
    if (this.chartInstance && this.statsChart?.nativeElement) {
      setTimeout(() => {
        this.chartInstance?.resize?.();
      }, LOG_CHART_RENDER_DELAY_MS);
    }
  }

  setupFiltering(): void {
    combineLatest([this.searchText$.pipe(debounceTime(LOG_SEARCH_DEBOUNCE_MS), distinctUntilChanged())])
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
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

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  onDragEnter(): void {
    this.showDropZone = true;
    this.cdr.markForCheck();
  }

  onDragLeave(): void {
    this.showDropZone = false;
    this.cdr.markForCheck();
  }

  onDrop(e: DragEvent): void {
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void this.loadLogFile(files[0]);
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.loadLogFile(input.files[0]);
    }
  }

  async loadLogFile(file: File): Promise<void> {
    if (!isValidLogFile(file)) {
      this.errorMessage = 'Please select a valid log file (.log or .txt)';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      const content = await file.text();
      this.loadedFileName = file.name;
      this.loadedFileContent = content;
      this.logs = content.split('\n');
      this.processLogs();
      this.loading = false;
      this.cdr.markForCheck();
    } catch (error) {
      this.errorMessage = `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  processLogs(): void {
    if (this.logs.length === 0) {
      this.allLogEntries = [];
      this.filteredLogEntries = [];
      this.displayedLogEntries = [];
      this.cdr.markForCheck();
      return;
    }

    if (typeof this.logs[0] === 'string') {
      this.allLogEntries = this.logService.parseLogs(this.logs as string[]);
    } else {
      this.allLogEntries = this.logs as LogEntry[];
    }

    this.calculateStats();
    this.applyFilters();

    if (this.autoScroll) {
      setTimeout(() => this.scrollToBottom(), LOG_AUTO_SCROLL_DELAY_MS);
    }
  }

  applyFilters(): void {
    this.filter.searchText = this.searchText || '';
    this.filter.levels = Array.from(this.selectedLevels);

    this.filteredLogEntries = this.logService.filterLogs(this.allLogEntries, this.filter);
    this.displayedLogEntries = this.filteredLogEntries;
    this.filtered.emit(this.filteredLogEntries);
    this.calculateStats();
    this.cdr.markForCheck();
  }

  onSearchChange(value: string): void {
    this.searchText = value;
    this.searchText$.next(value);
  }

  toggleLevel(level: LogLevel): void {
    if (this.selectedLevels.has(level)) {
      this.selectedLevels.delete(level);
    } else {
      this.selectedLevels.add(level);
    }
    this.applyFilters();
  }

  selectAllLevels(): void {
    for (const level of Object.values(LogLevel)) {
      this.selectedLevels.add(level);
    }
    this.applyFilters();
  }

  clearFilters(): void {
    this.selectedLevels.clear();
    this.searchText = '';
    this.searchText$.next('');
    if (this.filter) {
      this.filter.dateFrom = undefined;
      this.filter.dateTo = undefined;
    }
    this.applyFilters();
  }

  clearAll(): void {
    this.allLogEntries = [];
    this.filteredLogEntries = [];
    this.displayedLogEntries = [];
    this.logs = [];
    this.loadedFileName = '';
    this.loadedFileContent = '';
    this.stats = null;
    this.searchText = '';
    this.searchText$.next('');
    this.selectedLevels.clear();
    this.errorMessage = '';
    this.loading = false;
    this.dismissedSuggestionId = null;
    this.destroyChart();
    this.cdr.markForCheck();
  }

  calculateStats(): void {
    this.stats = this.logService.calculateStats(this.filteredLogEntries);
    if (this.showStats && this.stats) {
      setTimeout(() => void this.renderStatsChart(), LOG_CHART_RENDER_DELAY_MS);
    }
  }

  async renderStatsChart(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.statsChart?.nativeElement || !this.stats) {
      return;
    }

    try {
      const ChartLib = await loadChartJsLibrary();
      const ctx = this.statsChart.nativeElement.getContext('2d');
      if (!ctx) {
        return;
      }

      this.destroyChart();
      this.chartInstance = new ChartLib(ctx, buildLogLevelChartConfig(this.stats));
    } catch {
      // Chart is optional analytics; keep log viewing usable without it
    }
  }

  destroyChart(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    this.theme = this.isDarkTheme ? 'dark' : 'light';
    this.cdr.markForCheck();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    this.cdr.markForCheck();
  }

  toggleStats(): void {
    this.showStats = !this.showStats;
    if (this.showStats) {
      setTimeout(() => void this.renderStatsChart(), LOG_CHART_RENDER_DELAY_MS);
    } else {
      this.destroyChart();
    }
    this.cdr.markForCheck();
  }

  toggleAbout(): void {
    this.showAbout = !this.showAbout;
    this.cdr.markForCheck();
  }

  toggleWordWrap(): void {
    this.wordWrap = !this.wordWrap;
    this.cdr.markForCheck();
  }

  downloadFile(): void {
    if (!this.loadedFileContent && this.allLogEntries.length === 0) {
      return;
    }

    const content =
      this.loadedFileContent || this.allLogEntries.map((entry) => entry.raw).join('\n');
    const fileName = this.loadedFileName || 'log-export.log';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore revoke failures in test environments
    }
    this.toast.info(`Downloaded ${fileName}`);
  }

  onScroll(event: Event): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const target = event.target as HTMLElement;
    if (!target) {
      return;
    }

    const scrollTop = target.scrollTop || 0;
    const scrollHeight = target.scrollHeight || 0;
    const clientHeight = target.clientHeight || 0;

    this.scrollPosition = scrollTop;
    this.isAtBottom = scrollHeight - scrollTop - clientHeight < LOG_SCROLL_BOTTOM_THRESHOLD_PX;
    this.showScrollToTop = scrollTop > LOG_SCROLL_TOP_BUTTON_THRESHOLD_PX;
    this.showScrollToBottom = !this.isAtBottom && scrollHeight > clientHeight;
    this.cdr.markForCheck();
  }

  scrollToTop(): void {
    if (this.logContainer?.nativeElement) {
      const element = this.logContainer.nativeElement;
      if (element.scrollTo) {
        element.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        element.scrollTop = 0;
      }
    }
  }

  scrollToBottom(): void {
    if (this.logContainer?.nativeElement) {
      const element = this.logContainer.nativeElement;
      const scrollHeight = element.scrollHeight;
      if (element.scrollTo) {
        element.scrollTo({ top: scrollHeight, behavior: 'smooth' });
      } else {
        element.scrollTop = scrollHeight;
      }
      this.isAtBottom = true;
      this.showScrollToBottom = false;
      this.cdr.markForCheck();
    }
  }

  toggleLogEntry(entry: LogEntry): void {
    if (entry.isMultiLine) {
      entry.expanded = !entry.expanded;
      this.cdr.markForCheck();
    }
  }

  async copyLogLine(entry: LogEntry, event: Event): Promise<void> {
    event.stopPropagation();
    await fvCopyText(this.toast, entry.raw, 'Log line');
  }

  selectLogEntry(entry: LogEntry): void {
    this.logSelected.emit(entry);
  }

  getLogLevelClass(level: LogLevel): string {
    return getLogLevelClass(level);
  }

  getLogLevelColor(level: LogLevel): string {
    return getLogLevelColor(level);
  }

  getLogLevelIcon(level: LogLevel): string {
    return getLogLevelIcon(level);
  }

  formatTimestamp(date: Date): string {
    return formatLogTimestamp(date);
  }

  previewMessage(message: string): string {
    return previewLogMessage(message);
  }

  trackByEntryId(_index: number, entry: LogEntry): string {
    return entry.id;
  }

  getLevelCount(level: LogLevel): number {
    return this.stats?.byLevel[level] || 0;
  }

  getLevelPercentage(level: LogLevel): string {
    return formatLogLevelPercentage(this.stats, level);
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
}
