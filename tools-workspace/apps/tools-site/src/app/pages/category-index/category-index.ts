import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Navigation, TOOL_CATEGORIES } from '@tools-workspace/features-home';
import type { ToolCategoryCatalog } from '@tools-workspace/features-home';

@Component({
  selector: 'app-category-index',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Navigation],
  templateUrl: './category-index.html',
  styleUrl: './category-index.scss',
})
export class CategoryIndexComponent {
  private readonly route = inject(ActivatedRoute);

  readonly category: ToolCategoryCatalog | undefined = TOOL_CATEGORIES.find(
    (c) => c.path === this.route.snapshot.parent?.routeConfig?.path,
  );
}
