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
  VCF_ACCEPT_ATTR,
  VCF_FORMATS_HINT,
  VCF_FORMATS_LABEL,
  VCF_RELATED_TOOLS,
  VCF_SUPPORTED_EXTENSIONS
} from '../../constants/vcf-variant-viewer.constants';
import type {
  VcfExportFormat,
  VcfLoadedFile,
  VcfVariant,
  VcfVariantType,
  VcfViewMode
} from '../../types/vcf-variant-viewer.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildVariantMetadata,
  buildVcfMetadataRows,
  canExportVcf,
  createSampleVcfFile,
  createVcfFileRecord,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportFilteredVcf,
  exportVcfSummaryJson,
  exportVcfVariantsCsv,
  filterValidVcfFiles,
  filterVcfVariants,
  formatVcfFileSize,
  readVcfFileBytes,
  renderVcfChromChart,
  resolveVcfSuggestion,
  variantTypeColor
} from '../../utils/vcf-variant-viewer.utils';

@Component({
  selector: 'lib-vcf-variant-viewer',
  standalone: true,
  templateUrl: './vcf-variant-viewer.html',
  styleUrls: ['./vcf-variant-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VcfVariantViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = VCF_ACCEPT_ATTR;
  readonly relatedTools = VCF_RELATED_TOOLS;
  readonly supportedExtensions = VCF_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = VCF_FORMATS_LABEL;
  readonly formatsHint = VCF_FORMATS_HINT;
  readonly types: VcfVariantType[] = ['snp', 'indel', 'mnv', 'other'];
  readonly viewModes: Array<{ id: VcfViewMode; label: string }> = [
    { id: 'table', label: 'Variants' },
    { id: 'chromosomes', label: 'Chromosomes' }
  ];

  files: VcfLoadedFile[] = [];
  currentIndex = -1;
  selectedVariantIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: VcfViewMode = 'table';
  query = '';
  chromFilter: string | null = null;
  typeFilter: VcfVariantType | null = null;
  passOnly = false;
  minQual = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): VcfLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportVcf(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildVcfMetadataRows(this.parsed) : [];
  }

  get sampleNames(): string[] {
    return this.parsed?.sampleNames ?? [];
  }

  get chromCounts() {
    return this.parsed?.chromCounts ?? [];
  }

  get visibleVariants(): VcfVariant[] {
    if (!this.parsed) return [];
    return filterVcfVariants(this.parsed.variants, {
      query: this.query,
      chrom: this.chromFilter,
      type: this.typeFilter,
      minQual: this.minQual,
      passOnly: this.passOnly
    });
  }

  get selectedVariant(): VcfVariant | null {
    return this.visibleVariants[this.selectedVariantIndex] ?? this.visibleVariants[0] ?? null;
  }

  get variantMetadataRows() {
    return this.selectedVariant ? buildVariantMetadata(this.selectedVariant) : [];
  }

  get primarySuggestion() {
    const s = resolveVcfSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
      this.selectVariant(Math.min(this.visibleVariants.length - 1, this.selectedVariantIndex + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectVariant(Math.max(0, this.selectedVariantIndex - 1));
    } else if (event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.passOnly = !this.passOnly;
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: VcfLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByVariant(_i: number, variant: VcfVariant): string {
    return `${variant.index}:${variant.chrom}:${variant.pos}:${variant.ref}`;
  }

  trackBySample(_i: number, name: string): string {
    return name;
  }

  typeColor(type: VcfVariantType): string {
    return variantTypeColor(type);
  }

  formatSize(bytes: number): string {
    return formatVcfFileSize(bytes);
  }

  sampleGt(variant: VcfVariant, sample: string): string {
    return variant.samples.find((s) => s.sample === sample)?.genotype ?? '.';
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
    const { accepted, rejected } = filterValidVcfFiles(files);
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
          const bytes = await readVcfFileBytes(file);
          const record = createVcfFileRecord(file, bytes);
          const existing = this.files.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.files[existing] = record;
            this.currentIndex = existing;
          } else {
            this.files = [...this.files, record];
            this.currentIndex = this.files.length - 1;
          }
          this.selectedVariantIndex = 0;
          this.chromFilter = null;
          this.typeFilter = null;
          this.passOnly = false;
          this.minQual = 0;
          this.query = '';
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid VCF'}`;
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
    await this.handleFiles([createSampleVcfFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.selectedVariantIndex = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectVariant(index: number): void {
    if (index < 0 || index >= this.visibleVariants.length) return;
    this.selectedVariantIndex = index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setChrom(chrom: string | null): void {
    this.chromFilter = chrom;
    this.onFilterChange();
  }

  setType(type: VcfVariantType | null): void {
    this.typeFilter = type;
    this.onFilterChange();
  }

  togglePassOnly(): void {
    this.passOnly = !this.passOnly;
    this.onFilterChange();
  }

  onFilterChange(): void {
    this.selectedVariantIndex = 0;
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
    this.selectedVariantIndex = 0;
    this.renderCanvas();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedVariantIndex = 0;
    this.errorMessage = '';
    this.query = '';
    this.chromFilter = null;
    this.typeFilter = null;
    this.passOnly = false;
    this.minQual = 0;
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

  setViewMode(mode: VcfViewMode): void {
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

  exportAs(format: VcfExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(new TextEncoder().encode(file.text), file.name, 'text/x-vcf');
      else if (format === 'summary-json') downloadTextFile(exportVcfSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'variants-csv') downloadTextFile(exportVcfVariantsCsv(this.visibleVariants, this.sampleNames), `${file.name}.variants.csv`, 'text/csv');
      else if (format === 'filtered-vcf') downloadTextFile(exportFilteredVcf(file.parsed, this.visibleVariants), `${file.name}.filtered.vcf`, 'text/x-vcf');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas) {
          this.toast.info('Open Chromosomes view to export a PNG snapshot');
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

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode !== 'chromosomes') return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(220, parent.clientHeight);
    }
    if (!parsed) {
      this.clearCanvas();
      return;
    }
    renderVcfChromChart(canvas, parsed.chromCounts, this.chromFilter);
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
