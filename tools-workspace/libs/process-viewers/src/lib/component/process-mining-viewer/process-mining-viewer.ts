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
  PROCESS_MINING_ACCEPT_ATTR,
  PROCESS_MINING_FORMATS_HINT,
  PROCESS_MINING_FORMATS_LABEL,
  PROCESS_MINING_RELATED_TOOLS,
  PROCESS_MINING_SUPPORTED_EXTENSIONS
} from '../../constants/process-mining-viewer.constants';
import type {
  ProcessMiningActivity,
  ProcessMiningDfgEdge,
  ProcessMiningExportFormat,
  ProcessMiningLoadedFile,
  ProcessMiningVariant,
  ProcessMiningViewMode
} from '../../types/process-mining-viewer.types';
import {
  buildProcessMiningActivityMetadata,
  buildProcessMiningDfgMetadata,
  buildProcessMiningMetadataRows,
  buildProcessMiningVariantMetadata,
  canExportProcessMining,
  canvasToPngDataUrl,
  createProcessMiningFileRecord,
  createSampleProcessMiningFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportProcessMiningDfgCsv,
  exportProcessMiningSummaryJson,
  exportProcessMiningVariantsCsv,
  filterProcessMiningActivities,
  filterProcessMiningDfg,
  filterProcessMiningVariants,
  filterValidProcessMiningFiles,
  formatProcessMiningFileSize,
  processMiningFrequencyColor,
  processMiningVariantColor,
  readProcessMiningFileBytes,
  renderProcessMiningActivities,
  renderProcessMiningDfg,
  renderProcessMiningVariants,
  resolveProcessMiningSuggestion
} from '../../utils/process-mining-viewer.utils';

