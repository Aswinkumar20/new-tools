import { Injectable } from '@angular/core';
import { PdfJsLoaderService, type PdfJsDocument } from './pdf-js-loader.service';

type PdfRenderTask = {
  promise: Promise<void>;
  cancel?: () => void;
};

@Injectable({ providedIn: 'root' })
export class PdfPreviewService {
  private cachedDoc: PdfJsDocument | null = null;
  private cachedBytesRef: Uint8Array | null = null;
  private pendingDocumentLoad: { bytes: Uint8Array; promise: Promise<PdfJsDocument> } | null = null;
  private readonly canvasGenerations = new WeakMap<HTMLCanvasElement, number>();
  private readonly activeCanvasRenders = new WeakMap<HTMLCanvasElement, PdfRenderTask>();

  constructor(private readonly pdfJsLoader: PdfJsLoaderService) {}

  async getDocument(bytes: Uint8Array): Promise<PdfJsDocument> {
    const data = new Uint8Array(bytes);
    if (this.cachedDoc && this.cachedBytesRef && this.sameBytes(this.cachedBytesRef, data)) {
      return this.cachedDoc;
    }
    if (
      this.pendingDocumentLoad &&
      this.sameBytes(this.pendingDocumentLoad.bytes, data)
    ) {
      return this.pendingDocumentLoad.promise;
    }

    const promise = this.loadDocument(data);
    this.pendingDocumentLoad = { bytes: data, promise };
    try {
      return await promise;
    } finally {
      if (this.pendingDocumentLoad?.promise === promise) {
        this.pendingDocumentLoad = null;
      }
    }
  }

  private async loadDocument(data: Uint8Array): Promise<PdfJsDocument> {
    if (this.cachedDoc?.destroy) {
      try {
        this.cachedDoc.destroy();
      } catch {
        /* ignore */
      }
    }
    const pdfjs = await this.pdfJsLoader.getPdfJs();
    const loadingTask = pdfjs.getDocument({ data });
    this.cachedDoc = await loadingTask.promise;
    this.cachedBytesRef = data;
    return this.cachedDoc;
  }

  private sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    if (a.byteLength < 16) {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }
    return a[0] === b[0] && a[a.length - 1] === b[b.length - 1] && a.length === b.length;
  }

  clearCache(): void {
    this.pendingDocumentLoad = null;
    if (this.cachedDoc?.destroy) {
      try {
        this.cachedDoc.destroy();
      } catch {
        /* ignore */
      }
    }
    this.cachedDoc = null;
    this.cachedBytesRef = null;
  }

  private nextCanvasGeneration(canvas: HTMLCanvasElement): number {
    const generation = (this.canvasGenerations.get(canvas) ?? 0) + 1;
    this.canvasGenerations.set(canvas, generation);
    return generation;
  }

  private isStaleCanvasRender(canvas: HTMLCanvasElement, generation: number): boolean {
    return this.canvasGenerations.get(canvas) !== generation;
  }

  private async cancelCanvasRender(canvas: HTMLCanvasElement): Promise<void> {
    const active = this.activeCanvasRenders.get(canvas);
    if (!active) return;

    this.activeCanvasRenders.delete(canvas);
    if (active.cancel) {
      try {
        active.cancel();
      } catch {
        /* ignore */
      }
    }

    try {
      await active.promise;
    } catch {
      /* RenderingCancelledException or superseded render */
    }
  }

  private isRenderCancelledError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const name = error.name?.toLowerCase() ?? '';
    const message = error.message.toLowerCase();
    return (
      name.includes('renderingcancelled') ||
      message.includes('cancelled') ||
      message.includes('cancel') ||
      message.includes('same canvas')
    );
  }

  async renderPageToCanvas(
    bytes: Uint8Array,
    pageNumber: number,
    canvas: HTMLCanvasElement,
    maxWidth?: number
  ): Promise<void> {
    const generation = this.nextCanvasGeneration(canvas);
    await this.cancelCanvasRender(canvas);

    const doc = await this.getDocument(bytes);
    if (this.isStaleCanvasRender(canvas, generation)) return;

    if (pageNumber < 1 || pageNumber > doc.numPages) {
      throw new Error(`Page ${pageNumber} is out of range (1–${doc.numPages})`);
    }

    const page = await doc.getPage(pageNumber);
    if (this.isStaleCanvasRender(canvas, generation)) return;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize preview canvas');
    }

    const parent = canvas.parentElement;
    let containerWidth = maxWidth ?? parent?.clientWidth ?? 0;
    if (containerWidth < 64) {
      const viewportWidth = globalThis.innerWidth ?? 800;
      containerWidth = Math.min(720, Math.max(320, viewportWidth - 48));
    }

    const viewportAt1 = page.getViewport({ scale: 1 });
    const scale = Math.max(0.15, (containerWidth - 32) / viewportAt1.width);
    const viewport = page.getViewport({ scale });

    const dpr = globalThis.devicePixelRatio ?? 1;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.display = 'block';
    canvas.style.minHeight = '120px';
    canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
    canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(dpr, dpr);

    if (this.isStaleCanvasRender(canvas, generation)) return;

    const renderTask = page.render({ canvasContext: context, viewport }) as PdfRenderTask;
    this.activeCanvasRenders.set(canvas, renderTask);

    try {
      await renderTask.promise;
      if (this.isStaleCanvasRender(canvas, generation)) return;
    } catch (error) {
      if (this.isStaleCanvasRender(canvas, generation) || this.isRenderCancelledError(error)) {
        return;
      }
      throw error;
    } finally {
      if (this.activeCanvasRenders.get(canvas) === renderTask) {
        this.activeCanvasRenders.delete(canvas);
      }
    }
  }

  async renderThumbnail(bytes: Uint8Array, pageNumber: number, maxWidth = 120): Promise<string> {
    const doc = await this.getDocument(bytes);
    const page = await doc.getPage(pageNumber);
    const viewportAt1 = page.getViewport({ scale: 1 });
    const scale = maxWidth / viewportAt1.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await (page.render({ canvasContext: ctx, viewport }) as PdfRenderTask).promise;
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  async extractPageText(bytes: Uint8Array, pageNumber: number): Promise<string> {
    const doc = await this.getDocument(bytes);
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items.map((item) => item.str).join(' ');
  }

  async extractAllText(bytes: Uint8Array): Promise<string> {
    const doc = await this.getDocument(bytes);
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      parts.push(`--- Page ${i} ---\n${await this.extractPageText(bytes, i)}`);
    }
    return parts.join('\n\n');
  }
}
