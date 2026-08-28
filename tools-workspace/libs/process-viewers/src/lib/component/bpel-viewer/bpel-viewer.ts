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
  BPEL_ACCEPT_ATTR,
  BPEL_FORMATS_HINT,
  BPEL_FORMATS_LABEL,
  BPEL_RELATED_TOOLS,
  BPEL_SUPPORTED_EXTENSIONS
} from '../../constants/bpel-viewer.constants';
import type { BpelActivity, BpelExportFormat, BpelLoadedFile, BpelPartner, BpelViewMode } from '../../types/bpel-viewer.types';
import {
  bpelKindColor,
  buildBpelActivityMetadata,
  buildBpelMetadataRows,
  buildBpelPartnerMetadata,
  canExportBpel,
  canvasToPngDataUrl,
  createBpelFileRecord,
  createSampleBpelFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportBpelActivitiesCsv,
  exportBpelPartnersCsv,
  exportBpelSummaryJson,
  filterBpelActivities,
  filterBpelPartners,
  filterValidBpelFiles,
  formatBpelFileSize,
  readBpelFileBytes,
  renderBpelKinds,
  renderBpelOrchestration,
  renderBpelPartners,
  resolveBpelSuggestion
} from '../../utils/bpel-viewer.utils';

@Component({
  selector: 'lib-bpel-viewer',
  standalone: true,
  templateUrl: './bpel-viewer.html',
  styleUrls: ['./bpel-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BpelViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = BPEL_ACCEPT_ATTR;
  readonly relatedTools = BPEL_RELATED_TOOLS;
  readonly supportedExtensions = BPEL_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = BPEL_FORMATS_LABEL;
  readonly formatsHint = BPEL_FORMATS_HINT;
  readonly viewModes: Array<{ id: BpelViewMode; label: string }> = [
    { id: 'orchestration', label: 'Orchestration' },
    { id: 'partners', label: 'Partners' },
    { id: 'activities', label: 'Activities' },
    { id: 'table', label: 'Table' }
  ];

  files: BpelLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: BpelViewMode = 'orchestration';
  query = '';
  selectedActivityId = '';
  selectedPartnerId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): BpelLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportBpel(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildBpelMetadataRows(this.parsed) : [];
  }

  get filteredActivities(): BpelActivity[] {
    return this.parsed ? filterBpelActivities(this.parsed.activities, this.query) : [];
  }

  get filteredPartners(): BpelPartner[] {
    return this.parsed ? filterBpelPartners(this.parsed.partners, this.query) : [];
  }

  get selectedActivity(): BpelActivity | null {
    return this.filteredActivities.find((a) => a.id === this.selectedActivityId) ?? null;
  }

  get selectedPartner(): BpelPartner | null {
    return this.filteredPartners.find((p) => p.id === this.selectedPartnerId) ?? null;
  }

  get activityMetadataRows() {
    return this.selectedActivity ? buildBpelActivityMetadata(this.selectedActivity) : [];
  }

  get partnerMetadataRows() {
    return this.selectedPartner ? buildBpelPartnerMetadata(this.selectedPartner) : [];
  }

  get primarySuggestion() {
    const s = resolveBpelSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  kindTint(kind: string): string {
    return bpelKindColor(kind);
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
      if (this.viewMode === 'partners') this.shiftPartner(1);
      else this.shiftActivity(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'partners') this.shiftPartner(-1);
      else this.shiftActivity(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: BpelLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByActivity(_i: number, activity: BpelActivity): string {
    return activity.id;
  }

  trackByPartner(_i: number, partner: BpelPartner): string {
    return partner.id;
  }

  formatSize(bytes: number): string {
    return formatBpelFileSize(bytes);
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
    const { accepted, rejected } = filterValidBpelFiles(files);
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
          const bytes = await readBpelFileBytes(file);
          const record = createBpelFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid BPEL process'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no activities — metadata may still be available');
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
    await this.handleFiles([createSampleBpelFile()]);
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
    this.selectedActivityId = '';
    this.selectedPartnerId = '';
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

  selectActivity(id: string): void {
    this.selectedActivityId = id;
    const activity = this.filteredActivities.find((a) => a.id === id);
    if (activity?.partner) {
      const partner = this.filteredPartners.find((p) => p.name === activity.partner || p.id === activity.partner);
      if (partner) this.selectedPartnerId = partner.id;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectPartner(id: string): void {
    this.selectedPartnerId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedActivityId && !this.filteredActivities.some((a) => a.id === this.selectedActivityId)) {
      this.selectedActivityId = this.filteredActivities[0]?.id ?? '';
    }
    if (this.selectedPartnerId && !this.filteredPartners.some((p) => p.id === this.selectedPartnerId)) {
      this.selectedPartnerId = this.filteredPartners[0]?.id ?? '';
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

  setViewMode(mode: BpelViewMode): void {
    if (this.viewMode === mode) return;
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
    if (!this.canExport) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: BpelExportFormat, event: Event): void {
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
      else if (format === 'summary-json') downloadTextFile(exportBpelSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'activities-csv') downloadTextFile(exportBpelActivitiesCsv(file.parsed), `${file.name}.activities.csv`, 'text/csv');
      else if (format === 'partners-csv') downloadTextFile(exportBpelPartnersCsv(file.parsed), `${file.name}.partners.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Orchestration, Partners, or Activities to export a PNG snapshot');
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

  private shiftActivity(delta: number): void {
    const list = this.filteredActivities;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((a) => a.id === this.selectedActivityId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectActivity(next.id);
  }

  private shiftPartner(delta: number): void {
    const list = this.filteredPartners;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((p) => p.id === this.selectedPartnerId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPartner(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedActivityId = this.parsed?.activities[0]?.id ?? '';
    this.selectedPartnerId = this.parsed?.partners[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'orchestration' ? 320 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'orchestration') {
      renderBpelOrchestration(canvas, this.filteredActivities, this.selectedActivity?.id ?? null);
    } else if (this.viewMode === 'partners') {
      renderBpelPartners(canvas, this.filteredPartners, this.selectedPartner?.id ?? null);
    } else {
      renderBpelKinds(canvas, this.parsed.kinds, this.selectedActivity?.kind ?? null);
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
