import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Navigation } from '@tools-workspace/features-home';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Navigation],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFoundComponent {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.updateMetadata({
      title: 'Page not found',
      description:
        'This page does not exist on EasyToolHub. Open the homepage or browse free online tools.',
      url: '/404',
      robots: 'noindex, follow',
    });
  }
}
