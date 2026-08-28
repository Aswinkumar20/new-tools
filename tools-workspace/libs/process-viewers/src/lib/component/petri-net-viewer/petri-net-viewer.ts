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
  PETRI_NET_ACCEPT_ATTR,
  PETRI_NET_FORMATS_HINT,
  PETRI_NET_FORMATS_LABEL,
  PETRI_NET_RELATED_TOOLS,
  PETRI_NET_SUPPORTED_EXTENSIONS
} from '../../constants/petri-net-viewer.constants';
import type {
  PetriNetExportFormat,
  PetriNetLoadedFile,
  PetriNetPlace,
  PetriNetStep,
  PetriNetTransition,
  PetriNetViewMode
} from '../../types/petri-net-viewer.types';
import {
  buildPetriNetMetadataRows,
  buildPetriNetPlaceMetadata,
  buildPetriNetTransitionMetadata,
  canExportPetriNet,
  canvasToPngDataUrl,
  createPetriNetFileRecord,
  createSamplePetriNetFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  enabledPetriNetIds,
  exportPetriNetMarkingCsv,
  exportPetriNetSummaryJson,
  exportPetriNetTraceCsv,
  filterPetriNetPlaces,
  filterPetriNetTransitions,
  filterValidPetriNetFiles,
  firePetriNetTransition,
  formatPetriNetFileSize,
  formatPetriNetMarking,
  initialPetriNetMarking,
  petriNetPlaceColor,
  petriNetTransitionColor,
  readPetriNetFileBytes,
  renderPetriNetGraph,
  renderPetriNetMarkings,
  renderPetriNetTrace,
  resolvePetriNetSuggestion,
  tokenTotal
} from '../../utils/petri-net-viewer.utils';

