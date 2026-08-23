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
  BPSIM_ACCEPT_ATTR,
  BPSIM_FORMATS_HINT,
  BPSIM_FORMATS_LABEL,
  BPSIM_RELATED_TOOLS,
  BPSIM_SUPPORTED_EXTENSIONS
} from '../../constants/business-process-simulator.constants';
import type {
  BpsimExportFormat,
  BpsimLoadedFile,
  BpsimNode,
  BpsimScenario,
  BpsimStep,
  BpsimViewMode
} from '../../types/business-process-simulator.types';
import {
  applyScenarioMarking,
  bpsimNodeColor,
  bpsimScenarioColor,
  buildBpsimMetadataRows,
  buildBpsimNodeMetadata,
  buildBpsimScenarioMetadata,
  canExportBpsim,
  canvasToPngDataUrl,
  createBpsimFileRecord,
  createSampleBpsimFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  enabledBpsimIds,
  exportBpsimScenariosCsv,
  exportBpsimSummaryJson,
  exportBpsimTraceCsv,
  filterBpsimNodes,
  filterBpsimScenarios,
  filterValidBpsimFiles,
  fireBpsimStep,
  formatBpsimFileSize,
  formatBpsimMarking,
  readBpsimFileBytes,
  renderBpsimGraph,
  renderBpsimScenarios,
  renderBpsimTokens,
  renderBpsimTrace,
  resolveBpsimSuggestion,
  scenarioChoices,
  tokenTotal
} from '../../utils/business-process-simulator.utils';

