import { Injectable } from '@angular/core';
import {
  loadAutoTable,
  loadHtml2Canvas,
  loadJsBarcode,
  loadJsPDF,
  loadQrCode,
  type JsPdfDocument,
} from '../shared/pdf-jspdf-loader';

export type PageNumberPosition =
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'top-left'
  | 'top-center'
  | 'top-right';

export interface TextToPdfOptions {
  fontSize?: number;
  margin?: number;
  title?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  companyName: string;
  companyAddress: string;
  customerName: string;
  customerAddress: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  taxRate: number;
  items: InvoiceLineItem[];
  notes?: string;
}

export interface ResumeData {
  name: string;
  email: string;
  phone: string;
  summary: string;
  experience: string;
  education: string;
}

export interface ChartPdfData {
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  title: string;
  labels: string[];
  datasets: Array<{ label: string; data: number[] }>;
}

@Injectable({ providedIn: 'root' })
export class PdfJspdfService {
  private drawWrappedLines(pdf: JsPdfDocument, text: string, x: number, startY: number, maxWidth: number, lineHeight: number): void {
    pdf.splitTextToSize(text, maxWidth).forEach((line: string, i: number) => {
      pdf.text(line, x, startY + i * lineHeight);
    });
  }

  async createFromText(text: string, options: TextToPdfOptions = {}): Promise<Uint8Array> {
    const jsPDF = await loadJsPDF();
    const fontSize = options.fontSize ?? 12;
    const margin = options.margin ?? 20;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    if (options.title) {
      pdf.setProperties({ title: options.title });
    }
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    const lines = pdf.splitTextToSize(text, maxWidth);
    let y = margin;
    const lineHeight = fontSize * 0.45;
    pdf.setFontSize(fontSize);
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += lineHeight;
    }
    return new Uint8Array(pdf.output('arraybuffer'));
  }

  async createFromHtml(html: string): Promise<Uint8Array> {
    const html2canvas = await loadHtml2Canvas();
    const jsPDF = await loadJsPDF();

    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;left:-10000px;top:0;width:794px;padding:24px;background:#fff;color:#111;font-family:system-ui,sans-serif;box-sizing:border-box;';
    host.innerHTML = html;
    document.body.appendChild(host);

    try {
      const canvas = await html2canvas(host, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = pageWidth / imgProps.width;
      const imgHeightMm = imgProps.height * ratio;
      let position = 0;
      let remaining = imgHeightMm;

      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeightMm);
      remaining -= pageHeight;

      while (remaining > 0) {
        position = remaining - imgHeightMm;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeightMm);
        remaining -= pageHeight;
      }

      return new Uint8Array(pdf.output('arraybuffer'));
    } finally {
      host.remove();
    }
  }

  async createTablePdf(headers: string[], rows: string[][], title?: string): Promise<Uint8Array> {
    const applyAutoTable = await loadAutoTable();
    const jsPDF = await loadJsPDF();
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' }) as JsPdfDocument;
    if (title) {
      pdf.setFontSize(16);
      pdf.text(title, 14, 18);
    }
    applyAutoTable(pdf, {
      head: [headers],
      body: rows,
      startY: title ? 26 : 14,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [0, 123, 255] },
    });
    return new Uint8Array(pdf.output('arraybuffer'));
  }

  async createChartPdf(_data: ChartPdfData, canvas: HTMLCanvasElement): Promise<Uint8Array> {
    const jsPDF = await loadJsPDF();
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    pdf.setFontSize(16);
    pdf.text(_data.title, 14, 16);
    const img = canvas.toDataURL('image/png', 1);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const w = pageWidth - 28;
    const h = pageHeight - 36;
    pdf.addImage(img, 'PNG', 14, 22, w, h);
    return new Uint8Array(pdf.output('arraybuffer'));
  }

  async createResumePdf(data: ResumeData): Promise<Uint8Array> {
    const jsPDF = await loadJsPDF();
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 20;
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text(data.name, 20, y);
    y += 10;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${data.email}  |  ${data.phone}`, 20, y);
    y += 12;
    const sections: Array<[string, string]> = [
      ['SUMMARY', data.summary],
      ['EXPERIENCE', data.experience],
      ['EDUCATION', data.education],
    ];
    for (const [heading, body] of sections) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(heading, 20, y);
      y += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(body || '—', 170);
      for (const line of lines) {
        if (y > 275) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(line, 20, y);
        y += 5;
      }
      y += 6;
    }
    pdf.setProperties({ title: `${data.name} - Resume` });
    return new Uint8Array(pdf.output('arraybuffer'));
  }

  async createInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
    const applyAutoTable = await loadAutoTable();
    const jsPDF = await loadJsPDF();
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' }) as JsPdfDocument;

    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INVOICE', 14, 18);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.companyName, 14, 28);
    this.drawWrappedLines(pdf, data.companyAddress, 14, 34, 80, 5);

    pdf.text(`Invoice #: ${data.invoiceNumber}`, 140, 28);
    pdf.text(`Date: ${data.invoiceDate}`, 140, 34);
    pdf.text(`Due: ${data.dueDate}`, 140, 40);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Bill To', 14, 58);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.customerName, 14, 64);
    this.drawWrappedLines(pdf, data.customerAddress, 14, 70, 80, 5);

    const body = data.items.map((item) => [
      item.description,
      String(item.quantity),
      item.unitPrice.toFixed(2),
      (item.quantity * item.unitPrice).toFixed(2),
    ]);
    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tax = subtotal * (data.taxRate / 100);
    const total = subtotal + tax;

    applyAutoTable(pdf, {
      head: [['Description', 'Qty', 'Unit Price', 'Amount']],
      body,
      startY: 88,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 123, 255] },
    });

    const finalY = pdf.lastAutoTable?.finalY ?? 120;
    pdf.text(`Subtotal: $${subtotal.toFixed(2)}`, 140, finalY + 10);
    pdf.text(`Tax (${data.taxRate}%): $${tax.toFixed(2)}`, 140, finalY + 16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Total: $${total.toFixed(2)}`, 140, finalY + 24);

    if (data.notes) {
      pdf.setFont('helvetica', 'normal');
      pdf.text('Notes:', 14, finalY + 34);
      this.drawWrappedLines(pdf, data.notes, 14, finalY + 40, 170, 5);
    }

    return new Uint8Array(pdf.output('arraybuffer'));
  }

  async createBarcodePdf(value: string, format: string): Promise<Uint8Array> {
    const JsBarcode = await loadJsBarcode();
    const jsPDF = await loadJsPDF();
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, value, { format: format || 'CODE128', displayValue: true, margin: 12, height: 80 });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFontSize(14);
    pdf.text('Barcode', 14, 18);
    pdf.addImage(img, 'PNG', 14, 24, 180, 50);
    return new Uint8Array(pdf.output('arraybuffer'));
  }

  async createQrCodePdf(value: string): Promise<Uint8Array> {
    const QRCode = await loadQrCode();
    const jsPDF = await loadJsPDF();
    const dataUrl = await QRCode.toDataURL(value, { width: 400, margin: 2, errorCorrectionLevel: 'M' });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFontSize(14);
    pdf.text('QR Code', 14, 18);
    pdf.addImage(dataUrl, 'PNG', 14, 24, 80, 80);
    pdf.setFontSize(10);
    this.drawWrappedLines(pdf, value, 14, 112, 180, 5);
    return new Uint8Array(pdf.output('arraybuffer'));
  }
}
