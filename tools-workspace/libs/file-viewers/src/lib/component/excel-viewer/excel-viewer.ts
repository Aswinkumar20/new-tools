import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  EXCEL_ACCEPT_ATTR,
  EXCEL_DEFAULT_ZOOM,
  EXCEL_DOWNLOAD_MIME,
  EXCEL_MAX_ZOOM,
  EXCEL_MIN_ZOOM,
  EXCEL_PRINT_DELAY_MS,
  EXCEL_RELATED_TOOLS,
  EXCEL_SEARCH_HIGHLIGHT_MS,
  EXCEL_ZOOM_APPLY_DELAY_MS
} from '../../constants/excel-viewer.constants';
import type {
  ExcelCellView,
  ExcelFile,
  ExcelSearchHit,
  XLSX
} from '../../types/excel-viewer.types';
import {
  buildExcelPrintTableHtml,
  buildExcelSheetView,
  filterValidExcelFiles,
  findExcelSearchHits,
  formatExcelFileSize,
  isFullscreenActive,
  loadSheetJSLibrary,
  resolveExcelSuggestion,
  stepExcelZoom
} from '../../utils/excel-viewer.utils';

@Component({
  selector: 'lib-excel-viewer',
  standalone: true,
  templateUrl: './excel-viewer.html',
  styleUrls: ['./excel-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class ExcelViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('tableContainer') tableContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('excelTable') excelTable!: ElementRef<HTMLTableElement>;

  readonly acceptAttr = EXCEL_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = EXCEL_RELATED_TOOLS;
  readonly minZoom = EXCEL_MIN_ZOOM;
  readonly maxZoom = EXCEL_MAX_ZOOM;

  excelFiles: ExcelFile[] = [];
  currentFileIndex = -1;
  currentSheetIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showAbout = false;
  isFullscreen = false;
  zoomLevel = EXCEL_DEFAULT_ZOOM;
  searchText = '';
  showSearch = false;
  searchResults: ExcelSearchHit[] = [];
  currentSearchIndex = -1;
  dismissedSuggestionId: string | null = null;

  sheetData: ExcelCellView[][] = [];
  sheetHeaders: string[] = [];
  maxRows = 0;
  maxCols = 0;

  private XLSXLib: XLSX | null = null;
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly escapeKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
    }
  };

  constructor(
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  get primarySuggestion() {
    const currentName =
      this.currentFileIndex >= 0 ? this.excelFiles[this.currentFileIndex]?.name || '' : '';
    const suggestion = resolveExcelSuggestion({
      hasFiles: this.excelFiles.length > 0,
      hasError: !!this.errorMessage,
      currentFileName: currentName,
      sheetCount: this.getCurrentSheets().length
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      loadSheetJSLibrary()
        .then((lib) => {
          this.XLSXLib = lib;
        })
        .catch(() => {
          this.errorMessage = 'Failed to load Excel processing library. Please refresh the page.';
          this.cdr.markForCheck();
        });
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.markForCheck();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.cdr.markForCheck();
  }

  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  @HostListener('document:mozfullscreenchange')
  @HostListener('document:MSFullscreenChange')
  onFullscreenChange(): void {
    this.isFullscreen = isFullscreenActive();
    this.cdr.markForCheck();
  }

  setupDragAndDrop(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }

    document.addEventListener('keydown', this.escapeKeyHandler);
  }

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  onDragEnter(): void {
    this.showDropZone = true;
    this.cdr.markForCheck();
  }

  onDragLeave(): void {
    this.showDropZone = false;
    this.cdr.markForCheck();
  }

  onDrop(e: DragEvent): void {
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void this.handleFiles(Array.from(files));
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.handleFiles(Array.from(input.files));
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    if (!this.XLSXLib) {
      this.errorMessage = 'Excel library is still loading. Please wait a moment and try again.';
      this.cdr.markForCheck();
      return;
    }

    const validFiles = filterValidExcelFiles(files);
    if (validFiles.length === 0) {
      this.errorMessage = 'Please select valid Excel files (.xlsx, .xls, .csv, .ods, etc.)';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      for (const file of validFiles) {
        await this.loadExcelFile(file);
      }
    } catch (error) {
      this.errorMessage = `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadExcelFile(file: File): Promise<void> {
    if (!this.XLSXLib) {
      throw new Error('SheetJS library not loaded');
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = this.XLSXLib.read(arrayBuffer, {
        type: 'array',
        cellDates: true
      });

      this.excelFiles.push({
        name: file.name,
        file,
        workbook,
        size: file.size,
        loaded: true
      });

      if (this.excelFiles.length === 1) {
        this.currentFileIndex = 0;
        this.currentSheetIndex = 0;
        this.renderSheet();
      }

      this.loading = false;
      this.cdr.markForCheck();
    } catch (error) {
      throw new Error(
        `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  selectFile(index: number): void {
    if (index >= 0 && index < this.excelFiles.length) {
      this.currentFileIndex = index;
      this.currentSheetIndex = 0;
      this.searchText = '';
      this.searchResults = [];
      this.currentSearchIndex = -1;
      this.renderSheet();
    }
  }

  selectSheet(index: number): void {
    if (index >= 0 && index < this.getCurrentSheets().length) {
      this.currentSheetIndex = index;
      this.searchText = '';
      this.searchResults = [];
      this.currentSearchIndex = -1;
      this.renderSheet();
    }
  }

  getCurrentSheets(): string[] {
    if (this.currentFileIndex < 0 || !this.excelFiles[this.currentFileIndex]?.workbook) {
      return [];
    }
    return this.excelFiles[this.currentFileIndex].workbook!.SheetNames;
  }

  getCurrentSheetName(): string {
    const sheets = this.getCurrentSheets();
    return sheets[this.currentSheetIndex] || '';
  }

  renderSheet(): void {
    if (!this.XLSXLib || this.currentFileIndex < 0) {
      return;
    }

    const file = this.excelFiles[this.currentFileIndex];
    if (!file.workbook) {
      return;
    }

    const sheetName = this.getCurrentSheetName();
    if (!sheetName) {
      return;
    }

    const worksheet = file.workbook.Sheets[sheetName];
    if (!worksheet) {
      return;
    }

    const rendered = buildExcelSheetView(this.XLSXLib, worksheet);
    this.sheetData = rendered.sheetData;
    this.sheetHeaders = rendered.sheetHeaders;
    this.maxRows = rendered.maxRows;
    this.maxCols = rendered.maxCols;

    if (this.searchText) {
      this.performSearch();
    }

    this.cdr.markForCheck();

    setTimeout(() => {
      this.updateZoom();
    }, EXCEL_ZOOM_APPLY_DELAY_MS);
  }

  getCellValue(row: number, col: number): string {
    if (row < this.sheetData.length && col < this.sheetData[row].length) {
      return this.sheetData[row][col]?.displayValue || '';
    }
    return '';
  }

  zoomIn(): void {
    if (this.zoomLevel < EXCEL_MAX_ZOOM) {
      this.zoomLevel = stepExcelZoom(this.zoomLevel, 1);
      this.updateZoom();
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > EXCEL_MIN_ZOOM) {
      this.zoomLevel = stepExcelZoom(this.zoomLevel, -1);
      this.updateZoom();
    }
  }

  resetZoom(): void {
    this.zoomLevel = EXCEL_DEFAULT_ZOOM;
    this.updateZoom();
  }

  updateZoom(): void {
    if (this.tableContainer?.nativeElement) {
      this.tableContainer.nativeElement.style.zoom = `${this.zoomLevel}%`;
    }
  }

  performSearch(): void {
    this.searchResults = findExcelSearchHits(this.sheetData, this.searchText);

    if (this.searchResults.length > 0) {
      this.currentSearchIndex = 0;
      this.scrollToSearchResult();
    } else {
      this.currentSearchIndex = -1;
    }

    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.performSearch();
  }

  nextSearchResult(): void {
    if (this.searchResults.length > 0) {
      this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResults.length;
      this.scrollToSearchResult();
    }
  }

  previousSearchResult(): void {
    if (this.searchResults.length > 0) {
      this.currentSearchIndex =
        (this.currentSearchIndex - 1 + this.searchResults.length) % this.searchResults.length;
      this.scrollToSearchResult();
    }
  }

  scrollToSearchResult(): void {
    if (this.currentSearchIndex < 0 || this.currentSearchIndex >= this.searchResults.length) {
      return;
    }

    const result = this.searchResults[this.currentSearchIndex];
    const cellElement = document.querySelector(
      `[data-row="${result.row}"][data-col="${result.col}"]`
    ) as HTMLElement | null;
    if (!cellElement) {
      return;
    }

    cellElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    cellElement.classList.add('search-highlight');
    setTimeout(() => {
      cellElement.classList.remove('search-highlight');
    }, EXCEL_SEARCH_HIGHLIGHT_MS);
  }

  toggleFullscreen(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const container = document.querySelector('.excel-viewer-container') as HTMLElement | null;
    if (!container) {
      return;
    }

    if (this.isFullscreen) {
      this.exitFullscreen();
      return;
    }

    const extended = container as HTMLElement & {
      webkitRequestFullscreen?: () => void;
      mozRequestFullScreen?: () => void;
      msRequestFullscreen?: () => void;
    };

    if (container.requestFullscreen) {
      void container.requestFullscreen();
    } else if (extended.webkitRequestFullscreen) {
      extended.webkitRequestFullscreen();
    } else if (extended.mozRequestFullScreen) {
      extended.mozRequestFullScreen();
    } else if (extended.msRequestFullscreen) {
      extended.msRequestFullscreen();
    }
  }

  exitFullscreen(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const extended = document as Document & {
      webkitExitFullscreen?: () => void;
      mozCancelFullScreen?: () => void;
      msExitFullscreen?: () => void;
    };

    if (document.exitFullscreen) {
      void document.exitFullscreen();
    } else if (extended.webkitExitFullscreen) {
      extended.webkitExitFullscreen();
    } else if (extended.mozCancelFullScreen) {
      extended.mozCancelFullScreen();
    } else if (extended.msExitFullscreen) {
      extended.msExitFullscreen();
    }
  }

  async downloadExcel(): Promise<void> {
    if (!this.XLSXLib || this.currentFileIndex < 0) {
      return;
    }

    const file = this.excelFiles[this.currentFileIndex];
    if (!file.workbook) {
      return;
    }

    try {
      const wbout = this.XLSXLib.write(file.workbook, {
        bookType: 'xlsx',
        type: 'array'
      });

      const blob = new Blob([wbout as BlobPart], { type: EXCEL_DOWNLOAD_MIME });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      this.toast.info(`Downloaded ${file.name}`);
    } catch {
      this.errorMessage = 'Failed to download Excel file';
      this.toast.error('Failed to download Excel file');
      this.cdr.markForCheck();
    }
  }

  printExcel(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const printWindow = globalThis.window.open('', '_blank');
    if (!printWindow) {
      return;
    }

    const file = this.excelFiles[this.currentFileIndex];
    const sheetName = this.getCurrentSheetName();
    const tableHtml = this.getTableHTML();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${file.name} - ${sheetName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            @media print {
              body { margin: 0; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h2>${file.name} - ${sheetName}</h2>
          ${tableHtml}
        </body>
      </html>
    `;

    // eslint-disable-next-line deprecation/deprecation
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, EXCEL_PRINT_DELAY_MS);
  }

  getTableHTML(): string {
    return buildExcelPrintTableHtml(this.sheetHeaders, this.sheetData);
  }

  removeFile(index: number): void {
    if (index >= 0 && index < this.excelFiles.length) {
      this.excelFiles.splice(index, 1);

      if (this.excelFiles.length === 0) {
        this.currentFileIndex = -1;
        this.currentSheetIndex = 0;
        this.sheetData = [];
        this.sheetHeaders = [];
      } else {
        if (this.currentFileIndex >= this.excelFiles.length) {
          this.currentFileIndex = this.excelFiles.length - 1;
        }
        this.currentSheetIndex = 0;
        this.renderSheet();
      }

      this.cdr.markForCheck();
    }
  }

  clearAll(): void {
    if (this.isFullscreen) {
      this.isFullscreen = false;
    }
    this.excelFiles = [];
    this.currentFileIndex = -1;
    this.currentSheetIndex = 0;
    this.sheetData = [];
    this.sheetHeaders = [];
    this.maxRows = 0;
    this.maxCols = 0;
    this.searchText = '';
    this.searchResults = [];
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();
  }

  formatFileSize(bytes: number): string {
    return formatExcelFileSize(bytes);
  }

  toggleAbout(): void {
    this.showAbout = !this.showAbout;
    this.cdr.markForCheck();
  }

  cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
    document.removeEventListener('keydown', this.escapeKeyHandler);
  }
}
