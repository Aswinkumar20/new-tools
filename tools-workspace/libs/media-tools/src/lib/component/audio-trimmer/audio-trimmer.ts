import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import type { MtRelatedToolLink } from '../../shared/mt-tool-suggestion.model';
import {
  AUDIO_TRIMMER_DESCRIPTION,
  AUDIO_TRIMMER_FORMATS_LABEL,
  AUDIO_TRIMMER_HELP_ITEMS,
  AUDIO_TRIMMER_INFO_ITEMS,
  AUDIO_TRIMMER_RELATED_TOOLS,
  AUDIO_TRIMMER_ROADMAP_ITEMS,
  AUDIO_TRIMMER_TITLE,
  AUDIO_TRIMMER_UPLOAD_HINT,
  AUDIO_TRIMMER_UPLOAD_LABEL
} from '../../constants/audio-trimmer.constants';
import type {
  AudioTrimmerInfoItem,
  AudioTrimmerRoadmapItem
} from '../../types/audio-trimmer.types';
import {
  getAudioTrimmerExportFormatCount,
  getAudioTrimmerPlannedFormatCount,
  resolveAudioTrimmerSuggestion
} from '../../utils/audio-trimmer.utils';

@Component({
  selector: 'lib-audio-trimmer',
  standalone: true,
  templateUrl: './audio-trimmer.html',
  styleUrls: ['./audio-trimmer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AudioTrimmerComponent {
  readonly assetService = inject(AssetService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Coming-soon surface — upload/trim not enabled yet. */
  readonly isComingSoon = true;

  readonly title = AUDIO_TRIMMER_TITLE;
  readonly description = AUDIO_TRIMMER_DESCRIPTION;
  readonly uploadLabel = AUDIO_TRIMMER_UPLOAD_LABEL;
  readonly uploadHint = AUDIO_TRIMMER_UPLOAD_HINT;
  readonly acceptHint = AUDIO_TRIMMER_FORMATS_LABEL;
  readonly formatsLabel = AUDIO_TRIMMER_FORMATS_LABEL;

  readonly features: ReadonlyArray<AudioTrimmerRoadmapItem> = AUDIO_TRIMMER_ROADMAP_ITEMS;
  readonly roadmapItems: ReadonlyArray<AudioTrimmerRoadmapItem> = AUDIO_TRIMMER_ROADMAP_ITEMS;
  readonly helpItems: ReadonlyArray<string> = AUDIO_TRIMMER_HELP_ITEMS;
  readonly infoItems: ReadonlyArray<AudioTrimmerInfoItem> = AUDIO_TRIMMER_INFO_ITEMS;
  readonly relatedTools: ReadonlyArray<MtRelatedToolLink> = AUDIO_TRIMMER_RELATED_TOOLS;

  readonly plannedFormatCount = getAudioTrimmerPlannedFormatCount();
  readonly plannedExportCount = getAudioTrimmerExportFormatCount();

  dismissedSuggestionId: string | null = null;

  get primarySuggestion() {
    const suggestion = resolveAudioTrimmerSuggestion({ isComingSoon: this.isComingSoon });
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
