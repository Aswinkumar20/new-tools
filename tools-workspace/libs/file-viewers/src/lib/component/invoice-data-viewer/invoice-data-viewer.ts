import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  INVOICE_DATA_ACCEPT_ATTR,
  INVOICE_DATA_DESCRIPTION,
  INVOICE_DATA_FORMATS_LABEL,
  INVOICE_DATA_HELP_ITEMS,
  INVOICE_DATA_RELATED_TOOLS,
  INVOICE_DATA_TITLE
} from '../../constants/invoice-data-viewer.constants';
import {
  isInvoiceFile,
  parseInvoiceContent,
  resolveInvoiceSuggestion,
  type InvoiceData,
  type InvoiceLineItem
} from '../../utils/invoice-data-viewer.utils';

@Component({
  selector: 'lib-invoice-data-viewer',
  standalone: true,
  templateUrl: './invoice-data-viewer.html',
  styleUrls: ['./invoice-data-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceDataViewerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly title = INVOICE_DATA_TITLE;
  readonly description = INVOICE_DATA_DESCRIPTION;
  readonly acceptAttr = INVOICE_DATA_ACCEPT_ATTR;
  readonly formatsLabel = INVOICE_DATA_FORMATS_LABEL;
  readonly helpItems = INVOICE_DATA_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = INVOICE_DATA_RELATED_TOOLS;

  fileName = '';
  invoice: InvoiceData | null = null;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;

  private dragDepth = 0;

  get lineItemCount(): number {
    return this.invoice?.lineItems.length ?? 0;
  }

  get headerFields(): Array<{ label: string; value: string }> {
    if (!this.invoice) {
      return [];
    }
    return [
      { label: 'Invoice #', value: this.invoice.invoiceNumber },
      { label: 'Issue date', value: this.invoice.issueDate },
      { label: 'Due date', value: this.invoice.dueDate },
      { label: 'Vendor', value: this.invoice.vendor },
      { label: 'Customer', value: this.invoice.customer },
      { label: 'Currency', value: this.invoice.currency }
    ];
  }

  get primarySuggestion() {
    const suggestion = resolveInvoiceSuggestion({
      hasInvoice: !!this.invoice,
      hasError: !!this.errorMessage
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnDestroy(): void {
    this.dragDepth = 0;
  }

  formatMoney(value: number): string {
    const currency = this.invoice?.currency;
    if (currency && currency !== '—') {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
      } catch {
        return `${currency} ${value.toFixed(2)}`;
      }
    }
    return value.toFixed(2);
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
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
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      await this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  async handleFiles(files: File[]): Promise<void> {
    const valid = files.filter(isInvoiceFile);
    if (!valid.length) {
      this.errorMessage = `Please upload ${this.formatsLabel} invoice data.`;
      this.dismissedSuggestionId = null;
      this.toast.error(this.errorMessage);
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      const file = valid[0];
      const content = await file.text();
      this.invoice = parseInvoiceContent(content, file.name);
      this.fileName = file.name;
      this.toast.success(`Loaded ${file.name}`);
    } catch (error) {
      this.invoice = null;
      this.fileName = '';
      this.errorMessage =
        error instanceof Error ? error.message : 'Failed to parse invoice file.';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  clearAll(): void {
    this.invoice = null;
    this.fileName = '';
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.toast.info('Invoice cleared');
    this.cdr.markForCheck();
  }

  trackByLineItem(_: number, item: InvoiceLineItem): string {
    return `${item.description}:${item.amount}`;
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types.includes('Files');
  }
}
