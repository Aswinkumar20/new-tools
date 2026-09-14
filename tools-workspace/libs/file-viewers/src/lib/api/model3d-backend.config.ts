import { InjectionToken } from '@angular/core';

export interface Model3dBackendConfig {
  enabled: boolean;
  baseUrl: string;
  maxUploadMb: number;
}

export const DEFAULT_MODEL3D_BACKEND_CONFIG: Model3dBackendConfig = {
  enabled: true,
  baseUrl: '/api/v1/model3d',
  maxUploadMb: 50,
};

export const MODEL3D_BACKEND_CONFIG = new InjectionToken<Model3dBackendConfig>('MODEL3D_BACKEND_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_MODEL3D_BACKEND_CONFIG,
});
