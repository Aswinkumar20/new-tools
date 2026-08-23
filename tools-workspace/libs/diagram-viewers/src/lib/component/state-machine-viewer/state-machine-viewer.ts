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
import { AssetService, Navigation, StatValueTooltipHostDirective, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import { buildDiagramInsightStats } from '../../utils/diagram-file.utils';
import {
  SM_ACCEPT_ATTR,
  SM_FORMATS_HINT,
  SM_FORMATS_LABEL,
  SM_RELATED_TOOLS,
  SM_SUPPORTED_EXTENSIONS
} from '../../constants/state-machine-viewer.constants';
import type { SmExportFormat, SmLoadedFile, SmState, SmTransition, SmViewMode } from '../../types/state-machine-viewer.types';
import {
  buildSmMetadataRows,
  buildSmStateMetadata,
  buildSmTransitionMetadata,
  canExportSm,
  canvasToPngDataUrl,
  createSmFileRecord,
  createSampleSmFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportSmStatesCsv,
  exportSmSummaryJson,
  exportSmTransitionsCsv,
  filterSmStates,
  filterSmTransitions,
  filterValidSmFiles,
  formatSmFileSize,
  smStateColor,
  readSmFileBytes,
  renderSmDiagram,
  renderSmStates,
  renderSmTransitions,
  resolveSmSuggestion
} from '../../utils/state-machine-viewer.utils';

@Component({
  selector: 'lib-state-machine-viewer',
  standalone: true,
  templateUrl: './state-machine-viewer.html',
  styleUrls: ['./state-machine-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StateMachineViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = SM_ACCEPT_ATTR;
  readonly relatedTools = SM_RELATED_TOOLS;
  readonly supportedExtensions = SM_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = SM_FORMATS_LABEL;
  readonly formatsHint = SM_FORMATS_HINT;
  readonly viewModes: Array<{ id: SmViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'states', label: 'States' },
    { id: 'transitions', label: 'Transitions' },
    { id: 'table', label: 'Table' }
  ];

  files: SmLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: SmViewMode = 'diagram';
  query = '';
  selectedStateId = '';
  selectedTransitionId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): SmLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportSm(this.currentFile);
  }

  get insights() {
    return buildDiagramInsightStats(
      this.parsed as Record<string, unknown> | null,
      this.files.length,
      this.currentFile?.size ?? null,
      this.warnings,
      (n) => this.formatSize(n)
    );
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get selectedState(): SmState | null {
    return this.parsed?.states.find((n) => n.id === this.selectedStateId) ?? null;
  }

  get selectedTransition(): SmTransition | null {
    return this.parsed?.transitions.find((t) => t.id === this.selectedTransitionId) ?? null;
  }

  get filteredStates(): SmState[] {
    return this.parsed ? filterSmStates(this.parsed.states, this.query) : [];
  }

  get filteredTransitions(): SmTransition[] {
    return this.parsed ? filterSmTransitions(this.parsed.transitions, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildSmMetadataRows(this.parsed) : [];
  }

  get stateMetadataRows() {
    return this.selectedState ? buildSmStateMetadata(this.selectedState) : [];
  }

  get transitionMetadataRows() {
    return this.selectedTransition ? buildSmTransitionMetadata(this.selectedTransition) : [];
  }

  get primarySuggestion() {
    const s = resolveSmSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(kind: string, index: number): string {
    return smStateColor(kind, index);
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
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

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    if (!this.parsed) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'transitions' || this.viewMode === 'table') this.shiftTransition(1);
      else this.shiftState(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'transitions' || this.viewMode === 'table') this.shiftTransition(-1);
      else this.shiftState(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: SmLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByState(_i: number, node: SmState): string {
    return node.id;
  }

  trackByTransition(_i: number, triple: SmTransition): string {
    return triple.id;
  }

  formatSize(bytes: number): string {
    return formatSmFileSize(bytes);
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
    const { accepted, rejected } = filterValidSmFiles(files);
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
          const bytes = await readSmFileBytes(file);
          const record = createSmFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid state machine'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.warnings.length) this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleSmFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectState(id: string): void {
    this.selectedStateId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectTransition(id: string): void {
    this.selectedTransitionId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const node = this.filteredStates[0];
    if (node && !this.filteredStates.some((n) => n.id === this.selectedStateId)) this.selectedStateId = node.id;
    const triple = this.filteredTransitions[0];
    if (triple && !this.filteredTransitions.some((t) => t.id === this.selectedTransitionId)) this.selectedTransitionId = triple.id;
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
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedStateId = '';
    this.selectedTransitionId = '';
    this.errorMessage = '';
    this.query = '';
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setViewMode(mode: SmViewMode): void {
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
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: SmExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportSmSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'transitions-csv') downloadTextFile(exportSmTransitionsCsv(file.parsed), `${file.name}.transitions.csv`, 'text/csv');
      else if (format === 'states-csv') downloadTextFile(exportSmStatesCsv(file.parsed), `${file.name}.states.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, States, or Transitions to export a PNG snapshot');
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (url) downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private shiftState(delta: number): void {
    const list = this.filteredStates;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedStateId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectState(next.id);
  }

  private shiftTransition(delta: number): void {
    const list = this.filteredTransitions;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((t) => t.id === this.selectedTransitionId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectTransition(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedStateId = this.parsed?.states[0]?.id ?? '';
    this.selectedTransitionId = this.parsed?.transitions[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'diagram' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'diagram') {
      renderSmDiagram(canvas, this.parsed.states, this.parsed.transitions, this.selectedStateId || null);
    } else if (this.viewMode === 'states') {
      renderSmStates(canvas, this.filteredStates, this.selectedStateId || null);
    } else renderSmTransitions(canvas, this.filteredTransitions, this.selectedTransitionId || null);
  }

  private clearCanvas(): void {
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
