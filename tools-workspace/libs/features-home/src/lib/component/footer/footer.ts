import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { merge, Observable, of } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { AssetService } from '../../services/asset.service';
import { DEFAULT_FOOTER_SECTIONS, FOOTER_CONFIG, FooterLink, FooterSection } from './footer.config';

@Component({
  selector: 'lib-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.html',
  styleUrls: ['./footer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  protected readonly year = new Date().getFullYear();
  protected readonly iconUrl: string;
  protected readonly metaLinks: ReadonlyArray<FooterLink> = [
    { label: 'About', path: '/tools/home#about' },
    { label: 'Contact', path: '/tools/home#contact' },
    { label: 'Privacy', path: '/tools/home#privacy' },
    { label: 'Terms', path: '/tools/home#terms' },
  ];

  protected readonly sections$: Observable<FooterSection[]>;

  constructor(
    private readonly router: Router,
    private readonly assetService: AssetService,
  ) {
    this.iconUrl = this.assetService.getAssetPath('logo-icon.svg');
    this.sections$ = merge(
      of(this.router.url),
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        map(event => event.urlAfterRedirects)
      )
    ).pipe(map(url => this.resolveSections(url)));
  }

  protected trackByTitle(_: number, section: FooterSection): string {
    return section.title;
  }

  protected trackByLink(_: number, link: FooterLink): string {
    return link.path;
  }

  private resolveSections(url: string): FooterSection[] {
    const cleaned = url.split('?')[0]?.split('#')[0] ?? '';
    const category = cleaned.split('/').find(segment => segment.trim().length > 0) ?? 'default';

    return FOOTER_CONFIG[category] ?? DEFAULT_FOOTER_SECTIONS;
  }
}

