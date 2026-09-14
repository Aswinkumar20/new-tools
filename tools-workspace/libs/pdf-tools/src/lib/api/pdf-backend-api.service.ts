import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PDF_BACKEND_CONFIG, type PdfBackendConfig } from './pdf-backend.config';
import { encodeSensitivePayload } from './sensitive-payload';

export interface PdfJobStatusResponse {
  jobId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | string;
  operation?: string;
  total?: number;
  completed?: number;
  failed?: number;
  progress?: number;
  message?: string;
  downloadReady?: boolean;
  resultFilename?: string;
  resultContentType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PdfHealthResponse {
  status: string;
  service: string;
  version: string;
  jobStore?: string;
  engines?: {
    qpdf?: boolean;
    ghostscript?: boolean;
    libreOffice?: boolean;
    chromium?: boolean;
    tesseract?: boolean;
  };
  capabilities?: {
    officeToPdf?: boolean;
    pdfA?: boolean;
    webOptimize?: boolean;
    urlToPdf?: boolean;
    ocr?: boolean;
    preview?: boolean;
    maxPages?: number;
  };
}

@Injectable({ providedIn: 'root' })
export class PdfBackendApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(PDF_BACKEND_CONFIG);
  private healthCache: PdfHealthResponse | null = null;
  private healthCacheAt = 0;

  get settings(): PdfBackendConfig {
    return this.config;
  }

  health(): Observable<PdfHealthResponse> {
    return this.http.get<PdfHealthResponse>(`${this.config.baseUrl}/health`);
  }

  /** Cached PDF health (engines/capabilities) for honesty UX. */
  async healthDetailed(force = false): Promise<PdfHealthResponse | null> {
    const now = Date.now();
    if (!force && this.healthCache && now - this.healthCacheAt < 60_000) {
      return this.healthCache;
    }
    try {
      const h = await firstValueFrom(this.health());
      this.healthCache = h;
      this.healthCacheAt = now;
      return h;
    } catch {
      return this.healthCache;
    }
  }

