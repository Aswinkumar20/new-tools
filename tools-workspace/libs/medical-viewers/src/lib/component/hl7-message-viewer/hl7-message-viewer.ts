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
  HL7_ACCEPT_ATTR,
  HL7_COMMON_SEGMENTS,
  HL7_FORMATS_HINT,
  HL7_FORMATS_LABEL,
  HL7_RELATED_TOOLS,
  HL7_SUPPORTED_EXTENSIONS
} from '../../constants/hl7-message-viewer.constants';
import type { Hl7ExportFormat, Hl7LoadedMessage, Hl7Segment } from '../../types/hl7-message-viewer.types';
import {
  canExportHl7,
  createHl7MessageRecord,
  createSampleHl7File,
  downloadBinaryFile,
  downloadTextFile,
  exportHl7SegmentsJson,
  exportHl7SummaryJson,
  filterHl7Segments,
  filterValidHl7Files,
  formatHl7FileSize,
  formatHl7Message,
  readHl7FileBytes,
  resolveHl7Suggestion,
  segmentTypeCounts
} from '../../utils/hl7-message-viewer.utils';
import {
  clipboardFiles,
  clipboardText,
  fileFromPastedText,
  looksLikeHl7Text
} from '../../utils/clinical-document.utils';

@Component({
  selector: 'lib-hl7-message-viewer',
  standalone: true,
  templateUrl: './hl7-message-viewer.html',
  styleUrls: ['./hl7-message-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Hl7MessageViewerComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('segmentSearchInput') segmentSearchInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = HL7_ACCEPT_ATTR;
  readonly relatedTools = HL7_RELATED_TOOLS;
  readonly supportedExtensions = HL7_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = HL7_FORMATS_LABEL;
  readonly formatsHint = HL7_FORMATS_HINT;
  readonly commonSegments = HL7_COMMON_SEGMENTS;

  messages: Hl7LoadedMessage[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  segmentQuery = '';
  selectedSegmentId: string | null = null;
  showRawMessage = false;

  private dragDepth = 0;

  get currentMessage(): Hl7LoadedMessage | null {
    return this.currentIndex >= 0 ? this.messages[this.currentIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportHl7(this.currentMessage);
  }

  get warnings(): string[] {
    return this.currentMessage?.warnings ?? [];
  }

  get primarySuggestion() {
    const suggestion = resolveHl7Suggestion({
      hasMessages: this.messages.length > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) return null;
    return suggestion;
  }

  get filteredSegments(): Hl7Segment[] {
    const msg = this.currentMessage;
    if (!msg) return [];
    return filterHl7Segments(msg.parsed.segments, this.segmentQuery);
  }

  get selectedSegment(): Hl7Segment | null {
    const msg = this.currentMessage;
    if (!msg || !this.selectedSegmentId) return null;
    return msg.parsed.segments.find((s) => s.id === this.selectedSegmentId) ?? null;
  }

  get segmentCounts() {
    return this.currentMessage ? segmentTypeCounts(this.currentMessage) : [];
  }

  get messageTypeLabel(): string {
    const msg = this.currentMessage;
    if (!msg) return '';
    const p = msg.parsed;
    if (p.messageType && p.triggerEvent) return `${p.messageType}^${p.triggerEvent}`;
    return p.messageType || 'Unknown';
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
    if (!looksLikeHl7Text(text)) return;
    const file = fileFromPastedText(text, 'pasted-message.hl7', 'text/plain');
    if (!file) return;
    event.preventDefault();
    await this.handleFiles([file]);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentMessage || this.isTypingTarget(event.target)) return;

    if (event.key === '/' && !this.isTypingTarget(event.target)) {
      event.preventDefault();
      this.segmentSearchInput?.nativeElement?.focus();
    } else if (event.key === 'Escape') {
      if (this.selectedSegmentId) {
        event.preventDefault();
        this.selectedSegmentId = null;
        this.cdr.markForCheck();
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveSegmentSelection(event.key === 'ArrowDown' ? 1 : -1);
    }
  }

  trackByMessageId(_index: number, msg: Hl7LoadedMessage): string {
    return msg.id;
  }

  trackBySegmentId(_index: number, seg: Hl7Segment): string {
    return seg.id;
  }

  trackByFieldIndex(_index: number, field: { index: number }): number {
    return field.index;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatHl7FileSize(bytes);
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
    const { accepted, rejected } = filterValidHl7Files(files);
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const loaded: Hl7LoadedMessage[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readHl7FileBytes(file);
          loaded.push(createHl7MessageRecord(file, bytes));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid HL7 message';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = [...this.messages, ...loaded];
        const byId = new Map<string, Hl7LoadedMessage>();
        for (const item of merged) byId.set(item.id, item);
        this.messages = Array.from(byId.values());
        this.currentIndex = Math.min(
          Math.max(0, this.messages.length - loaded.length),
          this.messages.length - 1
        );
        this.resetSelection();
        const current = this.currentMessage;
        if (current) {
          this.toast.success(`Loaded ${current.name}`);
          if (current.warnings.length) {
            this.toast.info(`${current.warnings.length} note(s) about this message`);
          }
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load HL7 message';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleHl7File()]);
  }

  selectMessage(index: number): void {
    if (index < 0 || index >= this.messages.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetSelection();
    this.cdr.markForCheck();
  }

  removeMessage(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.messages.length) return;
    const next = this.messages.filter((_, i) => i !== index);
    this.messages = next;
    if (!next.length) {
      this.clearAll();
      return;
    }
    if (this.currentIndex >= next.length) this.currentIndex = next.length - 1;
    else if (index < this.currentIndex) this.currentIndex -= 1;
    this.resetSelection();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.messages = [];
    this.currentIndex = -1;
    this.errorMessage = '';
    this.resetSelection();
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

  selectSegment(segment: Hl7Segment): void {
    this.selectedSegmentId = segment.id;
    this.cdr.markForCheck();
  }

  filterBySegmentType(type: string): void {
    this.segmentQuery = type;
    this.cdr.markForCheck();
  }

  clearSegmentFilter(): void {
    this.segmentQuery = '';
    this.cdr.markForCheck();
  }

  toggleRawMessage(): void {
    this.showRawMessage = !this.showRawMessage;
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

  exportAs(format: Hl7ExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentMessage;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.[^.]+$/, '') || 'hl7-message';
    try {
      if (format === 'original') {
        downloadBinaryFile(current.bytes, current.name, 'text/plain');
        this.toast.success('Exported original file');
      } else if (format === 'summary-json') {
        downloadTextFile(exportHl7SummaryJson(current), `${base}-summary.json`, 'application/json');
        this.toast.success('Exported summary JSON');
      } else if (format === 'segments-json') {
        downloadTextFile(exportHl7SegmentsJson(current), `${base}-segments.json`, 'application/json');
        this.toast.success('Exported segments JSON');
      } else if (format === 'formatted-txt') {
        downloadTextFile(formatHl7Message(current.parsed), `${base}-formatted.hl7`, 'text/plain');
        this.toast.success('Exported formatted HL7');
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private resetSelection(): void {
    this.segmentQuery = '';
    this.selectedSegmentId = null;
    this.showRawMessage = false;
  }

  private moveSegmentSelection(delta: number): void {
    const segments = this.filteredSegments;
    if (!segments.length) return;
    const currentIndex = this.selectedSegmentId
      ? segments.findIndex((s) => s.id === this.selectedSegmentId)
      : -1;
    const nextIndex = Math.max(0, Math.min(segments.length - 1, currentIndex + delta));
    this.selectedSegmentId = segments[nextIndex].id;
    this.cdr.markForCheck();
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
