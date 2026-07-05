import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  HostListener,
  PLATFORM_ID,
  Inject,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

// SheetJS types
interface XLSX {
  read(data: any, options?: { type: string; cellDates?: boolean }): XLSXWorkbook;
  write(workbook: XLSXWorkbook, options?: { type: string; bookType?: string }): any;
  utils: {
    sheet_to_json(worksheet: XLSXWorksheet, options?: { header?: number | string[]; raw?: boolean; defval?: any }): any[];
    json_to_sheet(data: any[]): XLSXWorksheet;
    sheet_to_html(worksheet: XLSXWorksheet, options?: { editable?: boolean; id?: string }): string;
    encode_range(range: XLSXRange): string;
    decode_range(range: string): XLSXRange;
    encode_cell(cell: { r: number; c: number }): string;
    format_cell(cell: XLSXCell, v?: any, opts?: any): string;
  };
}

interface XLSXWorkbook {
  SheetNames: string[];
  Sheets: { [key: string]: XLSXWorksheet };
}

interface XLSXWorksheet {
  '!ref'?: string;
  '!cols'?: Array<{ wch?: number; width?: number }>;
  '!rows'?: Array<{ hpt?: number; hpx?: number }>;
  [cell: string]: any;
}

interface XLSXCell {
  v?: any;
  t?: string;
  f?: string;
  z?: string;
  w?: string;
  s?: any;
}

interface XLSXRange {
  s: { c: number; r: number };
  e: { c: number; r: number };
}

// Load SheetJS dynamically from CDN
async function loadSheetJS(): Promise<XLSX> {
  if (globalThis.window === undefined) {
    throw new TypeError('SheetJS can only be loaded in browser environment');
  }

  if ((globalThis as any).XLSX) {
    return (globalThis as any).XLSX;
  }

  const script = document.createElement('script');
  script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const XLSXLib = (globalThis as any).XLSX;
      resolve(XLSXLib);
    };
    script.onerror = () => reject(new Error('Failed to load SheetJS library'));
  });
}

interface ExcelFile {
  name: string;
  file: File;
  workbook: XLSXWorkbook | null;
  size: number;
  loaded: boolean;
}

interface CellData {
  row: number;
  col: number;
  value: string;
  displayValue: string;
  style?: any;
  formula?: string;
}

