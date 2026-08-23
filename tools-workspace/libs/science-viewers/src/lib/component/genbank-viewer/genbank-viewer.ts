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
  GENBANK_ACCEPT_ATTR,
  GENBANK_FORMATS_HINT,
  GENBANK_FORMATS_LABEL,
  GENBANK_RELATED_TOOLS,
  GENBANK_SUPPORTED_EXTENSIONS
} from '../../constants/genbank-viewer.constants';
import type {
  GenbankExportFormat,
  GenbankFeature,
  GenbankLoadedFile,
  GenbankRecord,
  GenbankViewMode,
  GenbankWrap
} from '../../types/genbank-viewer.types';
import type { SequenceWrapLine } from '../../types/sequence.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildFeatureMetadata,
  buildGenbankFileMetadata,
  buildGenbankRecordMetadata,
  canExportGenbank,
  createGenbankFileRecord,
  createSampleGenbankFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportGenbankFeatureFasta,
  exportGenbankFeaturesCsv,
  exportGenbankSummaryJson,
  extractFeatureSequence,
  featureColor,
  featureTranslation,
  filterGenbankFeatures,
  filterValidGenbankFiles,
  formatGenbankFileSize,
  readGenbankFileBytes,
  renderGenbankFeatureMap,
  residueColor,
  resolveGenbankSuggestion,
  wrapSequence
} from '../../utils/genbank-viewer.utils';

