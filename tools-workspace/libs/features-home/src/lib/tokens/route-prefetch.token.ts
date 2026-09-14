import { InjectionToken } from '@angular/core';

/** Optional hook for the host app to warm lazy route chunks before navigation. */
export const ROUTE_PREFETCH = new InjectionToken<(path: string) => void>('ROUTE_PREFETCH');
