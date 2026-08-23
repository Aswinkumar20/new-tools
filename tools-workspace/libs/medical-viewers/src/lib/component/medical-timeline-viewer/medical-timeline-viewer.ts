import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  TIMELINE_ACCEPT_ATTR,
  TIMELINE_EVENT_CATEGORIES,
  TIMELINE_FORMATS_HINT,
  TIMELINE_FORMATS_LABEL,
  TIMELINE_RELATED_TOOLS,
  TIMELINE_SUPPORTED_EXTENSIONS
} from '../../constants/medical-timeline-viewer.constants';
import type {
  ClinicalTimelineEvent,
  TimelineExportFormat,
  TimelineGroupMode,
  TimelineLoadedDocument
} from '../../types/medical-timeline-viewer.types';
import {
  canExportTimeline,
  categoryCounts,
  createSampleTimelineFile,
  createTimelineDocumentRecord,
  downloadBinaryFile,
  downloadTextFile,
  exportTimelineEventsCsv,
  exportTimelineEventsJson,
  exportTimelineSummaryJson,
  filterTimelineEvents,
  filterValidTimelineFiles,
  formatTimelineFileSize,
  groupTimelineEvents,
  readTimelineFileBytes,
  resolveTimelineSuggestion
} from '../../utils/medical-timeline-viewer.utils';
import {
  clipboardFiles,
  clipboardText,
  fileFromPastedText,
  looksLikeTimelineText
} from '../../utils/clinical-document.utils';

