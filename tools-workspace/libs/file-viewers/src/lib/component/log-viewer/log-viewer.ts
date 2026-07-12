import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  HostListener,
  PLATFORM_ID,
  Inject,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { Subject, combineLatest, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { LogEntry, LogLevel, LogFilter, LogStats } from './log-entry.model';
import { LogViewerService } from './log-viewer.service';

declare const Chart: {
  new (ctx: CanvasRenderingContext2D, config: any): {
    destroy(): void;
    update(): void;
  };
};

// Load Chart.js dynamically
async function loadChartJs(): Promise<typeof Chart> {
  if (typeof window === 'undefined') {
    throw new TypeError('Chart.js can only be loaded in browser environment');
  }

  if ((window as any).Chart) {
    return (window as any).Chart;
  }

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const ChartLib = (window as any).Chart;
      resolve(ChartLib);
    };
    script.onerror = () => reject(new Error('Failed to load Chart.js library'));
  });
}

@Component({
  selector: 'lib-log-viewer',
  standalone: true,
  templateUrl: './log-viewer.html',
  styleUrls: ['./log-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LogViewerService]
})
export class LogViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  readonly LogLevel = LogLevel;
  @Input() logs: string[] | LogEntry[] = [];
  @Input() title?: string;
  @Input() autoScroll: boolean = true;
  @Input() liveMode: boolean = false;
  @Input() theme: 'light' | 'dark' = 'light';
  @Input() compact: boolean = false;

  @Output() filtered = new EventEmitter<LogEntry[]>();
  @Output() logSelected = new EventEmitter<LogEntry>();

  @ViewChild('logContainer') logContainer!: ElementRef<HTMLElement>;
  @ViewChild('statsChart') statsChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Parsed log entries
  allLogEntries: LogEntry[] = [];
  filteredLogEntries: LogEntry[] = [];
  displayedLogEntries: LogEntry[] = [];

  // Filter state
  filter: LogFilter = {
    searchText: '',
    levels: [],
    regexEnabled: false
  };

  // UI state
  searchText$ = new Subject<string>();
  searchText: string = '';
  selectedLevels = new Set<LogLevel>();
  showFilters: boolean = false;
  showStats: boolean = false;
  showAbout: boolean = false;
  isDarkTheme: boolean = false;
  stats: LogStats | null = null;
  chartInstance: any = null;

  // File upload
  showDropZone: boolean = false;
  loading: boolean = false;
  errorMessage: string = '';
  loadedFileName: string = '';
  loadedFileContent: string = '';
  wordWrap: boolean = true;

  // Scroll state
  scrollPosition: number = 0;
  isAtBottom: boolean = true;
  showScrollToTop: boolean = false;
  showScrollToBottom: boolean = false;

  private destroy$ = new Subject<void>();
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  constructor(
    private readonly logService: LogViewerService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {
    this.isDarkTheme = this.theme === 'dark';
  }

  ngOnInit(): void {
    this.setupFiltering();
    this.setupDragAndDrop();
    this.processLogs();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Load Chart.js for analytics
      loadChartJs().catch(err => {
        console.warn('Failed to load Chart.js:', err);
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyChart();
    this.cleanup();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.cdr.markForCheck();
    if (this.chartInstance && this.statsChart?.nativeElement) {
      setTimeout(() => {
        this.chartInstance?.resize();
      }, 100);
    }
  }

  setupFiltering(): void {
    combineLatest([
      this.searchText$.pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.applyFilters();
    });
  }

  setupDragAndDrop(): void {
    if (!isPlatformBrowser(this.platformId)) return;

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
      this.loadLogFile(files[0]);
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.loadLogFile(input.files[0]);
    }
  }

  async loadLogFile(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.log') && file.type !== 'text/plain') {
      this.errorMessage = 'Please select a valid log file (.log or .txt)';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const content = await file.text();
      this.loadedFileName = file.name;
      this.loadedFileContent = content;
      const lines = content.split('\n');
      this.logs = lines;
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

    // Convert string[] to LogEntry[] if needed
    if (this.logs.length > 0 && typeof this.logs[0] === 'string') {
      this.allLogEntries = this.logService.parseLogs(this.logs as string[]);
    } else {
      this.allLogEntries = this.logs as LogEntry[];
    }

    this.calculateStats();
    this.applyFilters();

    // Auto-scroll to bottom if enabled
    if (this.autoScroll) {
      setTimeout(() => this.scrollToBottom(), 100);
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
    Object.values(LogLevel).forEach(level => {
      this.selectedLevels.add(level);
    });
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
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
    this.cdr.markForCheck();
  }

  calculateStats(): void {
    this.stats = this.logService.calculateStats(this.filteredLogEntries);
    if (this.showStats && this.stats) {
      setTimeout(() => this.renderStatsChart(), 100);
    }
  }

  async renderStatsChart(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.statsChart?.nativeElement || !this.stats) {
      return;
    }

    try {
      const ChartLib = await loadChartJs();
      const ctx = this.statsChart.nativeElement.getContext('2d');
      if (!ctx) return;

      // Destroy previous chart
      this.destroyChart();

      const levelColors: Record<LogLevel, string> = {
        [LogLevel.FATAL]: '#d32f2f',
        [LogLevel.ERROR]: '#f44336',
        [LogLevel.WARN]: '#ff9800',
        [LogLevel.INFO]: '#2196f3',
        [LogLevel.DEBUG]: '#4caf50',
        [LogLevel.TRACE]: '#9e9e9e',
        [LogLevel.UNKNOWN]: '#757575'
      };

      // Level distribution chart
      const levelData = Object.entries(this.stats.byLevel)
        .filter(([_, count]) => count > 0)
        .map(([level, count]) => ({
          level: level as LogLevel,
          count
        }));

      this.chartInstance = new ChartLib(ctx, {
        type: 'bar',
        data: {
          labels: levelData.map(d => d.level),
          datasets: [{
            label: 'Log Count',
            data: levelData.map(d => d.count),
            backgroundColor: levelData.map(d => levelColors[d.level]),
            borderColor: levelData.map(d => levelColors[d.level]),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to render chart:', error);
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
      setTimeout(() => this.renderStatsChart(), 100);
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

    const content = this.loadedFileContent || this.allLogEntries.map(entry => entry.raw).join('\n');
    const fileName = this.loadedFileName || 'log-export.log';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  onScroll(event: Event): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    const target = event.target as HTMLElement;
    if (!target) return;
    
    const scrollTop = target.scrollTop || (target as any).scrollTop || 0;
    const scrollHeight = target.scrollHeight || (target as any).scrollHeight || 0;
    const clientHeight = target.clientHeight || (target as any).clientHeight || 0;

    this.scrollPosition = scrollTop;
    this.isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    this.showScrollToTop = scrollTop > 500;
    this.showScrollToBottom = !this.isAtBottom && scrollHeight > clientHeight;
    this.cdr.markForCheck();
  }

  scrollToTop(): void {
    if (this.logContainer?.nativeElement) {
      const element = this.logContainer.nativeElement;
      if (element.scrollTo) {
        element.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        (element as any).scrollTop = 0;
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
        (element as any).scrollTop = scrollHeight;
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
    try {
      await navigator.clipboard.writeText(entry.raw);
      // Show feedback (you could add a toast notification here)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

  selectLogEntry(entry: LogEntry): void {
    this.logSelected.emit(entry);
  }

  getLogLevelClass(level: LogLevel): string {
    return `log-level-${level.toLowerCase()}`;
  }

  getLogLevelColor(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
      [LogLevel.FATAL]: '#d32f2f',
      [LogLevel.ERROR]: '#f44336',
      [LogLevel.WARN]: '#ff9800',
      [LogLevel.INFO]: '#2196f3',
      [LogLevel.DEBUG]: '#4caf50',
      [LogLevel.TRACE]: '#9e9e9e',
      [LogLevel.UNKNOWN]: '#757575'
    };
    return colors[level] || colors[LogLevel.UNKNOWN];
  }

  getLogLevelIcon(level: LogLevel): string {
    const icons: Record<LogLevel, string> = {
      [LogLevel.FATAL]: '🔴',
      [LogLevel.ERROR]: '❌',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.DEBUG]: '🔍',
      [LogLevel.TRACE]: '📝',
      [LogLevel.UNKNOWN]: '❓'
    };
    return icons[level] || icons[LogLevel.UNKNOWN];
  }

  formatTimestamp(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  }

  get allLevels(): LogLevel[] {
    return Object.values(LogLevel);
  }

  trackByEntryId(index: number, entry: LogEntry): string {
    return entry.id;
  }

  getLevelCount(level: LogLevel): number {
    return this.stats?.byLevel[level] || 0;
  }

  getLevelPercentage(level: LogLevel): string {
    if (!this.stats || this.stats.total === 0) return '0%';
    return ((this.stats.byLevel[level] / this.stats.total) * 100).toFixed(1) + '%';
  }

  cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
  }
}
