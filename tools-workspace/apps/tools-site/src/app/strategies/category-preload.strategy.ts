import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

/** Preloads small category route tables after the home page settles — not individual tools. */
@Injectable({ providedIn: 'root' })
export class CategoryPreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['preloadCategory'] !== true) {
      return of(null);
    }

    return timer(1200).pipe(switchMap(() => load()));
  }
}