@Component({
  selector: 'lib-process-mining-viewer',
  standalone: true,
  templateUrl: './process-mining-viewer.html',
  styleUrls: ['./process-mining-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcessMiningViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = PROCESS_MINING_ACCEPT_ATTR;
  readonly relatedTools = PROCESS_MINING_RELATED_TOOLS;
  readonly supportedExtensions = PROCESS_MINING_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PROCESS_MINING_FORMATS_LABEL;
  readonly formatsHint = PROCESS_MINING_FORMATS_HINT;
  readonly viewModes: Array<{ id: ProcessMiningViewMode; label: string }> = [
    { id: 'variants', label: 'Variants' },
    { id: 'dfg', label: 'DFG' },
    { id: 'activities', label: 'Activities' },
    { id: 'table', label: 'Table' }
  ];

  files: ProcessMiningLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: ProcessMiningViewMode = 'variants';
  query = '';
  selectedVariantId = '';
  selectedActivityId = '';
  selectedDfgId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): ProcessMiningLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportProcessMining(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildProcessMiningMetadataRows(this.parsed) : [];
  }

  get filteredVariants(): ProcessMiningVariant[] {
    return this.parsed ? filterProcessMiningVariants(this.parsed.variants, this.query) : [];
  }

  get filteredActivities(): ProcessMiningActivity[] {
    return this.parsed ? filterProcessMiningActivities(this.parsed.activities, this.query) : [];
  }

  get filteredDfg(): ProcessMiningDfgEdge[] {
    return this.parsed ? filterProcessMiningDfg(this.parsed.dfg, this.query) : [];
  }

  get selectedVariant(): ProcessMiningVariant | null {
    return this.filteredVariants.find((v) => v.id === this.selectedVariantId) ?? null;
  }

  get selectedActivity(): ProcessMiningActivity | null {
    return this.filteredActivities.find((a) => a.id === this.selectedActivityId) ?? null;
  }

  get selectedDfg(): ProcessMiningDfgEdge | null {
    return this.filteredDfg.find((e) => e.id === this.selectedDfgId) ?? null;
  }

  get variantMetadataRows() {
    return this.selectedVariant ? buildProcessMiningVariantMetadata(this.selectedVariant) : [];
  }

  get activityMetadataRows() {
    return this.selectedActivity ? buildProcessMiningActivityMetadata(this.selectedActivity) : [];
  }

  get dfgMetadataRows() {
    return this.selectedDfg ? buildProcessMiningDfgMetadata(this.selectedDfg) : [];
  }

  get primarySuggestion() {
    const s = resolveProcessMiningSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  frequencyTint(pct: number): string {
    return processMiningFrequencyColor(pct);
  }

  variantTint(index: number): string {
    return processMiningVariantColor(index);
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
      if (this.viewMode === 'activities') this.shiftActivity(1);
      else if (this.viewMode === 'dfg') this.shiftDfg(1);
      else this.shiftVariant(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'activities') this.shiftActivity(-1);
      else if (this.viewMode === 'dfg') this.shiftDfg(-1);
      else this.shiftVariant(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: ProcessMiningLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByVariant(_i: number, variant: ProcessMiningVariant): string {
    return variant.id;
  }

  trackByActivity(_i: number, activity: ProcessMiningActivity): string {
    return activity.id;
  }

  trackByDfg(_i: number, edge: ProcessMiningDfgEdge): string {
    return edge.id;
  }

  formatSize(bytes: number): string {
    return formatProcessMiningFileSize(bytes);
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
    const { accepted, rejected } = filterValidProcessMiningFiles(files);
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
          const bytes = await readProcessMiningFileBytes(file);
          const record = createProcessMiningFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid process mining file'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.errorMessage = '';
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no variants/DFG — metadata may still be available');
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
    await this.handleFiles([createSampleProcessMiningFile()]);
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
    this.selectedVariantId = '';
    this.selectedActivityId = '';
    this.selectedDfgId = '';
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

  selectVariant(id: string): void {
    this.selectedVariantId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectActivity(id: string): void {
    this.selectedActivityId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectDfg(id: string): void {
    this.selectedDfgId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedVariantId && !this.filteredVariants.some((v) => v.id === this.selectedVariantId)) {
      this.selectedVariantId = this.filteredVariants[0]?.id ?? '';
    }
    if (this.selectedActivityId && !this.filteredActivities.some((a) => a.id === this.selectedActivityId)) {
      this.selectedActivityId = this.filteredActivities[0]?.id ?? '';
    }
    if (this.selectedDfgId && !this.filteredDfg.some((e) => e.id === this.selectedDfgId)) {
      this.selectedDfgId = this.filteredDfg[0]?.id ?? '';
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

  setViewMode(mode: ProcessMiningViewMode): void {
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

  exportAs(format: ProcessMiningExportFormat, event: Event): void {
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
      else if (format === 'summary-json') downloadTextFile(exportProcessMiningSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'variants-csv') downloadTextFile(exportProcessMiningVariantsCsv(file.parsed), `${file.name}.variants.csv`, 'text/csv');
      else if (format === 'dfg-csv') downloadTextFile(exportProcessMiningDfgCsv(file.parsed), `${file.name}.dfg.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Variants, DFG, or Activities to export a PNG snapshot');
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

  private shiftVariant(delta: number): void {
    const list = this.filteredVariants;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((v) => v.id === this.selectedVariantId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectVariant(next.id);
  }

  private shiftActivity(delta: number): void {
    const list = this.filteredActivities;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((a) => a.id === this.selectedActivityId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectActivity(next.id);
  }

  private shiftDfg(delta: number): void {
    const list = this.filteredDfg;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedDfgId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectDfg(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedVariantId = this.parsed?.variants[0]?.id ?? '';
    this.selectedActivityId = this.parsed?.activities[0]?.id ?? '';
    this.selectedDfgId = this.parsed?.dfg[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'dfg' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'variants') {
      renderProcessMiningVariants(canvas, this.filteredVariants, this.selectedVariantId || null);
    } else if (this.viewMode === 'activities') {
      renderProcessMiningActivities(canvas, this.filteredActivities, this.selectedActivityId || null);
    } else {
      renderProcessMiningDfg(canvas, this.parsed.activities, this.filteredDfg, this.selectedDfgId || null);
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
