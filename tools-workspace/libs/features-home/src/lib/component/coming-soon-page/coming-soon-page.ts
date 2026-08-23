import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ComingSoonToolComponent } from '../coming-soon-tool/coming-soon-tool';
import type { ComingSoonToolConfig } from '../../types/coming-soon-tool.types';
import { COMING_SOON_TOOLS, DEFAULT_COMING_SOON_TOOL } from '../../constants/coming-soon-tools';

@Component({
  selector: 'lib-coming-soon-page',
  standalone: true,
  template: `<lib-coming-soon-tool [config]="config" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComingSoonToolComponent],
})
export class ComingSoonPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly config: ComingSoonToolConfig =
    COMING_SOON_TOOLS[this.route.snapshot.routeConfig?.path ?? ''] ?? DEFAULT_COMING_SOON_TOOL;
}
