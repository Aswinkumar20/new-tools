import { Injectable } from '@angular/core';
import { PDFJS_WORKER_SRC } from '../shared/pdf.utils';

@Injectable({ providedIn: 'root' })
export class PdfJsLoaderService {
  private loadPromise: Promise<PdfJsLib> | null = null;

  async getPdfJs(): Promise<PdfJsLib> {
    if (globalThis.window === undefined) {
      throw new TypeError('PDF.js is only available in the browser');
    }
    this.loadPromise ??= this.importPdfJs();
    return this.loadPromise;
  }

  private async importPdfJs(): Promise<PdfJsLib> {
    const pdfjs = (await import('pdfjs-dist')) as unknown as PdfJsLib;
    if (!pdfjs?.getDocument) {
      throw new Error('PDF.js failed to initialize');
    }
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
    return pdfjs;
  }
}

export interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: {
    data?: Uint8Array;
    url?: string;
    password?: string;
    passwordCallback?: (
      updatePassword: (password: string) => void,
      reason: unknown
    ) => void | Promise<string>;
  }) => {
    promise: Promise<PdfJsDocument>;
  };
  version: string;
  PasswordResponses?: {
    NEED_PASSWORD: number;
    INCORRECT_PASSWORD: number;
  };
}

export interface PdfJsDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy?: () => void;
}

export interface PdfJsPage {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => {
    promise: Promise<void>;
    cancel?: () => void;
  };
  getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
}