@Component({
  selector: 'lib-medical-timeline-viewer',
  standalone: true,
  templateUrl: './medical-timeline-viewer.html',
  styleUrls: ['./medical-timeline-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MedicalTimelineViewerComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('eventSearchInput') eventSearchInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = TIMELINE_ACCEPT_ATTR;
  readonly relatedTools = TIMELINE_RELATED_TOOLS;
  readonly supportedExtensions = TIMELINE_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = TIMELINE_FORMATS_LABEL;
  readonly formatsHint = TIMELINE_FORMATS_HINT;
  readonly categories = TIMELINE_EVENT_CATEGORIES;
  readonly groupModes: ReadonlyArray<{ id: TimelineGroupMode; label: string }> = [
    { id: 'none', label: 'Flat' },
    { id: 'month', label: 'By month' },
    { id: 'category', label: 'By category' }
  ];

  documents: TimelineLoadedDocument[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  eventQuery = '';
  activeCategory: string | null = null;
  groupMode: TimelineGroupMode = 'month';
  selectedEventId: string | null = null;

  private dragDepth = 0;

  get currentDocument(): TimelineLoadedDocument | null {
    return this.currentIndex >= 0 ? this.documents[this.currentIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportTimeline(this.currentDocument);
  }

  get warnings(): string[] {
    return this.currentDocument?.warnings ?? [];
  }

  get primarySuggestion() {
    const suggestion = resolveTimelineSuggestion({
      hasDocuments: this.documents.length > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) return null;
    return suggestion;
  }

  get filteredEvents(): ClinicalTimelineEvent[] {
    const doc = this.currentDocument;
    if (!doc) return [];
    return filterTimelineEvents(doc.parsed.events, this.eventQuery, this.activeCategory);
  }

  get groupedEvents() {
    return groupTimelineEvents(this.filteredEvents, this.groupMode);
  }

  get categoryStats() {
    return this.currentDocument ? categoryCounts(this.currentDocument.parsed.events) : [];
  }

  get selectedEvent(): ClinicalTimelineEvent | null {
    if (!this.selectedEventId) return null;
    return this.filteredEvents.find((e) => e.id === this.selectedEventId) ?? null;
  }

  get headerLabel(): string {
    const doc = this.currentDocument;
    if (!doc) return '';
    const patient = doc.parsed.patientLabel ? `${doc.parsed.patientLabel} · ` : '';
    return `${patient}${doc.parsed.events.length} events · ${doc.format.toUpperCase()}`;
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

  @HostListener('window:paste', ['$event'])
  async onWindowPaste(event: ClipboardEvent): Promise<void> {
    if (this.isTypingTarget(event.target)) return;
    const files = clipboardFiles(event);
    if (files.length) {
      event.preventDefault();
      await this.handleFiles(files);
      return;
    }
    const text = clipboardText(event);
    if (!looksLikeTimelineText(text)) return;
    const trimmed = text.trim();
    let filename = 'pasted-timeline.json';
    let mime = 'application/json';
    if (trimmed.startsWith('<')) {
      filename = 'pasted-timeline.xml';
      mime = 'application/xml';
    } else if (/^(MSH|FHS|BHS)\|/m.test(trimmed)) {
      filename = 'pasted-timeline.hl7';
      mime = 'text/plain';
    } else if (trimmed.includes(',') && /date/i.test(trimmed.split(/\r?\n/, 1)[0] ?? '')) {
      filename = 'pasted-timeline.csv';
      mime = 'text/csv';
    }
    const file = fileFromPastedText(text, filename, mime);
    if (!file) return;
    event.preventDefault();
    await this.handleFiles([file]);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentDocument || this.isTypingTarget(event.target)) return;
    if (event.key === '/') {
      event.preventDefault();
      this.eventSearchInput?.nativeElement?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (this.showExportMenu) this.showExportMenu = false;
      else if (this.selectedEventId) this.selectedEventId = null;
      this.cdr.markForCheck();
    }
  }

  trackByDocumentId(_index: number, doc: TimelineLoadedDocument): string {
    return doc.id;
  }

  trackByEventId(_index: number, event: ClinicalTimelineEvent): string {
    return event.id;
  }

  trackByGroupKey(_index: number, group: { key: string }): string {
    return group.key;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatTimelineFileSize(bytes);
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
    const { accepted, rejected } = filterValidTimelineFiles(files);
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const loaded: TimelineLoadedDocument[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readTimelineFileBytes(file);
          loaded.push(createTimelineDocumentRecord(file, bytes));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid timeline document';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = [...this.documents, ...loaded];
        const byId = new Map<string, TimelineLoadedDocument>();
        for (const item of merged) byId.set(item.id, item);
        this.documents = Array.from(byId.values());
        this.currentIndex = Math.min(
          Math.max(0, this.documents.length - loaded.length),
          this.documents.length - 1
        );
        this.resetFilters();
        const current = this.currentDocument;
        if (current) {
          this.toast.success(`Loaded ${current.name}`);
          if (current.warnings.length) {
            this.toast.info(`${current.warnings.length} note(s) about this timeline`);
          }
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load timeline';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleTimelineFile()]);
  }

  selectDocument(index: number): void {
    if (index < 0 || index >= this.documents.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetFilters();
    this.cdr.markForCheck();
  }

  removeDocument(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.documents.length) return;
    const next = this.documents.filter((_, i) => i !== index);
    this.documents = next;
    if (!next.length) {
      this.clearAll();
      return;
    }
    if (this.currentIndex >= next.length) this.currentIndex = next.length - 1;
    else if (index < this.currentIndex) this.currentIndex -= 1;
    this.resetFilters();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.documents = [];
    this.currentIndex = -1;
    this.errorMessage = '';
    this.resetFilters();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { id: string }): void {
    if (suggestion.id === 'try-sample') void this.loadSample();
    else if (suggestion.id === 'upload') this.openFilePicker();
  }

  setCategory(category: string | null): void {
    this.activeCategory = this.activeCategory === category ? null : category;
    this.cdr.markForCheck();
  }

  setGroupMode(mode: TimelineGroupMode): void {
    this.groupMode = mode;
    this.cdr.markForCheck();
  }

  selectEvent(event: ClinicalTimelineEvent): void {
    this.selectedEventId = event.id;
    this.cdr.markForCheck();
  }

  closeEventDetail(): void {
    this.selectedEventId = null;
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

  exportAs(format: TimelineExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentDocument;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.[^.]+$/, '') || 'clinical-timeline';
    try {
      if (format === 'original') {
        downloadBinaryFile(current.bytes, current.name, 'application/octet-stream');
        this.toast.success('Exported original file');
      } else if (format === 'summary-json') {
        downloadTextFile(exportTimelineSummaryJson(current), `${base}-summary.json`, 'application/json');
        this.toast.success('Exported summary JSON');
      } else if (format === 'events-json') {
        downloadTextFile(exportTimelineEventsJson(current), `${base}-events.json`, 'application/json');
        this.toast.success('Exported events JSON');
      } else if (format === 'events-csv') {
        downloadTextFile(exportTimelineEventsCsv(current.parsed.events), `${base}-events.csv`, 'text/csv');
        this.toast.success('Exported events CSV');
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private resetFilters(): void {
    this.eventQuery = '';
    this.activeCategory = null;
    this.selectedEventId = null;
    this.groupMode = 'month';
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private isFileDrag(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }
}
