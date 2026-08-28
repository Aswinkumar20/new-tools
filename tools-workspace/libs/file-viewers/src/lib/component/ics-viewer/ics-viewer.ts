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
  ICS_ACCEPT_ATTR,
  ICS_CURRENT_TIME_TICK_MS,
  ICS_DEFAULT_FILTERS,
  ICS_FORMATS_HINT,
  ICS_FORMATS_LABEL,
  ICS_HOUR_HEIGHT_PX,
  ICS_RELATED_TOOLS,
  ICS_TIMEZONE_OPTIONS,
  ICS_VIEW_OPTIONS
} from '../../constants/ics-viewer.constants';
import { buildIcsSampleCalendar } from '../../constants/ics-viewer-sample.data';
import type {
  IcsAgendaGroup,
  IcsCalendarEvent,
  IcsCalendarViewMode,
  IcsDayColumn,
  IcsFilterState,
  IcsLoadedFile,
  IcsMonthCell,
  IcsViewerStats,
  IcsYearMonth
} from '../../types/ics-viewer.types';
import {
  eventColor as icsEventColor,
  expandEventsForRange,
  parseIcsWithComponents,
  sanitizeIcsUrl
} from '../../utils/ics-viewer-parse.utils';
import {
  activeFilterCount,
  addMonths,
  buildAgendaGroups,
  buildDayColumns,
  buildMonthGrid,
  buildViewerStats,
  buildYearMonths,
  collectFilterOptions,
  createIcsFileId,
  currentTimeTopPct,
  datesForView,
  downloadTextFile,
  filterEvents,
  filterValidIcsFiles,
  formatDuration,
  formatEventTimeRange,
  formatIcsFileSize,
  formatViewTitle,
  hourLabels,
  navigateAnchor,
  resolveIcsSuggestion,
  revokeObjectUrl,
  startOfDay,
  toIsoDate,
  visibleRangeForView
} from '../../utils/ics-viewer.utils';

