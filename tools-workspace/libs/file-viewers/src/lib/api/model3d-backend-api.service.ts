import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MODEL3D_BACKEND_CONFIG, type Model3dBackendConfig } from './model3d-backend.config';
import type { Model3dInspectResult } from '../types/3d-model-viewer.types';

@Injectable({ providedIn: 'root' })
export class Model3dBackendApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(MODEL3D_BACKEND_CONFIG);

  get settings(): Model3dBackendConfig {
    return this.config;
  }

  health(): Observable<{ status: string; service: string; version: string; formats?: string[] }> {
    return this.http.get<{ status: string; service: string; version: string; formats?: string[] }>(
      `${this.config.baseUrl}/health`
    );
  }

  async inspect(file: File): Promise<Model3dInspectResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    try {
      return await firstValueFrom(
        this.http
          .post<Model3dInspectResult>(`${this.config.baseUrl}/inspect`, form)
          .pipe(catchError((err) => this.mapError(err)))
      );
    } catch (e) {
      throw e instanceof Error ? e : new Error('REQUEST_FAILED');
    }
  }

  async normalize(file: File): Promise<Blob> {
    const form = new FormData();
    form.append('file', file, file.name);
    try {
      return await firstValueFrom(
        this.http
          .post(`${this.config.baseUrl}/normalize`, form, { responseType: 'blob' })
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
