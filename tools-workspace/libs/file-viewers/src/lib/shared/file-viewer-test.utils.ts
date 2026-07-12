import { Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AssetService, ToastService } from '@tools-workspace/features-home';

/** Shared TestBed providers for standalone file-viewer components. */
export function fileViewerTestProviders(): Provider[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
    {
      provide: ToastService,
      useValue: { info: jest.fn(), error: jest.fn(), success: jest.fn() },
    },
  ];
}