@Component({
  selector: 'lib-genbank-viewer',
  standalone: true,
  templateUrl: './genbank-viewer.html',
  styleUrls: ['./genbank-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GenbankViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = GENBANK_ACCEPT_ATTR;
  readonly relatedTools = GENBANK_RELATED_TOOLS;
  readonly supportedExtensions = GENBANK_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = GENBANK_FORMATS_LABEL;
  readonly formatsHint = GENBANK_FORMATS_HINT;
  readonly wraps: GenbankWrap[] = [60, 80, 100, 0];
  readonly viewModes: Array<{ id: GenbankViewMode; label: string }> = [
    { id: 'map', label: 'Feature map' },
    { id: 'features', label: 'Features' },
    { id: 'sequence', label: 'Sequence' }
  ];

  files: GenbankLoadedFile[] = [];
  currentIndex = -1;
  recordIndex = 0;
  selectedFeatureIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: GenbankViewMode = 'map';
  wrap: GenbankWrap = 60;
  colorize = true;
  query = '';
  typeFilter: string | null = null;
  jumpPos = '';
  showTranslation = false;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): GenbankLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportGenbank(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get records(): GenbankRecord[] {
    return this.parsed?.records ?? [];
  }

  get record(): GenbankRecord | null {
    return this.records[this.recordIndex] ?? this.records[0] ?? null;
  }

  get fileMetadataRows() {
    return this.parsed ? buildGenbankFileMetadata(this.parsed) : [];
  }

  get recordMetadataRows() {
    return this.record ? buildGenbankRecordMetadata(this.record) : [];
  }

  get visibleFeatures(): GenbankFeature[] {
    if (!this.record) return [];
    return filterGenbankFeatures(this.record.features, this.query, this.typeFilter);
  }

  get selectedFeature(): GenbankFeature | null {
    return this.visibleFeatures[this.selectedFeatureIndex] ?? this.visibleFeatures[0] ?? null;
  }

  get featureMetadataRows() {
    return this.selectedFeature ? buildFeatureMetadata(this.selectedFeature) : [];
  }

  get wrappedLines(): SequenceWrapLine[] {
    const seq = this.displaySequence;
    const maxChars = this.colorize ? 12_000 : 80_000;
    return wrapSequence(seq.length > maxChars ? seq.slice(0, maxChars) : seq, this.wrap);
  }

  get displaySequence(): string {
    if (!this.record) return '';
    if (this.selectedFeature) {
      const featSeq = extractFeatureSequence(this.record, this.selectedFeature);
      if (featSeq) return featSeq;
    }
    return this.record.sequence;
  }

  get translation(): string {
    if (!this.record || !this.selectedFeature) return '';
    return featureTranslation(this.record, this.selectedFeature);
  }

  get primarySuggestion() {
    const s = resolveGenbankSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
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
    if (!this.currentFile) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectFeature(Math.min(this.visibleFeatures.length - 1, this.selectedFeatureIndex + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectFeature(Math.max(0, this.selectedFeatureIndex - 1));
    } else if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      this.showTranslation = !this.showTranslation;
      this.cdr.markForCheck();
    }
  }

  trackByFileId(_i: number, file: GenbankLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByRecord(_i: number, record: GenbankRecord): string {
    return `${record.index}:${record.locus}`;
  }

  trackByFeature(_i: number, feature: GenbankFeature): string {
    return `${feature.index}:${feature.type}:${feature.location}`;
  }

  trackByLine(_i: number, line: SequenceWrapLine): number {
    return line.start;
  }

  trackByChar(index: number, ch: string): string {
    return `${index}:${ch}`;
  }

  featureStyle(type: string): Record<string, string> {
    return { background: featureColor(type) };
  }

  residueStyle(ch: string): Record<string, string> {
    if (!this.colorize) return {};
    return { color: residueColor(ch, 'dna') };
  }

  lineHighlighted(line: SequenceWrapLine): boolean {
    const pos = Number(this.jumpPos);
    if (!Number.isFinite(pos) || pos < 1) return false;
    return pos >= line.start && pos <= line.start + line.text.length - 1;
  }

  formatSize(bytes: number): string {
    return formatGenbankFileSize(bytes);
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
    const { accepted, rejected } = filterValidGenbankFiles(files);
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
          const bytes = await readGenbankFileBytes(file);
          const record = createGenbankFileRecord(file, bytes);
          const existing = this.files.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.files[existing] = record;
            this.currentIndex = existing;
          } else {
            this.files = [...this.files, record];
            this.currentIndex = this.files.length - 1;
          }
          this.recordIndex = 0;
          this.selectedFeatureIndex = 0;
          this.typeFilter = null;
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid GenBank'}`;
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
    await this.handleFiles([createSampleGenbankFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.recordIndex = 0;
    this.selectedFeatureIndex = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRecord(index: number): void {
    this.recordIndex = index;
    this.selectedFeatureIndex = 0;
    this.typeFilter = null;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectFeature(index: number): void {
    if (index < 0 || index >= this.visibleFeatures.length) return;
    this.selectedFeatureIndex = index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setTypeFilter(type: string | null): void {
    this.typeFilter = type;
    this.selectedFeatureIndex = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onQueryChange(): void {
    this.selectedFeatureIndex = 0;
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
    this.recordIndex = 0;
    this.renderCanvas();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.recordIndex = 0;
    this.selectedFeatureIndex = 0;
    this.errorMessage = '';
    this.query = '';
    this.typeFilter = null;
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

  setViewMode(mode: GenbankViewMode): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  setWrap(wrap: GenbankWrap): void {
    this.wrap = wrap;
    this.cdr.markForCheck();
  }

  toggleColor(): void {
    this.colorize = !this.colorize;
    this.cdr.markForCheck();
  }

  toggleTranslation(): void {
    this.showTranslation = !this.showTranslation;
    this.cdr.markForCheck();
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

  exportAs(format: GenbankExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    const record = this.record;
    if (!file?.parsed || !record) return;
    try {
      if (format === 'original') downloadBinaryFile(new TextEncoder().encode(file.text), file.name, 'text/plain');
      else if (format === 'summary-json') downloadTextFile(exportGenbankSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'features-csv') downloadTextFile(exportGenbankFeaturesCsv(record), `${record.locus}.features.csv`, 'text/csv');
      else if (format === 'selected-fasta' && this.selectedFeature) {
        downloadTextFile(exportGenbankFeatureFasta(record, this.selectedFeature), `${record.locus}-${this.selectedFeature.type}.fasta`, 'text/plain');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas) {
          this.toast.info('Open Feature map to export a PNG snapshot');
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (url) downloadDataUrl(url, `${record.locus}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode !== 'map') return;
    const canvas = this.canvasHost?.nativeElement;
    const record = this.record;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(220, parent.clientHeight);
    }
    if (!record) {
      this.clearCanvas();
      return;
    }
    renderGenbankFeatureMap(canvas, record, this.selectedFeature?.index ?? null);
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
