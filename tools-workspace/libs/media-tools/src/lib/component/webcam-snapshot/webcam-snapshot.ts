import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import type { MtRelatedToolLink } from '../../shared/mt-tool-suggestion.model';
import {
  WEBCAM_SNAPSHOT_ACCEPT_HINT,
  WEBCAM_SNAPSHOT_DESCRIPTION,
  WEBCAM_SNAPSHOT_EMPTY_HINT,
  WEBCAM_SNAPSHOT_HELP_ITEMS,
  WEBCAM_SNAPSHOT_INFO_ITEMS,
  WEBCAM_SNAPSHOT_RELATED_TOOLS,
  WEBCAM_SNAPSHOT_ROADMAP_ITEMS,
  WEBCAM_SNAPSHOT_TITLE,
  WEBCAM_SNAPSHOT_UPLOAD_HINT,
  WEBCAM_SNAPSHOT_UPLOAD_LABEL
} from '../../constants/webcam-snapshot.constants';
import type {
  WebcamSnapshotInfoItem,
  WebcamSnapshotRoadmapItem
} from '../../types/webcam-snapshot.types';
import {
  getWebcamSnapshotCountdownOptionCount,
  getWebcamSnapshotExportFormatCount,
  getWebcamSnapshotExportFormatsSummary,
  resolveWebcamSnapshotSuggestion
} from '../../utils/webcam-snapshot.utils';

@Component({
  selector: 'lib-webcam-snapshot',
  standalone: true,
  templateUrl: './webcam-snapshot.html',
  styleUrls: ['./webcam-snapshot.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebcamSnapshotComponent {
  readonly assetService = inject(AssetService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Coming-soon surface — camera capture not enabled yet. */
  readonly isComingSoon = true;

  readonly title = WEBCAM_SNAPSHOT_TITLE;
  readonly description = WEBCAM_SNAPSHOT_DESCRIPTION;
  readonly uploadLabel = WEBCAM_SNAPSHOT_UPLOAD_LABEL;
  readonly uploadHint = WEBCAM_SNAPSHOT_UPLOAD_HINT;
  readonly emptyHint = WEBCAM_SNAPSHOT_EMPTY_HINT;
  readonly acceptHint = WEBCAM_SNAPSHOT_ACCEPT_HINT;

  readonly features: ReadonlyArray<WebcamSnapshotRoadmapItem> = WEBCAM_SNAPSHOT_ROADMAP_ITEMS;
  readonly roadmapItems: ReadonlyArray<WebcamSnapshotRoadmapItem> = WEBCAM_SNAPSHOT_ROADMAP_ITEMS;
  readonly helpItems: ReadonlyArray<string> = WEBCAM_SNAPSHOT_HELP_ITEMS;
  readonly infoItems: ReadonlyArray<WebcamSnapshotInfoItem> = WEBCAM_SNAPSHOT_INFO_ITEMS;
  readonly relatedTools: ReadonlyArray<MtRelatedToolLink> = WEBCAM_SNAPSHOT_RELATED_TOOLS;

  readonly plannedExportCount = getWebcamSnapshotExportFormatCount();
  readonly countdownOptionCount = getWebcamSnapshotCountdownOptionCount();
  readonly exportFormatsLabel = getWebcamSnapshotExportFormatsSummary();

  dismissedSuggestionId: string | null = null;

  get primarySuggestion() {
    const suggestion = resolveWebcamSnapshotSuggestion({ isComingSoon: this.isComingSoon });
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
