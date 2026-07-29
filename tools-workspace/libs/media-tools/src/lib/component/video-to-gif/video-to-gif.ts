import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import type { MtRelatedToolLink } from '../../shared/mt-tool-suggestion.model';
import {
  VIDEO_TO_GIF_DESCRIPTION,
  VIDEO_TO_GIF_FORMATS_LABEL,
  VIDEO_TO_GIF_HELP_ITEMS,
  VIDEO_TO_GIF_INFO_ITEMS,
  VIDEO_TO_GIF_RECOMMENDED_MAX_SECONDS,
  VIDEO_TO_GIF_RELATED_TOOLS,
  VIDEO_TO_GIF_ROADMAP_ITEMS,
  VIDEO_TO_GIF_TITLE,
  VIDEO_TO_GIF_UPLOAD_HINT,
  VIDEO_TO_GIF_UPLOAD_LABEL
} from '../../constants/video-to-gif.constants';
import type {
  VideoToGifInfoItem,
  VideoToGifRoadmapItem
} from '../../types/video-to-gif.types';
import {
  getVideoToGifPlannedFormatCount,
  getVideoToGifQualityPresetCount,
  resolveVideoToGifSuggestion
} from '../../utils/video-to-gif.utils';

@Component({
  selector: 'lib-video-to-gif',
  standalone: true,
  templateUrl: './video-to-gif.html',
  styleUrls: ['./video-to-gif.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoToGifComponent {
  readonly assetService = inject(AssetService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Coming-soon surface — upload/conversion not enabled yet. */
  readonly isComingSoon = true;

  readonly title = VIDEO_TO_GIF_TITLE;
  readonly description = VIDEO_TO_GIF_DESCRIPTION;
  readonly uploadLabel = VIDEO_TO_GIF_UPLOAD_LABEL;
  readonly uploadHint = VIDEO_TO_GIF_UPLOAD_HINT;
  readonly acceptHint = VIDEO_TO_GIF_FORMATS_LABEL;
  readonly formatsLabel = VIDEO_TO_GIF_FORMATS_LABEL;

  readonly features: ReadonlyArray<VideoToGifRoadmapItem> = VIDEO_TO_GIF_ROADMAP_ITEMS;
  readonly roadmapItems: ReadonlyArray<VideoToGifRoadmapItem> = VIDEO_TO_GIF_ROADMAP_ITEMS;
  readonly helpItems: ReadonlyArray<string> = VIDEO_TO_GIF_HELP_ITEMS;
  readonly infoItems: ReadonlyArray<VideoToGifInfoItem> = VIDEO_TO_GIF_INFO_ITEMS;
  readonly relatedTools: ReadonlyArray<MtRelatedToolLink> = VIDEO_TO_GIF_RELATED_TOOLS;

  readonly plannedFormatCount = getVideoToGifPlannedFormatCount();
  readonly qualityPresetCount = getVideoToGifQualityPresetCount();
  readonly recommendedMaxSeconds = VIDEO_TO_GIF_RECOMMENDED_MAX_SECONDS;

  dismissedSuggestionId: string | null = null;

  get primarySuggestion() {
    const suggestion = resolveVideoToGifSuggestion({ isComingSoon: this.isComingSoon });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.markForCheck();
  }
}
