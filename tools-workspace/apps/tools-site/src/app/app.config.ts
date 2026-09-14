import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { ROUTE_PREFETCH } from '@tools-workspace/features-home';
import { CategoryPreloadStrategy } from './strategies/category-preload.strategy';
import { RoutePrefetchService } from './services/route-prefetch.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes, withPreloading(CategoryPreloadStrategy)),
    provideHttpClient(withFetch()),
    {
      provide: ROUTE_PREFETCH,
      useFactory: (prefetch: RoutePrefetchService) => (path: string) => prefetch.prefetch(path),
      deps: [RoutePrefetchService],
    },
  ],
};
