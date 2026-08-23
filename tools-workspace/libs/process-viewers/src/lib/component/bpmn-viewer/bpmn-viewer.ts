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
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  BPMN_ACCEPT_ATTR,
  BPMN_FORMATS_HINT,
  BPMN_FORMATS_LABEL,
  BPMN_RELATED_TOOLS,
  BPMN_SAMPLE_XML,
  BPMN_SUPPORTED_EXTENSIONS
} from '../../constants/bpmn-viewer.constants';
import type {
  BpmnDiagramStats,
  BpmnElementFilter,
  BpmnElementSummary,
  BpmnExportFormat,
  BpmnLoadedFile,
  BpmnViewerApi
} from '../../types/bpmn-viewer.types';
import {
  buildBpmnStats,
  countBpmnElementsByKind,
  createBpmnFileRecord,
  downloadTextFile,
  ensureBpmnStylesheets,
  exportBpmnElementsCsv,
  exportBpmnSummaryJson,
  filterBpmnElements,
  filterValidBpmnFiles,
  formatBpmnFileSize,
  getXmlRootTagName,
  loadBpmnNavigatedViewer,
  looksLikeBpmnXml,
  parseBpmnElements,
  readBpmnFileText,
  resolveBpmnSuggestion
} from '../../utils/bpmn-viewer.utils';