@Component({
  selector: 'lib-excel-viewer',
  standalone: true,
  templateUrl: './excel-viewer.html',
  styleUrls: ['./excel-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective]
})
export class ExcelViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('tableContainer') tableContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('excelTable') excelTable!: ElementRef<HTMLTableElement>;

  excelFiles: ExcelFile[] = [];
  currentFileIndex: number = -1;
  currentSheetIndex: number = 0;
  loading: boolean = false;
  errorMessage: string = '';
  showDropZone: boolean = false;
  showAbout: boolean = false;
  isFullscreen: boolean = false;
  zoomLevel: number = 100;
  searchText: string = '';
  showSearch: boolean = false;
  searchResults: any[] = [];
  currentSearchIndex: number = -1;

  // Table data
  sheetData: any[][] = [];
  sheetHeaders: string[] = [];
  maxRows: number = 0;
  maxCols: number = 0;

  private XLSXLib: XLSX | null = null;
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();
  private readonly supportedFormats = [
    '.xlsx',
    '.xls',
    '.xlsm',
    '.xlsb',
    '.csv',
    '.ods',
    '.fods',
    '.xlsb',
    '.numbers'
  ];

  constructor(
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      loadSheetJS()
        .then(lib => {
          this.XLSXLib = lib;
        })
        .catch(err => {
          console.error('Failed to load SheetJS:', err);
          this.errorMessage = 'Failed to load Excel processing library. Please refresh the page.';
          this.cdr.markForCheck();
        });
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
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
    this.isFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    this.cdr.markForCheck();
  }

  setupDragAndDrop(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isFullscreen) {
        this.exitFullscreen();
      }
    });
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
      this.handleFiles(Array.from(files));
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(Array.from(input.files));
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    if (!this.XLSXLib) {
      this.errorMessage = 'Excel library is still loading. Please wait a moment and try again.';
      this.cdr.markForCheck();
      return;
    }

    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return this.supportedFormats.includes(ext) || file.type.includes('spreadsheet') || file.type.includes('excel');
    });

    if (validFiles.length === 0) {
      this.errorMessage = 'Please select valid Excel files (.xlsx, .xls, .csv, .ods, etc.)';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
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

      const excelFile: ExcelFile = {
        name: file.name,
        file: file,
        workbook: workbook,
        size: file.size,
        loaded: true
      };

      this.excelFiles.push(excelFile);

      if (this.excelFiles.length === 1) {
        this.currentFileIndex = 0;
        this.currentSheetIndex = 0;
        this.renderSheet();
      }

      this.loading = false;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading Excel file:', error);
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // Get range
    const range = worksheet['!ref'];
    if (!range) {
      this.sheetData = [];
      this.sheetHeaders = [];
      this.maxRows = 0;
      this.maxCols = 0;
      this.cdr.markForCheck();
      return;
    }

    // Parse range
    const decodedRange = this.XLSXLib.utils.decode_range(range);
    this.maxRows = decodedRange.e.r + 1;
    this.maxCols = decodedRange.e.c + 1;

    // Extract data
    this.sheetData = [];
    for (let row = 0; row <= decodedRange.e.r; row++) {
      const rowData: any[] = [];
      for (let col = 0; col <= decodedRange.e.c; col++) {
        const cellAddress = this.XLSXLib.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        
        if (cell) {
          let displayValue = '';
          if (cell.v !== undefined && cell.v !== null) {
            if (cell.t === 'd') {
              // Date cell
              const date = new Date(cell.v);
              displayValue = date.toLocaleString();
            } else if (cell.t === 'n') {
              // Number cell
              displayValue = cell.w || String(cell.v);
            } else {
              // String or other
              displayValue = cell.w || String(cell.v);
            }
          }
          
          rowData.push({
            value: cell.v,
            displayValue: displayValue,
            formula: cell.f,
            style: cell.s
          });
        } else {
          rowData.push({ value: '', displayValue: '', formula: undefined, style: undefined });
        }
      }
      this.sheetData.push(rowData);
    }

    // Generate headers (A, B, C, ...)
    this.sheetHeaders = [];
    for (let col = 0; col <= decodedRange.e.c; col++) {
      this.sheetHeaders.push(this.getColumnLetter(col));
    }

    // Apply search highlighting
    if (this.searchText) {
      this.performSearch();
    }

    this.cdr.markForCheck();

    // Wait for DOM update then apply zoom
    setTimeout(() => {
      this.updateZoom();
    }, 100);
  }

  getColumnLetter(col: number): string {
    let result = '';
    while (col >= 0) {
      result = String.fromCodePoint(65 + (col % 26)) + result;
      col = Math.floor(col / 26) - 1;
    }
    return result;
  }

  getCellValue(row: number, col: number): string {
    if (row < this.sheetData.length && col < this.sheetData[row].length) {
      return this.sheetData[row][col]?.displayValue || '';
    }
    return '';
  }

  zoomIn(): void {
    if (this.zoomLevel < 200) {
      this.zoomLevel = Math.min(this.zoomLevel + 10, 200);
      this.updateZoom();
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 50) {
      this.zoomLevel = Math.max(this.zoomLevel - 10, 50);
      this.updateZoom();
    }
  }

  resetZoom(): void {
    this.zoomLevel = 100;
    this.updateZoom();
  }

  updateZoom(): void {
    if (this.tableContainer?.nativeElement) {
      this.tableContainer.nativeElement.style.zoom = `${this.zoomLevel}%`;
    }
  }

  performSearch(): void {
    if (!this.searchText.trim()) {
      this.searchResults = [];
      this.currentSearchIndex = -1;
      this.cdr.markForCheck();
      return;
    }

    this.searchResults = [];
    const searchLower = this.searchText.toLowerCase();

    for (let row = 0; row < this.sheetData.length; row++) {
      for (let col = 0; col < this.sheetData[row].length; col++) {
        const cellValue = this.getCellValue(row, col).toLowerCase();
        if (cellValue.includes(searchLower)) {
          this.searchResults.push({ row, col });
        }
      }
    }

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
      this.currentSearchIndex = (this.currentSearchIndex - 1 + this.searchResults.length) % this.searchResults.length;
      this.scrollToSearchResult();
    }
  }

  scrollToSearchResult(): void {
    if (this.currentSearchIndex < 0 || this.currentSearchIndex >= this.searchResults.length) {
      return;
    }
    
    const result = this.searchResults[this.currentSearchIndex];
    const cellElement = document.querySelector(`[data-row="${result.row}"][data-col="${result.col}"]`) as HTMLElement;
    if (!cellElement) {
      return;
    }
    
    cellElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    cellElement.classList.add('search-highlight');
    setTimeout(() => {
      cellElement.classList.remove('search-highlight');
    }, 1000);
  }

  toggleFullscreen(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const container = document.querySelector('.excel-viewer-container') as HTMLElement;
    if (!container) return;

    if (this.isFullscreen) {
      this.exitFullscreen();
      return;
    }

    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if ((container as any).webkitRequestFullscreen) {
      (container as any).webkitRequestFullscreen();
    } else if ((container as any).mozRequestFullScreen) {
      (container as any).mozRequestFullScreen();
    } else if ((container as any).msRequestFullscreen) {
      (container as any).msRequestFullscreen();
    }
  }

  exitFullscreen(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
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

      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      this.errorMessage = 'Failed to download Excel file';
      this.cdr.markForCheck();
    }
  }

  printExcel(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const printWindow = globalThis.window.open('', '_blank');
    if (!printWindow) return;

    const file = this.excelFiles[this.currentFileIndex];
    const sheetName = this.getCurrentSheetName();

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
          ${this.getTableHTML()}
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
    }, 250);
  }

  getTableHTML(): string {
    let html = '<table>';
    
    // Header row
    html += '<thead><tr><th>#</th>';
    for (const header of this.sheetHeaders) {
      html += `<th>${header}</th>`;
    }
    html += '</tr></thead>';

    // Data rows
    html += '<tbody>';
    for (let row = 0; row < this.sheetData.length; row++) {
      html += `<tr><td><strong>${row + 1}</strong></td>`;
      for (let col = 0; col < this.sheetData[row].length; col++) {
        const value = this.getCellValue(row, col);
        html += `<td>${this.escapeHtml(value)}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    return html;
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    this.cdr.markForCheck();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  toggleAbout(): void {
    this.showAbout = !this.showAbout;
    this.cdr.markForCheck();
  }

  cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
  }
}