@Component({
  selector: 'lib-ics-viewer',
  standalone: true,
  templateUrl: './ics-viewer.html',
  styleUrls: ['./ics-viewer.scss'],
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
export class IcsViewerComponent implements OnInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('jumpDateInput') jumpDateInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = ICS_ACCEPT_ATTR;
  readonly formatsLabel = ICS_FORMATS_LABEL;
  readonly formatsHint = ICS_FORMATS_HINT;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = ICS_RELATED_TOOLS;
  readonly viewOptions = ICS_VIEW_OPTIONS;
  readonly hourHeightPx = ICS_HOUR_HEIGHT_PX;
  readonly hours = hourLabels();

  icsFiles: IcsLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;

  viewMode: IcsCalendarViewMode = 'month';
  anchorDate = startOfDay(new Date());
  selectedDate = startOfDay(new Date());
  displayTimeZone = '';
  filters: IcsFilterState = { ...ICS_DEFAULT_FILTERS };
  showFilters = false;
  showSidebar = true;
  showEventDetails = false;
  selectedEvent: IcsCalendarEvent | null = null;
  miniMonthAnchor = startOfDay(new Date());
  now = new Date();

  visibleEvents: IcsCalendarEvent[] = [];
  monthCells: IcsMonthCell[] = [];
  dayColumns: IcsDayColumn[] = [];
  agendaGroups: IcsAgendaGroup[] = [];
  yearMonths: IcsYearMonth[] = [];
  listEvents: IcsCalendarEvent[] = [];
  stats: IcsViewerStats | null = null;
  categoryOptions: string[] = [];
  statusOptions: string[] = [];
  calendarOptions: string[] = [];
  viewModeOptions: Array<SelectBoxOption<IcsCalendarViewMode>> = ICS_VIEW_OPTIONS.map((v) => ({
    label: v.label,
    value: v.id
  }));
  timezoneOptions: Array<SelectBoxOption<string>> = ICS_TIMEZONE_OPTIONS.map((tz) => ({
    label: tz.label,
    value: tz.value
  }));

  private componentsByUid = new Map<string, unknown>();
  private dragDepth = 0;
  private timeTicker: ReturnType<typeof setInterval> | null = null;
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  get currentFile(): IcsLoadedFile | null {
    return this.currentFileIndex >= 0 && this.currentFileIndex < this.icsFiles.length
      ? this.icsFiles[this.currentFileIndex]
      : null;
  }

  get viewTitle(): string {
    return formatViewTitle(this.viewMode, this.anchorDate);
  }

  get filterCount(): number {
    return activeFilterCount(this.filters);
  }

  get currentTimePct(): number {
    return currentTimeTopPct(this.now);
  }

  get showNowIndicator(): boolean {
    if (this.viewMode !== 'day' && this.viewMode !== 'week' && this.viewMode !== 'workWeek') {
      return false;
    }
    return this.dayColumns.some((c) => c.isToday);
  }

  get primarySuggestion() {
    const suggestion = resolveIcsSuggestion({
      hasFiles: this.icsFiles.length > 0,
      hasError: !!this.errorMessage,
      eventCount: this.stats?.events ?? 0
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  get safeSelectedUrl(): string | null {
    return sanitizeIcsUrl(this.selectedEvent?.url);
  }

  ngOnInit(): void {
    if (typeof Intl !== 'undefined') {
      this.displayTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      if (this.displayTimeZone && !this.timezoneOptions.some((o) => o.value === this.displayTimeZone)) {
        this.timezoneOptions = [
          { label: `Local (${this.displayTimeZone})`, value: this.displayTimeZone },
          ...this.timezoneOptions
        ];
      }
    }
    if (isPlatformBrowser(this.platformId)) {
      this.setupDragAndDrop();
      this.timeTicker = setInterval(() => {
        this.now = new Date();
        this.cdr.markForCheck();
      }, ICS_CURRENT_TIME_TICK_MS);
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
        document.removeEventListener(eventName, this.preventDefaultsFn, false);
        document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
      }
    }
    if (this.timeTicker) {
      clearInterval(this.timeTicker);
    }
    for (const file of this.icsFiles) {
      revokeObjectUrl(file.objectUrl);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.icsFiles.length) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (event.key === 'Escape' && this.showEventDetails) {
      this.closeEventDetails();
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowLeft') {
      this.goPrevious();
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      this.goNext();
      event.preventDefault();
    } else if (event.key === 't' || event.key === 'T') {
      this.goToday();
      event.preventDefault();
    }
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  setupDragAndDrop(): void {
    if (typeof document === 'undefined') {
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
    this.dragDepth += 1;
    this.showDropZone = true;
  }

  onDragLeave(): void {
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.showDropZone = false;
    }
  }

  onDrop(e: DragEvent): void {
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files?.length) {
      void this.handleFiles(Array.from(files));
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    const { valid, errors } = filterValidIcsFiles(files);
    if (errors.length) {
      this.errorMessage = errors[0];
      this.toast.error(errors[0]);
    }
    if (!valid.length) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    try {
      for (const file of valid) {
        const text = await file.text();
        const colorIndex = this.icsFiles.length;
        const parsed = parseIcsWithComponents(text, colorIndex);
        for (const [uid, comp] of parsed.componentsByUid) {
          this.componentsByUid.set(uid, comp);
        }
        const objectUrl =
          typeof URL !== 'undefined' ? URL.createObjectURL(file) : '';
        const record: IcsLoadedFile = {
          id: createIcsFileId(),
          name: file.name,
          size: file.size,
          sizeLabel: formatIcsFileSize(file.size),
          lastModified: file.lastModified,
          objectUrl,
          rawText: text,
          meta: parsed.meta,
          masters: parsed.masters.map((m) => ({
            ...m,
            calendarName: parsed.meta.calendarName || file.name.replace(/\.(ics|ical|ifb)$/i, '')
          })),
          warnings: parsed.warnings,
          eventCount: parsed.masters.length,
          colorIndex,
          visible: true
        };
        this.icsFiles = [...this.icsFiles, record];
        if (parsed.warnings.length) {
          this.toast.info(parsed.warnings[0]);
        }
      }
      this.currentFileIndex = this.icsFiles.length - 1;
      this.recompute();
      this.toast.success(
        valid.length === 1 ? `Loaded ${valid[0].name}` : `Loaded ${valid.length} calendars`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse calendar file.';
      this.errorMessage = message;
      this.toast.error(message);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  loadSample(): void {
    const sample = buildIcsSampleCalendar(new Date());
    const blob = new Blob([sample], { type: 'text/calendar' });
    const file = new File([blob], 'product-roadmap.ics', { type: 'text/calendar' });
    void this.handleFiles([file]);
  }

  clearAll(): void {
    for (const file of this.icsFiles) {
      revokeObjectUrl(file.objectUrl);
    }
    this.icsFiles = [];
    this.currentFileIndex = -1;
    this.componentsByUid.clear();
    this.visibleEvents = [];
    this.monthCells = [];
    this.dayColumns = [];
    this.agendaGroups = [];
    this.yearMonths = [];
    this.listEvents = [];
    this.stats = null;
    this.selectedEvent = null;
    this.showEventDetails = false;
    this.errorMessage = '';
    this.filters = { ...ICS_DEFAULT_FILTERS };
    this.toast.info('Cleared calendar files');
    this.cdr.markForCheck();
  }

  selectFile(index: number): void {
    this.currentFileIndex = index;
    this.recompute();
  }

  toggleCalendarVisibility(file: IcsLoadedFile): void {
    file.visible = !file.visible;
    this.icsFiles = [...this.icsFiles];
    this.recompute();
  }

  removeFile(index: number, event?: Event): void {
    event?.stopPropagation();
    const [removed] = this.icsFiles.splice(index, 1);
    if (removed) {
      revokeObjectUrl(removed.objectUrl);
    }
    this.icsFiles = [...this.icsFiles];
    if (!this.icsFiles.length) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(this.currentFileIndex, this.icsFiles.length - 1);
    this.recompute();
  }

  setViewMode(mode: IcsCalendarViewMode): void {
    this.viewMode = mode;
    this.recompute();
  }

  onViewModeSelect(mode: IcsCalendarViewMode | null): void {
    if (mode) {
      this.setViewMode(mode);
    }
  }

  onDisplayTimeZoneChange(zone: string | null): void {
    if (!zone) {
      return;
    }
    this.displayTimeZone = zone;
    this.cdr.markForCheck();
  }

  goToday(): void {
    const today = startOfDay(new Date());
    this.anchorDate = today;
    this.selectedDate = today;
    this.miniMonthAnchor = today;
    this.recompute();
  }

  goPrevious(): void {
    this.anchorDate = navigateAnchor(this.viewMode, this.anchorDate, -1);
    this.recompute();
  }

  goNext(): void {
    this.anchorDate = navigateAnchor(this.viewMode, this.anchorDate, 1);
    this.recompute();
  }

  selectDate(date: Date): void {
    this.selectedDate = startOfDay(date);
    this.anchorDate = startOfDay(date);
    if (this.viewMode === 'year' || this.viewMode === 'month') {
      this.viewMode = 'day';
    }
    this.recompute();
  }

  onMiniMonthPrev(): void {
    this.miniMonthAnchor = addMonths(this.miniMonthAnchor, -1);
    this.cdr.markForCheck();
  }

  onMiniMonthNext(): void {
    this.miniMonthAnchor = addMonths(this.miniMonthAnchor, 1);
    this.cdr.markForCheck();
  }

  get miniMonthCells(): IcsMonthCell[] {
    return buildMonthGrid(this.miniMonthAnchor, this.visibleEvents, this.selectedDate, this.now);
  }

  jumpToDate(value: string): void {
    if (!value) {
      return;
    }
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      this.toast.error('Invalid date');
      return;
    }
    this.selectDate(parsed);
  }

  openJumpPicker(): void {
    this.jumpDateInput?.nativeElement?.showPicker?.();
    this.jumpDateInput?.nativeElement?.focus();
  }

  onSearchChange(value: string): void {
    this.filters = { ...this.filters, search: value };
    this.recompute();
  }

  clearSearch(): void {
    this.filters = { ...this.filters, search: '' };
    this.recompute();
  }

  toggleFilterPanel(): void {
    this.showFilters = !this.showFilters;
  }

  toggleCategory(category: string): void {
    const set = new Set(this.filters.categories);
    if (set.has(category)) {
      set.delete(category);
    } else {
      set.add(category);
    }
    this.filters = { ...this.filters, categories: [...set] };
    this.recompute();
  }

  toggleStatus(status: string): void {
    const set = new Set(this.filters.statuses);
    if (set.has(status)) {
      set.delete(status);
    } else {
      set.add(status);
    }
    this.filters = { ...this.filters, statuses: [...set] };
    this.recompute();
  }

  toggleCalendarFilter(calendar: string): void {
    const set = new Set(this.filters.calendars);
    if (set.has(calendar)) {
      set.delete(calendar);
    } else {
      set.add(calendar);
    }
    this.filters = { ...this.filters, calendars: [...set] };
    this.recompute();
  }

  setAllDayOnly(value: boolean): void {
    this.filters = { ...this.filters, allDayOnly: value };
    this.recompute();
  }

  setRecurringOnly(value: boolean): void {
    this.filters = { ...this.filters, recurringOnly: value };
    this.recompute();
  }

  setHasAttendeesOnly(value: boolean): void {
    this.filters = { ...this.filters, hasAttendeesOnly: value };
    this.recompute();
  }

  clearFilters(): void {
    this.filters = { ...ICS_DEFAULT_FILTERS };
    this.recompute();
  }

  openEvent(event: IcsCalendarEvent, domEvent?: Event): void {
    domEvent?.stopPropagation();
    this.selectedEvent = event;
    this.showEventDetails = true;
    this.cdr.markForCheck();
  }

  closeEventDetails(): void {
    this.showEventDetails = false;
    this.selectedEvent = null;
    this.cdr.markForCheck();
  }

  downloadOriginal(): void {
    const file = this.currentFile;
    if (!file) {
      return;
    }
    downloadTextFile(file.name || 'calendar.ics', file.rawText);
    this.toast.success('Download started');
  }

  eventColor(index: number): string {
    return icsEventColor(index);
  }

  formatTime(event: IcsCalendarEvent): string {
    return formatEventTimeRange(event, this.displayTimeZone || undefined);
  }

  formatDuration(event: IcsCalendarEvent): string {
    return formatDuration(event);
  }

  trackByIso(_: number, cell: { isoDate: string }): string {
    return cell.isoDate;
  }

  trackByEventId(_: number, event: IcsCalendarEvent): string {
    return event.id;
  }

  trackByFileId(_: number, file: IcsLoadedFile): string {
    return file.id;
  }

  /** Rebuild visible events and active view grids (read-only). */
  refreshViews(): void {
    this.recompute();
  }

  private recompute(): void {
    const visibleFiles = this.icsFiles.filter((f) => f.visible);
    const masters = visibleFiles.flatMap((f) => f.masters);
    const { start, end } = visibleRangeForView(this.viewMode, this.anchorDate);

    // Expand recurrence using stored components
    const expanded = expandEventsForRange(
      masters,
      start,
      end,
      this.componentsByUid as never
    );

    this.visibleEvents = filterEvents(expanded, this.filters);
    this.stats = buildViewerStats(this.visibleEvents);
    const options = collectFilterOptions(masters);
    this.categoryOptions = options.categories;
    this.statusOptions = options.statuses;
    this.calendarOptions = options.calendars;

    switch (this.viewMode) {
      case 'month':
        this.monthCells = buildMonthGrid(
          this.anchorDate,
          this.visibleEvents,
          this.selectedDate,
          this.now
        );
        break;
      case 'week':
      case 'workWeek':
      case 'day':
        this.dayColumns = buildDayColumns(
          datesForView(this.viewMode, this.anchorDate),
          this.visibleEvents,
          this.now
        );
        break;
      case 'agenda':
        this.agendaGroups = buildAgendaGroups(this.visibleEvents, start, end, this.now);
        break;
      case 'list':
        this.listEvents = [...this.visibleEvents];
        break;
      case 'year':
        this.yearMonths = buildYearMonths(
          this.anchorDate.getFullYear(),
          this.visibleEvents,
          this.now
        );
        break;
    }
    this.cdr.markForCheck();
  }

  weekdayHeaders(): string[] {
    const start = new Date(2023, 0, 2); // Monday
    return Array.from({ length: 7 }, (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).toLocaleDateString(
        undefined,
        { weekday: 'short' }
      )
    );
  }

  moreEventsLabel(count: number): string {
    return `+${count} more`;
  }

  openDayFromOverflow(date: Date, event?: Event): void {
    event?.stopPropagation();
    this.selectedDate = startOfDay(date);
    this.anchorDate = startOfDay(date);
    this.viewMode = 'agenda';
    this.recompute();
  }

  isCategoryActive(category: string): boolean {
    return this.filters.categories.includes(category);
  }

  isStatusActive(status: string): boolean {
    return this.filters.statuses.includes(status);
  }

  isCalendarFilterActive(calendar: string): boolean {
    return this.filters.calendars.includes(calendar);
  }

  participantLabel(p: { name?: string; email?: string; raw: string }): string {
    return p.name || p.email || p.raw;
  }

  toIso(date: Date): string {
    return toIsoDate(date);
  }
}