@Component({
  selector: 'lib-petri-net-viewer',
  standalone: true,
  templateUrl: './petri-net-viewer.html',
  styleUrls: ['./petri-net-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PetriNetViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = PETRI_NET_ACCEPT_ATTR;
  readonly relatedTools = PETRI_NET_RELATED_TOOLS;
  readonly supportedExtensions = PETRI_NET_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PETRI_NET_FORMATS_LABEL;
  readonly formatsHint = PETRI_NET_FORMATS_HINT;
  readonly viewModes: Array<{ id: PetriNetViewMode; label: string }> = [
    { id: 'graph', label: 'Graph' },
    { id: 'flow', label: 'Token flow' },
    { id: 'tokens', label: 'Tokens' },
    { id: 'table', label: 'Table' }
  ];

  files: PetriNetLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: PetriNetViewMode = 'graph';
  query = '';
  selectedPlaceId = '';
  selectedTransitionId = '';
  selectedStep = 0;
  marking: Record<string, number> = {};
  trace: PetriNetStep[] = [];

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): PetriNetLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportPetriNet(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get enabledIds(): string[] {
    return this.parsed ? enabledPetriNetIds(this.parsed, this.marking) : [];
  }

  get metadataRows() {
    return this.parsed ? buildPetriNetMetadataRows(this.parsed, this.marking, this.enabledIds.length, this.trace.length) : [];
  }

  get filteredPlaces(): PetriNetPlace[] {
    return this.parsed ? filterPetriNetPlaces(this.parsed.places, this.query, this.marking) : [];
  }

  get filteredTransitions(): PetriNetTransition[] {
    return this.parsed ? filterPetriNetTransitions(this.parsed.transitions, this.query, this.enabledIds) : [];
  }

  get selectedPlace(): PetriNetPlace | null {
    return this.filteredPlaces.find((p) => p.id === this.selectedPlaceId) ?? null;
  }

  get selectedTransition(): PetriNetTransition | null {
    return this.filteredTransitions.find((t) => t.id === this.selectedTransitionId) ?? null;
  }

  get placeMetadataRows() {
    if (!this.selectedPlace) return [];
    return buildPetriNetPlaceMetadata(this.selectedPlace, this.marking[this.selectedPlace.id] ?? this.selectedPlace.initialTokens);
  }

  get transitionMetadataRows() {
    if (!this.selectedTransition) return [];
    return buildPetriNetTransitionMetadata(this.selectedTransition, this.enabledIds.includes(this.selectedTransition.id));
  }

  get currentTokenTotal(): number {
    return tokenTotal(this.marking);
  }

  get primarySuggestion() {
    const s = resolvePetriNetSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  placeTint(tokens: number): string {
    return petriNetPlaceColor(tokens);
  }

  transitionTint(enabled: boolean): string {
    return petriNetTransitionColor(enabled);
  }

  tokensFor(place: PetriNetPlace): number {
    return this.marking[place.id] ?? place.initialTokens;
  }

  isEnabled(id: string): boolean {
    return this.enabledIds.includes(id);
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
      if (this.viewMode === 'flow') this.shiftStep(1);
      else if (this.viewMode === 'tokens' || this.viewMode === 'table') this.shiftPlace(1);
      else this.shiftTransition(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'flow') this.shiftStep(-1);
      else if (this.viewMode === 'tokens' || this.viewMode === 'table') this.shiftPlace(-1);
      else this.shiftTransition(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: PetriNetLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByPlace(_i: number, place: PetriNetPlace): string {
    return place.id;
  }

  trackByTransition(_i: number, transition: PetriNetTransition): string {
    return transition.id;
  }

  trackByStep(_i: number, step: PetriNetStep): number {
    return step.step;
  }

  formatSize(bytes: number): string {
    return formatPetriNetFileSize(bytes);
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
    const { accepted, rejected } = filterValidPetriNetFiles(files);
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
          const bytes = await readPetriNetFileBytes(file);
          const record = createPetriNetFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Petri net'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.errorMessage = '';
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no places/transitions — metadata may still be available');
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
    await this.handleFiles([createSamplePetriNetFile()]);
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
    this.selectedPlaceId = '';
    this.selectedTransitionId = '';
    this.selectedStep = 0;
    this.marking = {};
    this.trace = [];
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
  // Selection / filter / simulation
  // ---------------------------------------------------------------------------

  selectPlace(id: string): void {
    this.selectedPlaceId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectTransition(id: string): void {
    this.selectedTransitionId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectStep(step: number): void {
    this.selectedStep = step;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fireStep(): void {
    if (!this.parsed) return;
    const id =
      (this.selectedTransitionId && this.enabledIds.includes(this.selectedTransitionId) && this.selectedTransitionId) ||
      this.enabledIds[0];
    if (!id) {
      this.toast.info('No enabled transition to fire');
      return;
    }
    const result = firePetriNetTransition(this.parsed, this.marking, id);
    if (!result.ok) {
      this.toast.info(result.reason || 'Cannot fire transition');
      return;
    }
    const transition = this.parsed.transitions.find((t) => t.id === id);
    this.marking = result.marking;
    this.trace = [
      ...this.trace,
      {
        step: this.trace.length + 1,
        transitionId: id,
        transitionName: transition?.name || id,
        marking: formatPetriNetMarking(this.parsed, result.marking)
      }
    ];
    this.selectedStep = this.trace.length;
    this.selectedTransitionId = enabledPetriNetIds(this.parsed, this.marking)[0] || id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetSimulation(): void {
    if (!this.parsed) return;
    this.marking = initialPetriNetMarking(this.parsed);
    this.trace = [];
    this.selectedStep = 0;
    this.selectedTransitionId = enabledPetriNetIds(this.parsed, this.marking)[0] || this.parsed.transitions[0]?.id || '';
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedPlaceId && !this.filteredPlaces.some((p) => p.id === this.selectedPlaceId)) {
      this.selectedPlaceId = this.filteredPlaces[0]?.id ?? '';
    }
    if (this.selectedTransitionId && !this.filteredTransitions.some((t) => t.id === this.selectedTransitionId)) {
      this.selectedTransitionId = this.filteredTransitions[0]?.id ?? '';
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

  setViewMode(mode: PetriNetViewMode): void {
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

  exportAs(format: PetriNetExportFormat, event: Event): void {
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
      else if (format === 'summary-json') {
        downloadTextFile(exportPetriNetSummaryJson(file, this.marking, this.trace), `${file.name}.summary.json`, 'application/json');
      } else if (format === 'marking-csv') {
        downloadTextFile(exportPetriNetMarkingCsv(file.parsed, this.marking), `${file.name}.marking.csv`, 'text/csv');
      } else if (format === 'trace-csv') {
        downloadTextFile(exportPetriNetTraceCsv(this.trace), `${file.name}.trace.csv`, 'text/csv');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Graph, Token flow, or Tokens to export a PNG snapshot');
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

  private shiftPlace(delta: number): void {
    const list = this.filteredPlaces;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((p) => p.id === this.selectedPlaceId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPlace(next.id);
  }

  private shiftTransition(delta: number): void {
    const list = this.filteredTransitions;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((t) => t.id === this.selectedTransitionId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectTransition(next.id);
  }

  private shiftStep(delta: number): void {
    if (!this.trace.length) return;
    const idx = Math.max(0, this.trace.findIndex((s) => s.step === this.selectedStep));
    const next = this.trace[Math.min(this.trace.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectStep(next.step);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.marking = this.parsed ? initialPetriNetMarking(this.parsed) : {};
    this.trace = [];
    this.selectedStep = 0;
    this.selectedPlaceId = this.parsed?.places[0]?.id ?? '';
    this.selectedTransitionId = this.parsed ? enabledPetriNetIds(this.parsed, this.marking)[0] || this.parsed.transitions[0]?.id || '' : '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'graph' ? 320 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'graph') {
      renderPetriNetGraph(
        canvas,
        this.parsed.places,
        this.parsed.transitions,
        this.parsed.arcs,
        this.marking,
        this.enabledIds,
        this.selectedTransitionId || this.selectedPlaceId || null
      );
    } else if (this.viewMode === 'flow') {
      renderPetriNetTrace(canvas, this.trace, this.selectedStep || null);
    } else {
      renderPetriNetMarkings(canvas, this.filteredPlaces, this.marking, this.selectedPlaceId || null);
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
