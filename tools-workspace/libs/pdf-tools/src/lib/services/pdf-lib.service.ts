import { Injectable } from '@angular/core';
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  type PDFForm,
} from 'pdf-lib';
import type {
  AnnotationDraft,
  PdfFormFieldInfo,
  PdfMetadataInfo,
  PdfPageState,
  WatermarkOptions,
} from '../shared/pdf.types';
import { bytesToBase64, isPasswordError } from '../shared/pdf.utils';

@Injectable({ providedIn: 'root' })
export class PdfLibService {
  async loadDocument(bytes: Uint8Array, password?: string): Promise<PDFDocument> {
    try {
      return await PDFDocument.load(bytes, { ignoreEncryption: !!password });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isPasswordError(message)) {
        throw new PasswordRequiredError(
          'Encrypted PDFs have limited support in pdf-lib. Try an unencrypted copy or use ignore-encryption load.'
        );
      }
      throw error;
    }
  }

  async saveDocument(doc: PDFDocument, options?: { useObjectStreams?: boolean }): Promise<Uint8Array> {
    return doc.save({
      useObjectStreams: options?.useObjectStreams ?? true,
    });
  }

  async buildFromPageStates(source: PDFDocument, pages: PdfPageState[]): Promise<PDFDocument> {
    const out = await PDFDocument.create();
    const indices = pages.map((p) => p.sourceIndex);
    const copied = await out.copyPages(source, indices);
    for (let i = 0; i < copied.length; i++) {
      const page = copied[i];
      const rot = pages[i].rotation;
      if (rot) page.setRotation(degrees(rot));
      out.addPage(page);
    }
    return out;
  }

  async deletePages(source: PDFDocument, pages: PdfPageState[], deleteSelected: boolean): Promise<PDFDocument> {
    const kept = pages.filter((p) => (deleteSelected ? !p.selected : p.selected));
    if (!kept.length) throw new Error('No pages remain after deletion');
    return this.buildFromPageStates(source, kept);
  }

  async extractPages(source: PDFDocument, pages: PdfPageState[]): Promise<PDFDocument> {
    const selected = pages.filter((p) => p.selected);
    if (!selected.length) throw new Error('Select at least one page to extract');
    return this.buildFromPageStates(source, selected);
  }

  async reorderPages(source: PDFDocument, pages: PdfPageState[]): Promise<PDFDocument> {
    return this.buildFromPageStates(source, pages);
  }

  async rotatePagesInPlace(pages: PdfPageState[], pageIndex: number, delta: 90 | -90): Promise<void> {
    const page = pages[pageIndex];
    if (!page) return;
    const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
    const current = rotations.indexOf(page.rotation);
    const next = (current + (delta === 90 ? 1 : 3)) % 4;
    page.rotation = rotations[next];
  }

  async mergeDocuments(docs: PDFDocument[]): Promise<PDFDocument> {
    const merged = await PDFDocument.create();
    for (const doc of docs) {
      const copied = await merged.copyPages(doc, doc.getPageIndices());
      for (const page of copied) merged.addPage(page);
    }
    return merged;
  }

  async splitByRanges(source: PDFDocument, ranges: number[][]): Promise<Uint8Array[]> {
    const outputs: Uint8Array[] = [];
    for (const indices of ranges) {
      const part = await PDFDocument.create();
      const copied = await part.copyPages(source, indices);
      for (const page of copied) part.addPage(page);
      outputs.push(await part.save());
    }
    return outputs;
  }

  applyAnnotations(doc: PDFDocument, annotations: AnnotationDraft[]): void {
    for (const ann of annotations) {
      const page = doc.getPage(ann.pageIndex);
      const color = ann.color ? rgb(ann.color.r, ann.color.g, ann.color.b) : rgb(0, 0, 0);
      const opacity = ann.opacity ?? 1;
      if (ann.type === 'text' && ann.text) {
        page.drawText(ann.text, {
          x: ann.x,
          y: ann.y,
          size: ann.fontSize ?? 12,
          color,
          opacity,
        });
      } else if (ann.type === 'rectangle' || ann.type === 'highlight') {
        page.drawRectangle({
          x: ann.x,
          y: ann.y,
          width: ann.width ?? 100,
          height: ann.height ?? 20,
          color: ann.type === 'highlight' ? rgb(1, 1, 0) : color,
          opacity: ann.type === 'highlight' ? 0.35 : opacity,
          borderWidth: ann.type === 'rectangle' ? 1 : 0,
          borderColor: color,
        });
      } else if (ann.type === 'line' && ann.x2 != null && ann.y2 != null) {
        page.drawLine({
          start: { x: ann.x, y: ann.y },
          end: { x: ann.x2, y: ann.y2 },
          thickness: 2,
          color,
          opacity,
        });
      }
    }
  }

  async addWatermark(doc: PDFDocument, options: WatermarkOptions): Promise<void> {
    const pages = doc.getPages();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const page of pages) {
      const { width, height } = page.getSize();
      if (options.type === 'text' && options.text) {
        const fontSize = options.fontSize ?? 48;
        const textWidth = font.widthOfTextAtSize(options.text, fontSize);
        page.drawText(options.text, {
          x: (width - textWidth) / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(0.7, 0.7, 0.7),
          opacity: options.opacity ?? 0.3,
          rotate: degrees(options.rotation ?? -45),
        });
      } else if (options.type === 'image' && options.imageBytes) {
        const image = await doc.embedPng(options.imageBytes).catch(() => doc.embedJpg(options.imageBytes!));
        const scale = Math.min(width / image.width, height / image.height) * 0.5;
        const w = image.width * scale;
        const h = image.height * scale;
        page.drawImage(image, {
          x: (width - w) / 2,
          y: (height - h) / 2,
          width: w,
          height: h,
          opacity: options.opacity ?? 0.25,
        });
      }
    }
  }

  readMetadata(doc: PDFDocument): PdfMetadataInfo {
    return {
      title: doc.getTitle() ?? '',
      author: doc.getAuthor() ?? '',
      subject: doc.getSubject() ?? '',
      keywords: this.formatKeywords(doc.getKeywords()),
      creator: doc.getCreator() ?? '',
      producer: doc.getProducer() ?? '',
      creationDate: doc.getCreationDate(),
      modificationDate: doc.getModificationDate(),
    };
  }

  writeMetadata(doc: PDFDocument, meta: Partial<PdfMetadataInfo>): void {
    if (meta.title !== undefined) doc.setTitle(meta.title);
    if (meta.author !== undefined) doc.setAuthor(meta.author);
    if (meta.subject !== undefined) doc.setSubject(meta.subject);
    if (meta.keywords !== undefined) {
      doc.setKeywords(meta.keywords.split(',').map((k) => k.trim()).filter(Boolean));
    }
    if (meta.creator !== undefined) doc.setCreator(meta.creator);
    if (meta.producer !== undefined) doc.setProducer(meta.producer);
  }

  listFormFields(doc: PDFDocument): PdfFormFieldInfo[] {
    let form: PDFForm;
    try {
      form = doc.getForm();
    } catch {
      return [];
    }
    return form.getFields().map((field) => {
      let value = '';
      const name = field.getName();
      const ctor = field.constructor.name;
      try {
        if (field instanceof PDFTextField) value = field.getText() ?? '';
        else if (field instanceof PDFCheckBox) value = field.isChecked() ? 'checked' : 'unchecked';
        else if (field instanceof PDFDropdown) value = field.getSelected()?.[0] ?? '';
        else if (field instanceof PDFOptionList) value = field.getSelected()?.[0] ?? '';
        else if (field instanceof PDFRadioGroup) value = field.getSelected() ?? '';
      } catch {
        value = '';
      }
      return { name, type: ctor.replace(/^PDF/, '').replace(/Field$/, '') || 'Field', value };
    });
  }

  fillFormField(doc: PDFDocument, fieldName: string, value: string): void {
    const form = doc.getForm();
    try {
      form.getTextField(fieldName).setText(value);
      return;
    } catch {
      /* not a text field */
    }
    try {
      const cb = form.getCheckBox(fieldName);
      value === 'true' || value === 'checked' ? cb.check() : cb.uncheck();
      return;
    } catch {
      /* not checkbox */
    }
    try {
      form.getDropdown(fieldName).select(value);
      return;
    } catch {
      /* not dropdown */
    }
    try {
      form.getOptionList(fieldName).select(value);
      return;
    } catch {
      /* not option list */
    }
    try {
      form.getRadioGroup(fieldName).select(value);
      return;
    } catch {
      /* not radio */
    }
    throw new Error(`Field not found or unsupported: ${fieldName}`);
  }

  async flattenForm(doc: PDFDocument): Promise<void> {
    const form = doc.getForm();
    form.flatten();
  }

  async createFromText(text: string, title?: string): Promise<PDFDocument> {
    const doc = await PDFDocument.create();
    if (title) doc.setTitle(title);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    const margin = 50;
    const lineHeight = fontSize * 1.4;
    const pageWidth = 595;
    const pageHeight = 842;
    const maxWidth = pageWidth - margin * 2;
    let page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    const paragraphs = text.split(/\r?\n/);
    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        const width = font.widthOfTextAtSize(test, fontSize);
        if (width > maxWidth && line) {
          if (y < margin + lineHeight) {
            page = doc.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
          page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
          y -= lineHeight;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) {
        if (y < margin + lineHeight) {
          page = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
        y -= lineHeight;
      }
      y -= lineHeight * 0.3;
    }
    return doc;
  }

  async createFromPlainHtml(html: string): Promise<PDFDocument> {
    const parser = new DOMParser();
    const docHtml = parser.parseFromString(html, 'text/html');
    const text = docHtml.body.textContent?.trim() ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return this.createFromText(text, 'HTML Export');
  }

  async createFromImages(images: Uint8Array[], mimeTypes: string[]): Promise<PDFDocument> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < images.length; i++) {
      const bytes = images[i];
      const mime = mimeTypes[i] ?? 'image/png';
      const embedded = mime.includes('jpeg') || mime.includes('jpg')
        ? await doc.embedJpg(bytes)
        : await doc.embedPng(bytes);
      const page = doc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    }
    return doc;
  }

  async createTablePdf(headers: string[], rows: string[][], title?: string): Promise<PDFDocument> {
    const doc = await PDFDocument.create();
    if (title) doc.setTitle(title);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 40;
    let page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    if (title) {
      page.drawText(title, { x: margin, y, size: 16, font: bold, color: rgb(0, 0, 0) });
      y -= 30;
    }
    const colCount = headers.length;
    const colWidth = (pageWidth - margin * 2) / colCount;
    const rowHeight = 22;
    const drawRow = (cells: string[], header = false) => {
      if (y < margin + rowHeight) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      for (let c = 0; c < colCount; c++) {
        const cell = cells[c] ?? '';
        page.drawRectangle({
          x: margin + c * colWidth,
          y: y - rowHeight,
          width: colWidth,
          height: rowHeight,
          borderWidth: 0.5,
          borderColor: rgb(0.6, 0.6, 0.6),
        });
        page.drawText(cell.slice(0, 24), {
          x: margin + c * colWidth + 4,
          y: y - rowHeight + 6,
          size: 9,
          font: header ? bold : font,
          color: rgb(0, 0, 0),
        });
      }
      y -= rowHeight;
    };
    drawRow(headers, true);
    for (const row of rows) drawRow(row);
    return doc;
  }

  async createResumePdf(data: {
    name: string;
    email: string;
    phone: string;
    summary: string;
    experience: string;
    education: string;
  }): Promise<PDFDocument> {
    const text = [
      data.name,
      `${data.email} | ${data.phone}`,
      '',
      'SUMMARY',
      data.summary,
      '',
      'EXPERIENCE',
      data.experience,
      '',
      'EDUCATION',
      data.education,
    ].join('\n');
    const doc = await this.createFromText(text, `${data.name} - Resume`);
    return doc;
  }

  toBase64(bytes: Uint8Array): string {
    return bytesToBase64(bytes);
  }

  private formatKeywords(keywords: string | string[] | undefined): string {
    if (!keywords) return '';
    return Array.isArray(keywords) ? keywords.join(', ') : keywords;
  }

  /** Basic optimization: re-save with object streams (limited compression) */
  async optimizePdf(doc: PDFDocument): Promise<Uint8Array> {
    return doc.save({ useObjectStreams: true });
  }

  async addPageNumbers(
    doc: PDFDocument,
    options: {
      position: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right';
      fontSize: number;
      startNumber: number;
      format: 'number' | 'page-of-total';
    },
  ): Promise<void> {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const total = pages.length;
    const margin = 36;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const num = options.startNumber + i;
      const text =
        options.format === 'page-of-total' ? `Page ${num} of ${total}` : String(num);
      const textWidth = font.widthOfTextAtSize(text, options.fontSize);
      let x = margin;
      let y = margin;

      switch (options.position) {
        case 'bottom-left':
          x = margin;
          y = margin;
          break;
        case 'bottom-center':
          x = (width - textWidth) / 2;
          y = margin;
          break;
        case 'bottom-right':
          x = width - margin - textWidth;
          y = margin;
          break;
        case 'top-left':
          x = margin;
          y = height - margin - options.fontSize;
          break;
        case 'top-center':
          x = (width - textWidth) / 2;
          y = height - margin - options.fontSize;
          break;
        case 'top-right':
          x = width - margin - textWidth;
          y = height - margin - options.fontSize;
          break;
      }

      page.drawText(text, {
        x,
        y,
        size: options.fontSize,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
  }
}

export class PasswordRequiredError extends Error {
  override name = 'PasswordRequiredError';
}
