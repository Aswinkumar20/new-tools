import { Injectable } from '@angular/core';
import { PDF_JS_CDN, PDF_JS_WORKER_CDN } from '../shared/pdf.utils';

@Injectable({ providedIn: 'root' })
export class PdfJsLoaderService {
  private loadPromise: Promise<PdfJsLib> | null = null;

  async getPdfJs(): Promise<PdfJsLib> {
    if (globalThis.window === undefined) {
      throw new TypeError('PDF.js is only available in the browser');
    }
    if ((globalThis as PdfJsGlobal).pdfjsLib) {
      return (globalThis as PdfJsGlobal).pdfjsLib!;
    }
    if (!this.loadPromise) {
      this.loadPromise = this.injectScript();
    }
    return this.loadPromise;
  }

  private injectScript(): Promise<PdfJsLib> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDF_JS_CDN;
      script.async = true;
      script.onload = () => {
        const pdfjs = (globalThis as PdfJsGlobal).pdfjsLib;
        if (!pdfjs) {
          reject(new Error('PDF.js failed to initialize'));
          return;
        }
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_CDN;
        resolve(pdfjs);
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(script);
    });
  }
}

export interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { data?: Uint8Array; url?: string; password?: string }) => {
    promise: Promise<PdfJsDocument>;
  };
  version: string;
}

export interface PdfJsDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy?: () => void;
}

export interface PdfJsPage {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
    promise: Promise<void>;
    cancel?: () => void;
  };
  getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
}

interface PdfJsGlobal {
  pdfjsLib?: PdfJsLib;
}
