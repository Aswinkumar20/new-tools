import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  MODEL_3D_MODELS_PLACEHOLDER,
  MODEL_3D_PROCESSING_LABEL,
  MODEL_3D_RELATED_TOOLS,
  MODEL_3D_ROADMAP_HINT,
  MODEL_3D_ROADMAP_ITEMS,
  MODEL_3D_STATUS_LABEL
} from '../../constants/3d-model-viewer.constants';
import {
  formatCapabilityLine,
  plannedFormatCount,
  resolveModel3dSuggestion
} from '../../utils/3d-model-viewer.utils';

@Component({
  selector: 'lib-3d-model-viewer',
  standalone: true,
  templateUrl: './3d-model-viewer.html',
  styleUrls: ['./3d-model-viewer.scss'],
  imports: [RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Model3dViewerComponent {
  readonly assetService = inject(AssetService);

  readonly statusLabel = MODEL_3D_STATUS_LABEL;
  readonly processingLabel = MODEL_3D_PROCESSING_LABEL;
  readonly modelsPlaceholder = MODEL_3D_MODELS_PLACEHOLDER;
  readonly formatsCountLabel = plannedFormatCount();
  readonly capabilityLine = formatCapabilityLine();
  readonly roadmapHint = MODEL_3D_ROADMAP_HINT;
  readonly roadmapItems = MODEL_3D_ROADMAP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = MODEL_3D_RELATED_TOOLS;

  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveModel3dSuggestion();
    if (this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }
}