@Component({
  selector: 'lib-bpmn-viewer',
  standalone: true,
  templateUrl: './bpmn-viewer.html',
  styleUrls: ['./bpmn-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BpmnViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLDivElement>;
  @ViewChild('workspace') workspace!: ElementRef<HTMLElement>;

  readonly acceptAttr = BPMN_ACCEPT_ATTR;
  readonly relatedTools = BPMN_RELATED_TOOLS;
  readonly supportedExtensions = BPMN_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = BPMN_FORMATS_LABEL;
  readonly formatsHint = BPMN_FORMATS_HINT;
  readonly elementFilters: ReadonlyArray<{ id: BpmnElementFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'task', label: 'Tasks' },
    { id: 'event', label: 'Events' },
    { id: 'gateway', label: 'Gateways' },
    { id: 'flow', label: 'Flows' },
    { id: 'other', label: 'Other' }
  ];

  bpmnFiles: BpmnLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  libraryReady = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  elementFilter: BpmnElementFilter = 'all';
  elementSearch = '';
  selectedElementId: string | null = null;
  importWarnings: string[] = [];
  zoomPercent = 100;

  elements: BpmnElementSummary[] = [];
  filteredElements: BpmnElementSummary[] = [];
  kindCounts: Record<BpmnElementFilter, number> = {
    all: 0,
    task: 0,
    event: 0,
    gateway: 0,
    flow: 0,
    other: 0
  };
  stats: BpmnDiagramStats | null = null;

  private viewer: BpmnViewerApi | null = null;
  private dragDepth = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly onElementClick = (event: {
    element?: { id?: string; type?: string; businessObject?: { name?: string; id?: string } };
  }) => {
    const id = event.element?.id;
    const type = event.element?.type;
    if (!id || type === 'bpmn:Process' || type === 'label' || type === 'bpmn:Collaboration') {
      return;
    }
    this.selectedElementId = id;
    this.cdr.markForCheck();
  };

  get currentFile(): BpmnLoadedFile | null {
    return this.currentFileIndex >= 0 && this.currentFileIndex < this.bpmnFiles.length
      ? this.bpmnFiles[this.currentFileIndex]
      : null;
  }

  get canExport(): boolean {
    return !!this.currentFile && !this.loading;
  }

  get selectedElement(): BpmnElementSummary | null {
    if (!this.selectedElementId) {
      return null;
    }
    return this.elements.find((item) => item.id === this.selectedElementId) ?? null;
  }

  get primarySuggestion() {
    const suggestion = resolveBpmnSuggestion({
      hasFiles: this.bpmnFiles.length > 0,
      hasError: !!this.errorMessage,
      elementCount: this.elements.length
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }
    ensureBpmnStylesheets([
      this.assetService.getAssetPath('bpmn-js/diagram-js.css'),
      this.assetService.getAssetPath('bpmn-js/bpmn-js.css'),
      this.assetService.getAssetPath('bpmn-js/bpmn-font/css/bpmn.css')
    ]);
    try {
      await loadBpmnNavigatedViewer();
      this.libraryReady = true;
      this.observeCanvasResize();
      this.cdr.markForCheck();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Failed to load BPMN viewer library';
      this.toast.error(this.errorMessage);
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.resizeObserver?.disconnect();
    this.destroyViewer();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen = !!document.fullscreenElement;
    this.cdr.markForCheck();
    queueMicrotask(() => this.resizedCanvas());
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (!this.currentFile || this.loading) {
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitViewport();
    } else if (event.key === '0') {
      event.preventDefault();
      this.resetZoom();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      void this.toggleFullscreen();
    }
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      await this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }
    await this.handleFiles(Array.from(input.files));
    input.value = '';
  }

  async handleFiles(files: File[]): Promise<void> {
    const { accepted, rejected } = filterValidBpmnFiles(files);
    for (const item of rejected) {
      this.toast.error(`${item.name}: ${item.reason}`);
    }
    if (accepted.length === 0) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      for (const file of accepted) {
        const xml = await readBpmnFileText(file);
        if (!looksLikeBpmnXml(xml)) {
          const root = getXmlRootTagName(xml);
          const detail = root
            ? `root element <${root}> is not a BPMN <definitions>`
            : 'the file is not valid XML';
          this.errorMessage =
            `${file.name}: ${detail}. Upload a BPMN 2.0 diagram exported from ` +
            'Camunda Modeler, bpmn.io, or a similar tool.';
          this.toast.error(this.errorMessage);
          continue;
        }
        const record = createBpmnFileRecord(file, xml);
        const existing = this.bpmnFiles.findIndex((item) => item.id === record.id);
        if (existing >= 0) {
          this.bpmnFiles[existing] = record;
          this.currentFileIndex = existing;
        } else {
          this.bpmnFiles = [...this.bpmnFiles, record];
          this.currentFileIndex = this.bpmnFiles.length - 1;
        }
      }
      await this.renderCurrentFile();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load BPMN file';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    const sample = new File([BPMN_SAMPLE_XML], 'order-fulfillment.bpmn', {
      type: 'application/xml',
      // Keep the generated sample identity stable so repeated clicks replace it instead of
      // filling the file rail with duplicate tabs.
      lastModified: 0
    });
    await this.handleFiles([sample]);
  }

  async selectFile(index: number): Promise<void> {
    if (index < 0 || index >= this.bpmnFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.loading = true;
    this.cdr.markForCheck();
    try {
      await this.renderCurrentFile();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async removeFile(index: number, event: Event): Promise<void> {
    event.stopPropagation();
    if (index < 0 || index >= this.bpmnFiles.length) {
      return;
    }
    const next = this.bpmnFiles.filter((_, i) => i !== index);
    this.bpmnFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    this.loading = true;
    this.cdr.markForCheck();
    try {
      await this.renderCurrentFile();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  clearAll(): void {
    this.destroyViewer();
    this.bpmnFiles = [];
    this.currentFileIndex = -1;
    this.elements = [];
    this.filteredElements = [];
    this.kindCounts = { all: 0, task: 0, event: 0, gateway: 0, flow: 0, other: 0 };
    this.stats = null;
    this.selectedElementId = null;
    this.importWarnings = [];
    this.errorMessage = '';
    this.elementSearch = '';
    this.elementFilter = 'all';
    this.zoomPercent = 100;
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    // Fit after the width transition so the diagram uses all available canvas space.
    setTimeout(() => this.fitViewport(), 220);
  }

  setElementFilter(filter: BpmnElementFilter): void {
    this.elementFilter = filter;
    this.refreshFilteredElements();
  }

  onElementSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.elementSearch = value;
      this.refreshFilteredElements();
    }, 120);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  async exportAs(format: BpmnExportFormat, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      this.toast.error('No diagram loaded');
      this.cdr.markForCheck();
      return;
    }
    const base = current.name.replace(/\.(bpmn|xml)$/i, '') || 'diagram';

    try {
      if (format === 'original-bpmn') {
        downloadTextFile(current.xml, `${base}.bpmn`, 'application/xml;charset=utf-8');
        this.toast.success('Exported BPMN XML');
      } else if (format === 'elements-csv') {
        downloadTextFile(
          exportBpmnElementsCsv(this.elements),
          `${base}-elements.csv`,
          'text/csv;charset=utf-8'
        );
        this.toast.success('Exported elements CSV');
      } else if (format === 'summary-json' && this.stats) {
        downloadTextFile(
          exportBpmnSummaryJson(current, this.stats, this.elements),
          `${base}-summary.json`,
          'application/json;charset=utf-8'
        );
        this.toast.success('Exported summary JSON');
      } else if (format === 'svg') {
        if (!this.viewer) {
          throw new Error('Viewer is not ready');
        }
        const { svg } = await this.viewer.saveSVG();
        downloadTextFile(svg, `${base}.svg`, 'image/svg+xml;charset=utf-8');
        this.toast.success('Exported SVG');
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  async copySelectedId(): Promise<void> {
    const element = this.selectedElement;
    if (!element || !navigator.clipboard?.writeText) {
      this.toast.error('Nothing to copy');
      return;
    }
    await navigator.clipboard.writeText(element.id);
    this.toast.success('Element ID copied');
  }

  async copyXml(): Promise<void> {
    const current = this.currentFile;
    if (!current || !navigator.clipboard?.writeText) {
      this.toast.error('No diagram loaded');
      return;
    }
    await navigator.clipboard.writeText(current.xml);
    this.toast.success('BPMN XML copied');
  }

  zoomIn(): void {
    this.canvasZoom(0.1);
  }

  zoomOut(): void {
    this.canvasZoom(-0.1);
  }

  fitViewport(): void {
    const canvas = this.getCanvas();
    canvas?.zoom('fit-viewport');
    this.syncZoomPercent();
  }

  resetZoom(): void {
    const canvas = this.getCanvas();
    canvas?.zoom(1);
    this.syncZoomPercent();
  }

  async toggleFullscreen(): Promise<void> {
    const node = this.workspace?.nativeElement;
    if (!node) {
      return;
    }
    if (!document.fullscreenElement) {
      await node.requestFullscreen();
      this.isFullscreen = true;
    } else {
      await document.exitFullscreen();
      this.isFullscreen = false;
    }
    this.cdr.markForCheck();
    queueMicrotask(() => {
      this.fitViewport();
      this.resizedCanvas();
    });
  }

  focusElement(element: BpmnElementSummary): void {
    this.selectedElementId = element.id;
    const elementRegistry = this.viewer?.get('elementRegistry') as
      | { get: (id: string) => unknown }
      | undefined;
    const selection = this.viewer?.get('selection') as
      | { select: (el: unknown) => void }
      | undefined;
    const canvas = this.getCanvas();
    const shape = elementRegistry?.get(element.id);
    if (shape) {
      selection?.select(shape);
      if (typeof canvas?.scrollToElement === 'function') {
        canvas.scrollToElement(shape);
      }
    }
    this.cdr.markForCheck();
  }

  formatSize(bytes: number): string {
    return formatBpmnFileSize(bytes);
  }

  trackByElementId(_index: number, item: BpmnElementSummary): string {
    return item.id;
  }

  trackByFileId(_index: number, item: BpmnLoadedFile): string {
    return item.id;
  }

  trackByFilterId(_index: number, item: { id: string }): string {
    return item.id;
  }

  private refreshFilteredElements(): void {
    this.filteredElements = filterBpmnElements(this.elements, this.elementFilter, this.elementSearch);
    this.cdr.markForCheck();
  }

  private canvasZoom(delta: number): void {
    const canvas = this.getCanvas();
    if (!canvas || typeof canvas.zoom !== 'function') {
      return;
    }
    const current = typeof canvas.zoom() === 'number' ? (canvas.zoom() as number) : 1;
    canvas.zoom(Math.min(4, Math.max(0.2, current + delta)));
    this.syncZoomPercent();
  }

  private syncZoomPercent(): void {
    const canvas = this.getCanvas();
    if (!canvas || typeof canvas.zoom !== 'function') {
      return;
    }
    const level = canvas.zoom();
    if (typeof level === 'number') {
      this.zoomPercent = Math.round(level * 100);
      this.cdr.markForCheck();
    }
  }

  private getCanvas():
    | {
        zoom: (level?: string | number) => number | void;
        scrollToElement?: (element: unknown) => void;
        resized?: () => void;
      }
    | undefined {
    return this.viewer?.get('canvas') as
      | {
          zoom: (level?: string | number) => number | void;
          scrollToElement?: (element: unknown) => void;
          resized?: () => void;
        }
      | undefined;
  }

  private resizedCanvas(): void {
    this.getCanvas()?.resized?.();
  }

  private observeCanvasResize(): void {
    if (typeof ResizeObserver === 'undefined' || !this.canvasHost?.nativeElement) {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.resizedCanvas();
    });
    this.resizeObserver.observe(this.canvasHost.nativeElement);
  }

  private isFileDrag(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) {
      return false;
    }
    return Array.from(types).includes('Files');
  }

  private async renderCurrentFile(): Promise<void> {
    const current = this.currentFile;
    if (!current || !this.isBrowser) {
      return;
    }
    this.elements = parseBpmnElements(current.xml);
    this.kindCounts = countBpmnElementsByKind(this.elements);
    this.stats = buildBpmnStats(current.xml, this.elements, 0);
    this.selectedElementId = null;
    this.importWarnings = [];
    this.refreshFilteredElements();

    await this.ensureViewer();
    if (!this.viewer) {
      throw new Error('BPMN canvas is not ready');
    }

    const result = await this.viewer.importXML(current.xml);
    this.importWarnings = (result.warnings ?? [])
      .map((item) => item.message ?? 'Import warning')
      .filter(Boolean)
      .slice(0, 8);
    this.stats = buildBpmnStats(current.xml, this.elements, this.importWarnings.length);
    this.fitViewport();
    this.cdr.markForCheck();
  }

  private async ensureViewer(): Promise<void> {
    if (this.viewer) {
      return;
    }
    if (!this.canvasHost?.nativeElement) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const container = this.canvasHost?.nativeElement;
    if (!container) {
      throw new Error('BPMN canvas is not ready');
    }
    const NavigatedViewer = await loadBpmnNavigatedViewer();
    this.viewer = new NavigatedViewer({ container });
    this.viewer.on('element.click', this.onElementClick);
    this.libraryReady = true;
    this.observeCanvasResize();
  }

  private destroyViewer(): void {
    if (this.viewer) {
      try {
        this.viewer.destroy();
      } catch {
        // ignore destroy races during navigation
      }
      this.viewer = null;
    }
  }
}
