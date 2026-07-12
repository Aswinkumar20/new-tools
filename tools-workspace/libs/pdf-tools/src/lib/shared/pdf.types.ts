import type { PDFDocument } from 'pdf-lib';

export type PdfToolMode =
  | 'delete-pages'
  | 'rotate-pages'
  | 'reorder-pages'
  | 'extract-pages'
  | 'compress-pdf'
  | 'annotate-pdf'
  | 'highlight-text'
  | 'add-watermark'
  | 'fill-pdf-forms'
  | 'flatten-pdf-forms'
  | 'pdf-metadata-editor'
  | 'pdf-to-base64'
  | 'password-protect-pdf'
  | 'text-to-pdf'
  | 'create-pdf-from-html'
  | 'screenshot-to-pdf'
  | 'image-to-pdf'
  | 'tables-charts-to-pdf'
  | 'resume-invoice-generator'
  | 'add-page-numbers';

export type PdfJspdfToolMode =
  | 'html-to-pdf'
  | 'tables-to-pdf'
  | 'charts-to-pdf'
  | 'resume-generator'
  | 'invoice-generator'
  | 'barcode-to-pdf'
  | 'qr-code-to-pdf'
  | 'text-to-pdf';

export type PageRotation = 0 | 90 | 180 | 270;

export interface PdfPageState {
  /** Original 0-based index in the loaded document */
  sourceIndex: number;
  rotation: PageRotation;
  selected: boolean;
}

export interface PdfFormFieldInfo {
  name: string;
  type: string;
  value: string;
}

export interface PdfMetadataInfo {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate?: Date;
  modificationDate?: Date;
}

export interface PdfLoadedDocument {
  file: File;
  name: string;
  size: number;
  bytes: Uint8Array;
  doc: PDFDocument;
  password?: string;
}

export interface AnnotationDraft {
  type: 'text' | 'rectangle' | 'highlight' | 'line';
  pageIndex: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  text?: string;
  fontSize?: number;
  color?: { r: number; g: number; b: number };
  opacity?: number;
}

export interface WatermarkOptions {
  type: 'text' | 'image';
  text?: string;
  fontSize?: number;
  opacity?: number;
  rotation?: number;
  imageBytes?: Uint8Array;
}
