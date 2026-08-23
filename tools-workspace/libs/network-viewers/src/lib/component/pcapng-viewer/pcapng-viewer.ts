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
  PCAPNG_ACCEPT_ATTR,
  PCAPNG_FORMATS_HINT,
  PCAPNG_FORMATS_LABEL,
  PCAPNG_RELATED_TOOLS,
  PCAPNG_SUPPORTED_EXTENSIONS
} from '../../constants/pcapng-viewer.constants';
import type {
  PcapngExportFormat,
  PcapngInterface,
  PcapngLoadedFile,
  PcapngPacket,
  PcapngViewMode
} from '../../types/pcapng-viewer.types';
import {
  buildInterfaceMetadata,
  buildPcapngMetadataRows,
  buildPcapngPacketMetadata,
  canExportPcapng,
  canvasToPngDataUrl,
  createPcapngFileRecord,
  createSamplePcapngFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportPcapngInterfacesCsv,
  exportPcapngPacketsCsv,
  exportPcapngSummaryJson,
  filterPcapngPackets,
  filterValidPcapngFiles,
  formatPcapngFileSize,
  hexForPcapngPacket,
  protocolColor,
  readPcapngFileBytes,
  renderPcapngInterfaces,
  renderPcapngTimeline,
  resolvePcapngSuggestion
} from '../../utils/pcapng-viewer.utils';

@Component({
  selector: 'lib-pcapng-viewer',
  standalone: true,
  templateUrl: './pcapng-viewer.html',
  styleUrls: ['./pcapng-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PcapngViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = PCAPNG_ACCEPT_ATTR;
  readonly relatedTools = PCAPNG_RELATED_TOOLS;
  readonly supportedExtensions = PCAPNG_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PCAPNG_FORMATS_LABEL;
  readonly formatsHint = PCAPNG_FORMATS_HINT;
  readonly viewModes: Array<{ id: PcapngViewMode; label: string }> = [
    { id: 'interfaces', label: 'Interfaces' },
    { id: 'packets', label: 'Packets' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'table', label: 'Table' }
  ];

  files: PcapngLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: PcapngViewMode = 'interfaces';
  query = '';
  selectedInterfaceId: number | null = null;
  selectedPacketIndex = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): PcapngLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportPcapng(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildPcapngMetadataRows(this.parsed) : [];
  }

  get interfaces(): PcapngInterface[] {
    return this.parsed?.interfaces ?? [];
  }

  get selectedInterface(): PcapngInterface | null {
    if (this.selectedInterfaceId == null) return this.interfaces[0] ?? null;
    return this.interfaces.find((i) => i.id === this.selectedInterfaceId) ?? this.interfaces[0] ?? null;
  }

  get interfaceMetadataRows() {
    return this.selectedInterface ? buildInterfaceMetadata(this.selectedInterface) : [];
  }

  get filteredPackets(): PcapngPacket[] {
    return this.parsed ? filterPcapngPackets(this.parsed.packets, this.query, this.selectedInterfaceId) : [];
  }

  get selectedPacket(): PcapngPacket | null {
    return this.filteredPackets.find((p) => p.index === this.selectedPacketIndex) ?? this.filteredPackets[0] ?? null;
  }

  get packetMetadataRows() {
    return this.selectedPacket ? buildPcapngPacketMetadata(this.selectedPacket) : [];
  }

  get hexDump(): string {
    return hexForPcapngPacket(this.selectedPacket);
  }

  get primarySuggestion() {
    const s = resolvePcapngSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  protoColor(protocol: string): string {
    return protocolColor(protocol);
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
      if (this.viewMode === 'interfaces') this.shiftInterface(1);
      else this.shiftPacket(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'interfaces') this.shiftInterface(-1);
      else this.shiftPacket(-1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.shiftInterface(event.key === 'ArrowRight' ? 1 : -1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.selectedInterfaceId = null;
      this.renderCanvas();
      this.cdr.markForCheck();
    }
  }

  trackByFileId(_i: number, file: PcapngLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByIface(_i: number, iface: PcapngInterface): number {
    return iface.id;
  }

  trackByPacket(_i: number, packet: PcapngPacket): number {
    return packet.index;
  }

  formatSize(bytes: number): string {
    return formatPcapngFileSize(bytes);
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
    const { accepted, rejected } = filterValidPcapngFiles(files);
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
          const bytes = await readPcapngFileBytes(file);
          const record = createPcapngFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid PCAPNG'}`;
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
    await this.handleFiles([createSamplePcapngFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectInterface(id: number | null): void {
    this.selectedInterfaceId = id;
    const first = this.filteredPackets[0];
    if (first) this.selectedPacketIndex = first.index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectPacket(index: number): void {
    this.selectedPacketIndex = index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const first = this.filteredPackets[0];
    if (first && !this.filteredPackets.some((p) => p.index === this.selectedPacketIndex)) this.selectedPacketIndex = first.index;
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
    this.selectedInterfaceId = null;
    this.selectedPacketIndex = 0;
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

  setViewMode(mode: PcapngViewMode): void {
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

  exportAs(format: PcapngExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/x-pcapng');
      else if (format === 'summary-json') downloadTextFile(exportPcapngSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'interfaces-csv') downloadTextFile(exportPcapngInterfacesCsv(file.parsed), `${file.name}.interfaces.csv`, 'text/csv');
      else if (format === 'packets-csv') downloadTextFile(exportPcapngPacketsCsv(file.parsed), `${file.name}.packets.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'interfaces' && this.viewMode !== 'timeline')) {
          this.toast.info('Open Interfaces or Timeline to export a PNG snapshot');
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

  private shiftInterface(delta: number): void {
    if (!this.interfaces.length) return;
    const idx = Math.max(0, this.interfaces.findIndex((i) => i.id === this.selectedInterfaceId));
    const next = this.interfaces[Math.min(this.interfaces.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectInterface(next.id);
  }

  private shiftPacket(delta: number): void {
    const packets = this.filteredPackets;
    if (!packets.length) return;
    const idx = Math.max(0, packets.findIndex((p) => p.index === this.selectedPacketIndex));
    const next = packets[Math.min(packets.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPacket(next.index);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedInterfaceId = this.parsed?.interfaces[0]?.id ?? null;
    this.selectedPacketIndex = this.parsed?.packets[0]?.index ?? 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'interfaces' && this.viewMode !== 'timeline')) return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas || !parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    if (this.viewMode === 'interfaces') {
      renderPcapngInterfaces(canvas, parsed.interfaces, this.selectedInterfaceId);
      return;
    }
    renderPcapngTimeline(canvas, this.filteredPackets, this.selectedPacket?.index ?? null);
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
