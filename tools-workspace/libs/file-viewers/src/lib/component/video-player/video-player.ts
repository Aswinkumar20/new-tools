import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  VIDEO_FORMATS_LABEL,
  VIDEO_RELATED_TOOLS,
  VIDEO_ROADMAP_ITEMS
} from '../../constants/video-player.constants';
import type { VideoRoadmapItem } from '../../types/video-player.types';
import {
  getVideoPlannedFormatCount,
  resolveVideoSuggestion
} from '../../utils/video-player.utils';

@Component({
  selector: 'lib-video-player',
  standalone: true,
  templateUrl: './video-player.html',
  styleUrls: ['./video-player.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class VideoPlayerComponent {
  readonly assetService = inject(AssetService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Coming-soon surface — upload/playback not enabled yet. */
  readonly isComingSoon = true;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = VIDEO_RELATED_TOOLS;
  readonly roadmapItems: ReadonlyArray<VideoRoadmapItem> = VIDEO_ROADMAP_ITEMS;
  readonly formatsLabel = VIDEO_FORMATS_LABEL;
  readonly plannedFormatCount = getVideoPlannedFormatCount();

  dismissedSuggestionId: string | null = null;

  get primarySuggestion() {
    const suggestion = resolveVideoSuggestion({ isComingSoon: this.isComingSoon });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.detectChanges();
  }
}
