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
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  AUDIT_LOG_ACCEPT_ATTR,
  AUDIT_LOG_DESCRIPTION,
  AUDIT_LOG_FORMATS_LABEL,
  AUDIT_LOG_HELP_ITEMS,
  AUDIT_LOG_RELATED_TOOLS,
  AUDIT_LOG_TITLE
} from '../../constants/audit-log-viewer.constants';
import type { AuditLogEvent } from '../../utils/audit-log-viewer.utils';
import {
  collectAuditActors,
  filterAuditEvents,
  formatAuditTimestamp,
  isAuditLogFile,
  parseAuditLogContent,
  resolveAuditSuggestion
} from '../../utils/audit-log-viewer.utils';

@Component({
  selector: 'lib-audit-log-viewer',
  standalone: true,
  templateUrl: './audit-log-viewer.html',
  styleUrls: ['./audit-log-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditLogViewerComponent implements OnInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly title = AUDIT_LOG_TITLE;
  readonly description = AUDIT_LOG_DESCRIPTION;
  readonly acceptAttr = AUDIT_LOG_ACCEPT_ATTR;
  readonly formatsLabel = AUDIT_LOG_FORMATS_LABEL;
  readonly helpItems = AUDIT_LOG_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = AUDIT_LOG_RELATED_TOOLS;

  allEvents: AuditLogEvent[] = [];
  filteredEvents: AuditLogEvent[] = [];
  actors: string[] = [];

  searchText = '';
  selectedActor = '';
  loadedFileName = '';

  loading = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  get primarySuggestion() {
    const suggestion = resolveAuditSuggestion({
      hasEvents: this.allEvents.length > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  get eventCount(): number {
    return this.allEvents.length;
  }

  get uniqueActorCount(): number {
    return this.actors.length;
  }

  get shownCount(): number {
    return this.filteredEvents.length;
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
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

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(e: DragEvent): void {
    if (e.dataTransfer?.types.includes('Files')) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(e: DragEvent): void {
    const currentTarget = e.currentTarget as HTMLElement | null;
    const relatedTarget = e.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && !currentTarget.contains(relatedTarget)) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(e: DragEvent): void {
    this.preventDefaults(e);
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.handleFiles(Array.from(input.files));
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    const file = files.find((candidate) => isAuditLogFile(candidate));
    if (!file) {
      this.errorMessage = `Please select a valid audit export (${this.formatsLabel}).`;
      this.dismissedSuggestionId = null;
      this.toast.error('No supported audit log files found');
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      const content = await this.readFileText(file);
      const events = parseAuditLogContent(content, file.name);
      this.allEvents = sortAuditEvents(events);
      this.loadedFileName = file.name;
      this.actors = collectAuditActors(this.allEvents);
      this.selectedActor = '';
      this.searchText = '';
      this.applyFilters();
      this.toast.success(`Loaded ${this.allEvents.length} audit event${this.allEvents.length === 1 ? '' : 's'}`);
    } catch (error) {
      this.errorMessage = `Failed to parse audit log: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.allEvents = [];
      this.filteredEvents = [];
      this.actors = [];
      this.dismissedSuggestionId = null;
      this.toast.error('Failed to parse audit log');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  applyFilters(): void {
    this.filteredEvents = filterAuditEvents(this.allEvents, this.searchText, this.selectedActor);
    this.cdr.markForCheck();
  }

  onSearchChange(value: string): void {
    this.searchText = value;
    this.applyFilters();
  }

  onActorChange(value: string): void {
    this.selectedActor = value;
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchText = '';
    this.applyFilters();
  }

  clearAll(): void {
    this.allEvents = [];
    this.filteredEvents = [];
    this.actors = [];
    this.searchText = '';
    this.selectedActor = '';
    this.loadedFileName = '';
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.toast.info('Audit log cleared');
    this.cdr.markForCheck();
  }

  formatTimestamp(value: string): string {
    return formatAuditTimestamp(value);
  }

  trackByEventId(_index: number, event: AuditLogEvent): string {
    return event.id;
  }

  private async readFileText(file: Blob): Promise<string> {
    if (typeof file.text === 'function') {
      return file.text();
    }
    if (typeof file.arrayBuffer === 'function') {
      const buffer = await file.arrayBuffer();
      return new TextDecoder('utf-8').decode(buffer);
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : '');
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsText(file);
    });
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

function sortAuditEvents(events: AuditLogEvent[]): AuditLogEvent[] {
  return [...events].sort((left, right) => {
    const leftTime = Date.parse(left.timestamp);
    const rightTime = Date.parse(right.timestamp);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return left.timestamp.localeCompare(right.timestamp);
    }
    return leftTime - rightTime;
  });
}
