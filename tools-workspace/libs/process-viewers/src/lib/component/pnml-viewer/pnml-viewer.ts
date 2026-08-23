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
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import {
  PNML_ACCEPT_ATTR,
  PNML_FORMATS_HINT,
  PNML_FORMATS_LABEL,
  PNML_RELATED_TOOLS,
  PNML_SUPPORTED_EXTENSIONS
} from '../../constants/pnml-viewer.constants';
import type {
  PnmlExportFormat,
  PnmlLoadedFile,
  PnmlPlace,
  PnmlTokenMarking,
  PnmlTransition,
  PnmlViewMode
} from '../../types/pnml-viewer.types';
import {
  buildPnmlMetadataRows,
  buildPnmlPlaceMetadata,
  buildPnmlTokenMetadata,
  buildPnmlTransitionMetadata,
  canExportPnml,
  canvasToPngDataUrl,
  createPnmlFileRecord,
  createSamplePnmlFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportPnmlArcsCsv,
  exportPnmlPlacesCsv,
  exportPnmlSummaryJson,
  filterPnmlPlaces,
  filterPnmlTokens,
  filterPnmlTransitions,
  filterValidPnmlFiles,
  formatPnmlFileSize,
  pnmlPlaceColor,
  pnmlTransitionColor,
  readPnmlFileBytes,
  renderPnmlMarkings,
  renderPnmlNet,
  renderPnmlTransitions,
  resolvePnmlSuggestion
} from '../../utils/pnml-viewer.utils';

@Component({
  selector: 'lib-pnml-viewer',
  standalone: true,
  templateUrl: './pnml-viewer.html',
  styleUrls: ['./pnml-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PnmlViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = PNML_ACCEPT_ATTR;
  readonly relatedTools = PNML_RELATED_TOOLS;
  readonly supportedExtensions = PNML_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PNML_FORMATS_LABEL;
  readonly formatsHint = PNML_FORMATS_HINT;
  readonly viewModes: Array<{ id: PnmlViewMode; label: string }> = [
    { id: 'places', label: 'Places' },
    { id: 'transitions', label: 'Transitions' },
    { id: 'tokens', label: 'Tokens' },
    { id: 'table', label: 'Table' }
  ];

  files: PnmlLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: PnmlViewMode = 'places';
  query = '';
  selectedPlaceId = '';
  selectedTransitionId = '';
  selectedTokenId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): PnmlLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportPnml(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildPnmlMetadataRows(this.parsed) : [];
  }

  get filteredPlaces(): PnmlPlace[] {
    return this.parsed ? filterPnmlPlaces(this.parsed.places, this.query) : [];
  }

  get filteredTransitions(): PnmlTransition[] {
    return this.parsed ? filterPnmlTransitions(this.parsed.transitions, this.query) : [];
  }

  get filteredTokens(): PnmlTokenMarking[] {
    return this.parsed ? filterPnmlTokens(this.parsed.tokens, this.query) : [];
  }

  get selectedPlace(): PnmlPlace | null {
    return this.filteredPlaces.find((p) => p.id === this.selectedPlaceId) ?? this.filteredPlaces[0] ?? null;
  }

  get selectedTransition(): PnmlTransition | null {
    return this.filteredTransitions.find((t) => t.id === this.selectedTransitionId) ?? this.filteredTransitions[0] ?? null;
  }

  get selectedToken(): PnmlTokenMarking | null {
    return this.filteredTokens.find((t) => t.id === this.selectedTokenId) ?? this.filteredTokens[0] ?? null;
  }

  get placeMetadataRows() {
    return this.selectedPlace ? buildPnmlPlaceMetadata(this.selectedPlace) : [];
  }

  get transitionMetadataRows() {
    return this.selectedTransition ? buildPnmlTransitionMetadata(this.selectedTransition) : [];
  }

  get tokenMetadataRows() {
    return this.selectedToken ? buildPnmlTokenMetadata(this.selectedToken) : [];
  }

  get primarySuggestion() {
    const s = resolvePnmlSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  placeTint(tokens: number): string {
    return pnmlPlaceColor(tokens);
  }

  transitionTint(enabled: boolean): string {
    return pnmlTransitionColor(enabled);
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
      if (this.viewMode === 'places') this.shiftPlace(1);
      else if (this.viewMode === 'transitions') this.shiftTransition(1);
      else this.shiftToken(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'places') this.shiftPlace(-1);
      else if (this.viewMode === 'transitions') this.shiftTransition(-1);
      else this.shiftToken(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: PnmlLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByPlace(_i: number, place: PnmlPlace): string {
    return place.id;
  }

  trackByTransition(_i: number, transition: PnmlTransition): string {
    return transition.id;
  }

  trackByToken(_i: number, token: PnmlTokenMarking): string {
    return token.id;
  }

  formatSize(bytes: number): string {
    return formatPnmlFileSize(bytes);
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
    const { accepted, rejected } = filterValidPnmlFiles(files);
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
          const bytes = await readPnmlFileBytes(file);
          const record = createPnmlFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid PNML net'}`;
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
    await this.handleFiles([createSamplePnmlFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectPlace(id: string): void {
    this.selectedPlaceId = id;
    const token = this.filteredTokens.find((t) => t.placeId === id);
    if (token) this.selectedTokenId = token.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectTransition(id: string): void {
    this.selectedTransitionId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectToken(id: string): void {
    this.selectedTokenId = id;
    const token = this.filteredTokens.find((t) => t.id === id);
    if (token) this.selectedPlaceId = token.placeId;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const place = this.filteredPlaces[0];
    if (place && !this.filteredPlaces.some((p) => p.id === this.selectedPlaceId)) this.selectedPlaceId = place.id;
    const trans = this.filteredTransitions[0];
    if (trans && !this.filteredTransitions.some((t) => t.id === this.selectedTransitionId)) this.selectedTransitionId = trans.id;
    const token = this.filteredTokens[0];
    if (token && !this.filteredTokens.some((t) => t.id === this.selectedTokenId)) this.selectedTokenId = token.id;
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
    this.selectedPlaceId = '';
    this.selectedTransitionId = '';
    this.selectedTokenId = '';
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

  setViewMode(mode: PnmlViewMode): void {
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

  exportAs(format: PnmlExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportPnmlSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'places-csv') downloadTextFile(exportPnmlPlacesCsv(file.parsed), `${file.name}.places.csv`, 'text/csv');
      else if (format === 'arcs-csv') downloadTextFile(exportPnmlArcsCsv(file.parsed), `${file.name}.arcs.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Places, Transitions, or Tokens to export a PNG snapshot');
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

  private shiftToken(delta: number): void {
    const list = this.filteredTokens;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((t) => t.id === this.selectedTokenId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectToken(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedPlaceId = this.parsed?.places[0]?.id ?? '';
    this.selectedTransitionId = this.parsed?.transitions[0]?.id ?? '';
    this.selectedTokenId = this.parsed?.tokens[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'places' ? 320 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'places') {
      renderPnmlNet(canvas, this.parsed.places, this.parsed.transitions, this.parsed.arcs, this.selectedPlace?.id ?? null);
    } else if (this.viewMode === 'transitions') {
      renderPnmlTransitions(canvas, this.filteredTransitions, this.selectedTransition?.id ?? null);
    } else {
      renderPnmlMarkings(canvas, this.filteredTokens, this.selectedToken?.placeId ?? null);
    }
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
