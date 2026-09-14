import { Injectable } from '@angular/core';
import { Route, Routes } from '@angular/router';

type CategoryRouteModule = Record<string, unknown>;

const CATEGORY_ROUTE_LOADERS: Record<string, () => Promise<CategoryRouteModule>> = {
  'browser-utils': () => import('../routes/browser-utils.routes'),
  'cad-viewers': () => import('../routes/cad-viewers.routes'),
  'code-file-tools': () => import('../routes/code-file-tools.routes'),
  'data-converters': () => import('../routes/data-converters.routes'),
  'data-explorers': () => import('../routes/data-explorers.routes'),
  'dev-design-tools': () => import('../routes/dev-design-tools.routes'),
  'diagram-viewers': () => import('../routes/diagram-viewers.routes'),
  'file-viewers': () => import('../routes/file-viewers.routes'),
  'fun-tools': () => import('../routes/fun-tools.routes'),
  'gis-viewers': () => import('../routes/gis-viewers.routes'),
  'image-color-tools': () => import('../routes/image-color-tools.routes'),
  'math-date-utils': () => import('../routes/math-date-utils.routes'),
  'media-tools': () => import('../routes/media-tools.routes'),
  'medical-viewers': () => import('../routes/medical-viewers.routes'),
  'ml-viewers': () => import('../routes/ml-viewers.routes'),
  'network-viewers': () => import('../routes/network-viewers.routes'),
  'pdf-tools': () => import('../routes/pdf-tools.routes'),
  'process-viewers': () => import('../routes/process-viewers.routes'),
  'science-viewers': () => import('../routes/science-viewers.routes'),
  'security-tools': () => import('../routes/security-tools.routes'),
  'testing-tools': () => import('../routes/testing-tools.routes'),
  'text-utilities': () => import('../routes/text-utilities.routes'),
};

@Injectable({ providedIn: 'root' })
export class RoutePrefetchService {
  private readonly prefetched = new Set<string>();

  prefetch(path: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (this.prefetched.has(normalized)) {
      return;
    }

    const segments = normalized.split('/').filter(Boolean);
    if (segments.length < 2) {
      return;
    }

    const [category, toolSlug] = segments;
    const loader = CATEGORY_ROUTE_LOADERS[category];
    if (!loader) {
      return;
    }

    this.prefetched.add(normalized);

    void loader().then((module) => {
      const routes = extractRoutes(module);
      const toolRoute = routes.find((entry) => entry.path === toolSlug);
      const loadComponent = toolRoute?.loadComponent;
      if (typeof loadComponent === 'function') {
        void loadComponent();
      }
    });
  }
}

function extractRoutes(module: CategoryRouteModule): Routes {
  for (const value of Object.values(module)) {
    if (!Array.isArray(value)) {
      continue;
    }
    if (value.every(isRouteLike)) {
      return value as Routes;
    }
  }
  return [];
}

function isRouteLike(value: unknown): value is Route {
  return typeof value === 'object' && value !== null && 'path' in value;
}