  encrypt(
    file: Blob,
    options: {
      userPassword: string;
      ownerPassword?: string;
      allowPrint?: boolean;
      allowModify?: boolean;
      fileName?: string;
    }
  ): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, options.fileName || 'document.pdf');
    form.append('userPassword', encodeSensitivePayload(options.userPassword));
    if (options.ownerPassword) {
      form.append('ownerPassword', encodeSensitivePayload(options.ownerPassword));
    }
    form.append('allowPrint', String(options.allowPrint ?? true));
    form.append('allowModify', String(options.allowModify ?? false));
    return this.postBlob('/encrypt', form);
  }

  decrypt(file: Blob, password: string, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('password', encodeSensitivePayload(password));
    return this.postBlob('/decrypt', form);
  }

  compress(file: Blob, quality: 'low' | 'medium' | 'high' = 'medium', fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('quality', quality);
    return this.postBlob('/compress', form);
  }

  merge(files: File[]): Promise<Blob> {
    const form = new FormData();
    files.forEach((f, i) => form.append('files', f, f.name || `file-${i}.pdf`));
    return this.postBlob('/merge', form);
  }

  /** Slice 7 — async large merge; poll getJobStatus then downloadJob. */
  mergeAsync(files: File[]): Promise<PdfJobStatusResponse> {
    const form = new FormData();
    files.forEach((f, i) => form.append('files', f, f.name || `file-${i}.pdf`));
    return this.submitJob('/merge-async', form);
  }

  extract(file: Blob, pages: string, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('pages', pages);
    return this.postBlob('/extract', form);
  }

  deletePages(file: Blob, pages: string, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('pages', pages);
    return this.postBlob('/delete-pages', form);
  }

  rotate(file: Blob, degrees: number, pages?: string, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('degrees', String(degrees));
    if (pages) form.append('pages', pages);
    return this.postBlob('/rotate', form);
  }

  reorder(file: Blob, order: string, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('order', order);
    return this.postBlob('/reorder', form);
  }

  watermark(file: Blob, text: string, opacity = 0.25, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('text', text);
    form.append('opacity', String(opacity));
    return this.postBlob('/watermark', form);
  }

  pageNumbers(file: Blob, startAt = 1, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('startAt', String(startAt));
    return this.postBlob('/page-numbers', form);
  }

  metadata(
    file: Blob,
    meta: { title?: string; author?: string; subject?: string; keywords?: string },
    fileName = 'document.pdf'
  ): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    if (meta.title) form.append('title', meta.title);
    if (meta.author) form.append('author', meta.author);
    if (meta.subject) form.append('subject', meta.subject);
    if (meta.keywords) form.append('keywords', meta.keywords);
    return this.postBlob('/metadata', form);
  }

  imagesToPdf(files: File[]): Promise<Blob> {
    const form = new FormData();
    files.forEach((f, i) => form.append('files', f, f.name || `image-${i}`));
    return this.postBlob('/images-to-pdf', form);
  }

  imagesToSearchablePdf(
    files: File[],
    options: { language?: string; dpi?: number } = {}
  ): Promise<Blob> {
    const form = new FormData();
    files.forEach((f, i) => form.append('files', f, f.name || `image-${i}`));
    form.append('language', options.language || 'eng');
    form.append('dpi', String(options.dpi ?? 200));
    return this.postBlob('/images-to-searchable-pdf', form);
  }

  /** Slice 13 — open ephemeral server preview session (large / encrypted PDFs). */
  openPreviewSession(
    file: Blob,
    options: { password?: string; fileName?: string } = {}
  ): Promise<{ sessionId: string; pageCount: number; maxDpi?: number }> {
    const form = new FormData();
    form.append('file', file, options.fileName || 'document.pdf');
    if (options.password) {
      form.append('password', encodeSensitivePayload(options.password));
    }
    return this.advancedPostJson('/preview/session', form);
  }

  fetchPreviewPage(sessionId: string, page: number, dpi = 120): Promise<Blob> {
    const q = dpi > 0 ? `?dpi=${encodeURIComponent(String(dpi))}` : '';
    return firstValueFrom(
      this.http
        .get(
          `${this.config.baseUrl}/preview/${encodeURIComponent(sessionId)}/pages/${page}.png${q}`,
          { responseType: 'blob' }
        )
        .pipe(catchError((err) => this.mapError(err)))
    );
  }

  htmlToPdf(html: string): Promise<Blob> {
    const form = new FormData();
    form.append('html', html);
    return this.postBlob('/html-to-pdf', form);
  }

  textToPdf(text: string): Promise<Blob> {
    const form = new FormData();
    form.append('text', text);
    return this.postBlob('/text-to-pdf', form);
  }

  split(file: Blob, ranges: string, prefix = 'split', fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('ranges', ranges);
    form.append('prefix', prefix);
    return this.postBlob('/split', form);
  }

  /** Slice 7 — async large split. */
  splitAsync(
    file: Blob,
    ranges: string,
    prefix = 'split',
    fileName = 'document.pdf'
  ): Promise<PdfJobStatusResponse> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('ranges', ranges);
    form.append('prefix', prefix);
    return this.submitJob('/split-async', form);
  }

  /**
   * Poll a job until COMPLETED/FAILED/EXPIRED, then download the result blob.
   */
  async awaitJobDownload(
    jobId: string,
    onProgress?: (status: PdfJobStatusResponse) => void,
    timeoutMs = 10 * 60 * 1000
  ): Promise<Blob> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const status = await this.getJobStatus(jobId);
      onProgress?.(status);
      if (status.status === 'COMPLETED' && status.downloadReady) {
        return this.downloadJob(jobId);
      }
      if (status.status === 'FAILED' || status.status === 'EXPIRED') {
        throw new Error(status.message || `Job ${status.status.toLowerCase()}`);
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    throw new Error('Job timed out');
  }

  fillForm(file: Blob, fields: Record<string, string> | Array<{ name: string; value: string }>, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('fields', JSON.stringify(fields));
    return this.postBlob('/fill-form', form);
  }

  flattenForm(file: Blob, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    return this.postBlob('/flatten-form', form);
  }

  annotate(file: Blob, annotations: unknown[], fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('annotations', JSON.stringify(annotations));
    return this.postBlob('/annotate', form);
  }

  stampImage(
    file: Blob,
    image: Blob,
    options: { page: number; x: number; y: number; width: number; height: number; fileName?: string; imageName?: string }
  ): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, options.fileName || 'document.pdf');
    form.append('image', image, options.imageName || 'signature.png');
    form.append('page', String(options.page));
    form.append('x', String(options.x));
    form.append('y', String(options.y));
    form.append('width', String(options.width));
    form.append('height', String(options.height));
    return this.postBlob('/stamp-image', form);
  }

  pdfToText(file: Blob, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    return this.postBlob('/pdf-to-text', form);
  }

  pdfToImages(file: Blob, dpi = 150, fileName = 'document.pdf'): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('dpi', String(dpi <= 0 ? 150 : dpi));
    return this.postBlob('/pdf-to-images', form);
  }

  /** POST an advanced PDF tool endpoint; returns raw blob (PDF/ZIP/EPUB/etc.). */
  advancedPost(endpoint: string, form: FormData): Promise<Blob> {
    return this.postBlob(endpoint, form);
  }

  /** Alias for advancedPost — used by PdfAdvancedWorkbench. */
  advanced(endpoint: string, form: FormData): Promise<Blob> {
    return this.advancedPost(endpoint, form);
  }

  /** POST an advanced endpoint expecting a text body. */
  async advancedPostText(endpoint: string, form: FormData): Promise<string> {
    const blob = await this.postBlob(endpoint, form);
    return blob.text();
  }

  /** POST an advanced endpoint expecting a JSON body. */
  async advancedPostJson<T>(endpoint: string, form: FormData): Promise<T> {
    const text = await this.advancedPostText(endpoint, form);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('REQUEST_FAILED');
    }
  }

  /** Slice 10 — submit async batch job; returns job metadata. */
  submitJob(endpoint: string, form: FormData): Promise<PdfJobStatusResponse> {
    return this.advancedPostJson<PdfJobStatusResponse>(endpoint, form);
  }

  getJobStatus(jobId: string): Promise<PdfJobStatusResponse> {
    return firstValueFrom(
      this.http
        .get<PdfJobStatusResponse>(`${this.config.baseUrl}/jobs/${encodeURIComponent(jobId)}`)
        .pipe(catchError((err) => this.mapError(err)))
    );
  }

  downloadJob(jobId: string): Promise<Blob> {
    return firstValueFrom(
      this.http
        .get(`${this.config.baseUrl}/jobs/${encodeURIComponent(jobId)}/download`, {
          responseType: 'blob',
        })
        .pipe(catchError((err) => this.mapError(err)))
    );
  }

  private async postBlob(path: string, form: FormData): Promise<Blob> {
    try {
      return await firstValueFrom(
        this.http
          .post(`${this.config.baseUrl}${path}`, form, { responseType: 'blob' })
          .pipe(catchError((err) => this.mapError(err)))
      );
    } catch (e) {
      throw e instanceof Error ? e : new Error('REQUEST_FAILED');
    }
  }

  private mapError(err: unknown) {
    if (err instanceof HttpErrorResponse) {
      const fallback =
        err.status === 0
          ? 'SERVICE_UNAVAILABLE'
          : err.status === 413
            ? 'File is too large to process'
            : err.status >= 500
              ? 'SERVICE_ERROR'
              : 'REQUEST_FAILED';
      if (err.error instanceof Blob) {
        return new Observable<never>((subscriber) => {
          err.error
            .text()
            .then((text: string) => {
              try {
                const json = JSON.parse(text) as { detail?: string; title?: string };
                const detail = (json.detail || '').trim();
                const title = (json.title || '').trim();
                // Prefer concrete validation detail; ignore generic ProblemDetail titles
                const candidate = detail || title;
                subscriber.error(new Error(candidate || fallback));
              } catch {
                subscriber.error(new Error(fallback));
              }
            })
            .catch(() => subscriber.error(new Error(fallback)));
        });
      }
      if (typeof err.error === 'object' && err.error) {
        const json = err.error as { detail?: string; title?: string };
        const candidate = (json.detail || json.title || '').trim();
        return throwError(() => new Error(candidate || fallback));
      }
      return throwError(() => new Error(fallback));
    }
    return throwError(() => err);
  }
}

export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}
