import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, AssetService, ToastService } from '@tools-workspace/features-home';
import type { PdfJspdfToolMode } from '../../shared/pdf.types';
import { loadChartJs, type ChartConstructor } from '../../shared/pdf-jspdf-loader';
import { PdfJspdfService } from '../../services/pdf-jspdf.service';
import { downloadBytes, formatFileSize } from '../../shared/pdf.utils';
import { pdfNotifyError, pdfNotifySuccess } from '../../shared/pdf-feedback.util';
import {
  validateEmail,
  validateRequiredText,
  validateTableData,
} from '../../shared/pdf.validation';

@Component({
  selector: 'lib-pdf-jspdf-workbench',
  standalone: true,
  templateUrl: './pdf-jspdf-workbench.html',
  styleUrls: ['./pdf-jspdf-workbench.scss'],
  imports: [CommonModule, FormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfJspdfWorkbenchComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly jspdf = inject(PdfJspdfService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) mode!: PdfJspdfToolMode;
  @Input({ required: true }) title = 'PDF Tool';
  @Input({ required: true }) description = '';

  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  loading = false;
  outputBytes: Uint8Array | null = null;
  outputFilename = '';
  fieldErrors: Record<string, string> = {};

  htmlInput = '<h1>Hello PDF</h1><p>Export this HTML to a PDF document.</p>';
  plainTextInput = '';
  textFontSize = 12;
  textMargin = 20;

  tableHeaders = 'Item,Quantity,Price';
  tableRows = 'Widget A,2,19.99\nWidget B,1,49.50';
  tableTitle = 'Sales Report';

  chartType: 'bar' | 'line' | 'pie' | 'doughnut' = 'bar';
  chartTitle = 'Quarterly Revenue';
  chartLabels = 'Q1,Q2,Q3,Q4';
  chartDataset = '120,150,180,210';
  chartDatasetLabel = 'Revenue (k)';

  resume = { name: '', email: '', phone: '', summary: '', experience: '', education: '' };

  invoice = {
    companyName: 'Acme Corp',
    companyAddress: '123 Business Rd\nCity, ST 12345',
    customerName: 'Jane Client',
    customerAddress: '456 Client Ave\nTown, ST 67890',
    invoiceNumber: 'INV-1001',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    taxRate: 8.5,
    itemsText: 'Consulting,10,150\nSupport,5,80',
    notes: 'Thank you for your business.',
  };

  barcodeValue = '123456789012';
  barcodeFormat = 'CODE128';
  qrValue = 'https://easytoolhub.com';

  private chartInstance: InstanceType<ChartConstructor> | null = null;

  ngAfterViewInit(): void {
    if (this.mode === 'charts-to-pdf') {
      void this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  get canDownload(): boolean {
    return !!this.outputBytes?.length && !this.loading;
  }

  get canReset(): boolean {
    return !this.loading && (!!this.outputBytes?.length || this.hasUserInput());
  }

  fieldError(key: string): string {
    return this.fieldErrors[key] ?? '';
  }

  clearFieldError(key: string): void {
    if (this.fieldErrors[key]) {
      const { [key]: _, ...rest } = this.fieldErrors;
      this.fieldErrors = rest;
      this.cdr.markForCheck();
    }
  }

  async runPrimaryAction(): Promise<void> {
    const validationError = this.validate();
    if (validationError) {
      pdfNotifyError(this.toast, validationError);
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();
    try {
      let bytes: Uint8Array;
      switch (this.mode) {
        case 'html-to-pdf':
          bytes = await this.jspdf.createFromHtml(this.htmlInput);
          break;
        case 'tables-to-pdf': {
          const headers = this.tableHeaders.split(',').map((h) => h.trim());
          const rows = this.tableRows
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => line.split(',').map((c) => c.trim()));
          bytes = await this.jspdf.createTablePdf(headers, rows, this.tableTitle);
          break;
        }
        case 'charts-to-pdf': {
          await this.renderChart();
          const canvas = this.chartCanvas?.nativeElement;
          if (!canvas) throw new Error('Chart preview not ready');
          bytes = await this.jspdf.createChartPdf(
            {
              type: this.chartType,
              title: this.chartTitle,
              labels: this.chartLabels.split(',').map((l) => l.trim()),
              datasets: [
                {
                  label: this.chartDatasetLabel,
                  data: this.chartDataset.split(',').map((v) => Number(v.trim()) || 0),
                },
              ],
            },
            canvas,
          );
          break;
        }
        case 'resume-generator':
          bytes = await this.jspdf.createResumePdf(this.resume);
          break;
        case 'invoice-generator':
          bytes = await this.jspdf.createInvoicePdf({
            ...this.invoice,
            items: this.parseInvoiceItems(),
          });
          break;
        case 'barcode-to-pdf':
          bytes = await this.jspdf.createBarcodePdf(this.barcodeValue, this.barcodeFormat);
          break;
        case 'qr-code-to-pdf':
          bytes = await this.jspdf.createQrCodePdf(this.qrValue);
          break;
        case 'text-to-pdf':
          bytes = await this.jspdf.createFromText(this.plainTextInput, {
            fontSize: this.textFontSize,
            margin: this.textMargin,
            title: this.outputFilename || 'Text Export',
          });
          break;
        default:
          throw new Error('Unsupported mode');
      }
      this.outputBytes = bytes;
      pdfNotifySuccess(this.toast, 'PDF created successfully');
    } catch (error) {
      pdfNotifyError(this.toast, error instanceof Error ? error.message : 'PDF creation failed');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  download(): void {
    if (!this.outputBytes?.length) {
      pdfNotifyError(this.toast, 'Create a PDF first');
      return;
    }
    const name = this.outputFilename.trim() || this.defaultFilename();
    downloadBytes(this.outputBytes, name.endsWith('.pdf') ? name : `${name}.pdf`);
    pdfNotifySuccess(this.toast, 'Download started');
  }

  reset(): void {
    this.outputBytes = null;
    this.fieldErrors = {};
    if (this.mode === 'charts-to-pdf') {
      void this.renderChart();
    }
    this.cdr.markForCheck();
  }

  async onChartConfigChange(): Promise<void> {
    if (this.mode === 'charts-to-pdf') {
      await this.renderChart();
    }
  }

  formatFileSize = formatFileSize;

  primaryActionLabel(): string {
    return this.loading ? 'Working…' : 'Create PDF';
  }

  private validate(): string | null {
    this.fieldErrors = {};
    switch (this.mode) {
      case 'html-to-pdf': {
        const err = validateRequiredText(this.htmlInput, 'HTML content');
        if (err) this.fieldErrors['htmlInput'] = err;
        break;
      }
      case 'tables-to-pdf': {
        const err = validateTableData(this.tableHeaders, this.tableRows);
        if (err) this.fieldErrors['tableRows'] = err;
        break;
      }
      case 'resume-generator': {
        const nameErr = validateRequiredText(this.resume.name, 'Name');
        if (nameErr) this.fieldErrors['resumeName'] = nameErr;
        const emailErr = validateEmail(this.resume.email, true);
        if (emailErr) this.fieldErrors['resumeEmail'] = emailErr;
        break;
      }
      case 'invoice-generator': {
        if (!this.invoice.companyName.trim()) this.fieldErrors['companyName'] = 'Company name is required';
        if (!this.invoice.customerName.trim()) this.fieldErrors['customerName'] = 'Customer name is required';
        if (!this.parseInvoiceItems().length) this.fieldErrors['itemsText'] = 'Add at least one invoice line';
        break;
      }
      case 'barcode-to-pdf': {
        const err = validateRequiredText(this.barcodeValue, 'Barcode value');
        if (err) this.fieldErrors['barcodeValue'] = err;
        break;
      }
      case 'qr-code-to-pdf': {
        const err = validateRequiredText(this.qrValue, 'QR content');
        if (err) this.fieldErrors['qrValue'] = err;
        break;
      }
      case 'text-to-pdf': {
        const err = validateRequiredText(this.plainTextInput, 'Text content');
        if (err) this.fieldErrors['plainTextInput'] = err;
        break;
      }
      default:
        break;
    }
    const first = Object.values(this.fieldErrors)[0];
    return first ?? null;
  }

  private parseInvoiceItems() {
    return this.invoice.itemsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [description, qty, price] = line.split(',').map((p) => p.trim());
        return {
          description: description || 'Item',
          quantity: Number(qty) || 1,
          unitPrice: Number(price) || 0,
        };
      });
  }

  private hasUserInput(): boolean {
    switch (this.mode) {
      case 'html-to-pdf':
        return !!this.htmlInput.trim();
      case 'tables-to-pdf':
        return !!this.tableHeaders.trim() || !!this.tableRows.trim();
      case 'charts-to-pdf':
        return !!this.chartTitle.trim() || !!this.chartLabels.trim();
      case 'resume-generator':
        return Object.values(this.resume).some((v) => !!String(v).trim());
      case 'invoice-generator':
        return !!this.invoice.companyName.trim() || !!this.invoice.customerName.trim() || !!this.invoice.itemsText.trim();
      case 'barcode-to-pdf':
        return !!this.barcodeValue.trim();
      case 'qr-code-to-pdf':
        return !!this.qrValue.trim();
      case 'text-to-pdf':
        return !!this.plainTextInput.trim();
      default:
        return false;
    }
  }

  private defaultFilename(): string {
    const names: Record<PdfJspdfToolMode, string> = {
      'html-to-pdf': 'html-export',
      'tables-to-pdf': 'table-export',
      'charts-to-pdf': 'chart-export',
      'resume-generator': 'resume',
      'invoice-generator': 'invoice',
      'barcode-to-pdf': 'barcode',
      'qr-code-to-pdf': 'qr-code',
      'text-to-pdf': 'text-export',
    };
    return `${names[this.mode] ?? 'document'}.pdf`;
  }

  private async renderChart(): Promise<void> {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas) return;

    this.destroyChart();
    const Chart = await loadChartJs();
    const config = {
      type: this.chartType,
      data: {
        labels: this.chartLabels.split(',').map((l) => l.trim()),
        datasets: [
          {
            label: this.chartDatasetLabel,
            data: this.chartDataset.split(',').map((v) => Number(v.trim()) || 0),
            backgroundColor: ['#007bff', '#20c997', '#ffc107', '#dc3545', '#6f42c1'],
            borderColor: '#007bff',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const } },
      },
    };
    this.chartInstance = new Chart(canvas, config);
    this.cdr.markForCheck();
  }

  private destroyChart(): void {
    this.chartInstance?.destroy();
    this.chartInstance = null;
  }
}