@Component({
  selector: 'lib-business-process-simulator',
  standalone: true,
  templateUrl: './business-process-simulator.html',
  styleUrls: ['./business-process-simulator.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BusinessProcessSimulatorComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = BPSIM_ACCEPT_ATTR;
  readonly relatedTools = BPSIM_RELATED_TOOLS;
  readonly supportedExtensions = BPSIM_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = BPSIM_FORMATS_LABEL;
  readonly formatsHint = BPSIM_FORMATS_HINT;
  readonly viewModes: Array<{ id: BpsimViewMode; label: string }> = [
    { id: 'tokens', label: 'Tokens' },
    { id: 'scenarios', label: 'Scenarios' },
    { id: 'graph', label: 'Graph' },
    { id: 'table', label: 'Table' }
  ];

  files: BpsimLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: BpsimViewMode = 'tokens';
  query = '';
  selectedNodeId = '';
  selectedScenarioId = '';
  selectedStep: number | null = null;
  marking: Record<string, number> = {};
  choices: Record<string, string> = {};
  trace: BpsimStep[] = [];

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): BpsimLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportBpsim(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get enabledIds(): string[] {
    return this.parsed ? enabledBpsimIds(this.parsed, this.marking) : [];
  }

  get currentTokenTotal(): number {
    return tokenTotal(this.marking);
  }

  get selectedScenario(): BpsimScenario | null {
    return this.parsed?.scenarios.find((s) => s.id === this.selectedScenarioId) ?? this.parsed?.scenarios[0] ?? null;
  }

  get selectedNode(): BpsimNode | null {
    return this.parsed?.nodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  get filteredNodes(): BpsimNode[] {
    return this.parsed ? filterBpsimNodes(this.parsed.nodes, this.query, this.marking, this.enabledIds) : [];
  }

  get filteredScenarios(): BpsimScenario[] {
    return this.parsed ? filterBpsimScenarios(this.parsed.scenarios, this.query) : [];
  }

  get metadataRows() {
    return this.parsed
      ? buildBpsimMetadataRows(this.parsed, this.marking, this.enabledIds.length, this.trace.length, this.selectedScenario?.name || '')
      : [];
  }

  get nodeMetadataRows() {
    return this.selectedNode
      ? buildBpsimNodeMetadata(this.selectedNode, this.marking[this.selectedNode.id] ?? 0, this.enabledIds.includes(this.selectedNode.id))
      : [];
  }

  get scenarioMetadataRows() {
    return this.selectedScenario ? buildBpsimScenarioMetadata(this.selectedScenario) : [];
  }

  get primarySuggestion() {
    const s = resolveBpsimSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  nodeTint(node: BpsimNode): string {
    return bpsimNodeColor(node.kind, this.enabledIds.includes(node.id), this.marking[node.id] ?? 0);
  }

  scenarioTint(index: number): string {
    return bpsimScenarioColor(index);
  }

  isEnabled(id: string): boolean {
    return this.enabledIds.includes(id);
  }

  tokenCount(id: string): number {
    return this.marking[id] ?? 0;
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
      if (this.viewMode === 'scenarios') this.shiftScenario(1);
      else this.shiftNode(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'scenarios') this.shiftScenario(-1);
      else this.shiftNode(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: BpsimLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByNode(_i: number, node: BpsimNode): string {
    return node.id;
  }

  trackByScenario(_i: number, scenario: BpsimScenario): string {
    return scenario.id;
  }

  trackByStep(_i: number, step: BpsimStep): number {
    return step.step;
  }

  formatSize(bytes: number): string {
    return formatBpsimFileSize(bytes);
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
    const { accepted, rejected } = filterValidBpsimFiles(files);
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
          const bytes = await readBpsimFileBytes(file);
          const record = createBpsimFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid simulator file'}`;
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
    await this.handleFiles([createSampleBpsimFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectNode(id: string): void {
    this.selectedNodeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectScenario(id: string): void {
    this.selectedScenarioId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectStep(step: number): void {
    this.selectedStep = step;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  applyScenarioFromCard(id: string, event: Event): void {
    event.stopPropagation();
    this.applyScenario(id);
  }

  applyScenario(id: string): void {
    if (!this.parsed) return;
    const scenario = this.parsed.scenarios.find((s) => s.id === id) ?? null;
    this.selectedScenarioId = scenario?.id ?? '';
    this.marking = applyScenarioMarking(this.parsed, scenario);
    this.choices = scenarioChoices(scenario);
    this.trace = [];
    this.selectedStep = null;
    this.selectedNodeId = this.enabledIds[0] || this.parsed.nodes[0]?.id || '';
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fireStep(): void {
    if (!this.parsed) return;
    const id =
      (this.selectedNodeId && this.enabledIds.includes(this.selectedNodeId) && this.selectedNodeId) || this.enabledIds[0];
    if (!id) {
      this.toast.info('No enabled step to fire');
      return;
    }
    const result = fireBpsimStep(this.parsed, this.marking, id, this.choices);
    if (!result.ok) {
      this.toast.info(result.reason || 'Step failed');
      return;
    }
    this.marking = result.marking;
    const node = this.parsed.nodes.find((n) => n.id === id);
    this.trace = [
      ...this.trace,
      { step: this.trace.length + 1, nodeId: id, nodeName: node?.name || id, marking: formatBpsimMarking(this.parsed, this.marking) }
    ];
    this.selectedStep = this.trace.length;
    this.selectedNodeId = this.enabledIds[0] || id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetSimulation(): void {
    this.applyScenario(this.selectedScenarioId);
  }

  onFilterChange(): void {
    if (this.viewMode === 'scenarios') {
      const sc = this.filteredScenarios[0];
      if (sc && !this.filteredScenarios.some((s) => s.id === this.selectedScenarioId)) this.selectedScenarioId = sc.id;
    } else {
      const node = this.filteredNodes[0];
      if (node && !this.filteredNodes.some((n) => n.id === this.selectedNodeId)) this.selectedNodeId = node.id;
    }
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
    this.selectedNodeId = '';
    this.selectedScenarioId = '';
    this.selectedStep = null;
    this.marking = {};
    this.choices = {};
    this.trace = [];
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

  setViewMode(mode: BpsimViewMode): void {
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

  exportAs(format: BpsimExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') {
        downloadTextFile(
          exportBpsimSummaryJson(file, this.marking, this.trace, this.selectedScenario?.name || ''),
          `${file.name}.summary.json`,
          'application/json'
        );
      } else if (format === 'scenarios-csv') downloadTextFile(exportBpsimScenariosCsv(file.parsed), `${file.name}.scenarios.csv`, 'text/csv');
      else if (format === 'trace-csv') downloadTextFile(exportBpsimTraceCsv(this.trace), `${file.name}.trace.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Tokens, Scenarios, or Graph to export a PNG snapshot');
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

  private shiftNode(delta: number): void {
    const list = this.filteredNodes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedNodeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectNode(next.id);
  }

  private shiftScenario(delta: number): void {
    const list = this.filteredScenarios;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedScenarioId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectScenario(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.trace = [];
    this.selectedStep = null;
    const scenario = this.parsed?.scenarios[0] ?? null;
    this.selectedScenarioId = scenario?.id ?? '';
    this.marking = this.parsed ? applyScenarioMarking(this.parsed, scenario) : {};
    this.choices = scenarioChoices(scenario);
    this.selectedNodeId = this.enabledIds[0] || this.parsed?.nodes[0]?.id || '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'graph' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'tokens') renderBpsimTokens(canvas, this.filteredNodes, this.marking, this.enabledIds, this.selectedNodeId || null);
    else if (this.viewMode === 'scenarios') renderBpsimScenarios(canvas, this.filteredScenarios, this.selectedScenarioId || null);
    else if (this.viewMode === 'graph') {
      renderBpsimGraph(canvas, this.parsed.nodes, this.parsed.edges, this.marking, this.enabledIds, this.selectedNodeId || null);
    } else renderBpsimTrace(canvas, this.trace, this.selectedStep);
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
