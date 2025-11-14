import { isPlatformBrowser } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PLATFORM_ID } from '@angular/core';
import { filter } from 'rxjs/operators';

import { FooterComponent } from '@tools-workspace/features-home';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FooterComponent],
  template: `
    <div class="app-shell">
      <main class="app-shell__main">
        <router-outlet></router-outlet>
      </main>
      <lib-footer></lib-footer>
    </div>
  `,
  styleUrls: ['./app.scss'],
})
export class App {
  constructor(
    private readonly router: Router,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.router.events
        .pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
          takeUntilDestroyed()
        )
        .subscribe(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
  }
}
