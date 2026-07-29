import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { buCopyText } from '../../shared/bu-clipboard.util';
import { buDownloadJson, buDownloadTimestamp } from '../../shared/bu-download.util';
import { SCREEN_RELATED_TOOLS } from '../../constants/screen-resolution.constants';
import type { BuRelatedToolLink, BuToolSuggestion } from '../../shared/bu-tool-suggestion.model';
import type { ScreenInfo } from '../../types/screen-resolution.types';
import {
  createEmptyScreenInfo,
  formatAspectRatio,
  formatOrientationLabel,
  formatScreenMetricsText,
  isRetinaDisplay,
  readScreenInfo,
  resolveScreenSuggestion
} from '../../utils/screen-resolution.utils';

@Component({
  selector: 'lib-screen-resolution-info',
  standalone: true,
  templateUrl: './screen-resolution-info.html',
  styleUrls: ['./screen-resolution-info.scss'],
  imports: [RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScreenResolutionInfoComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly relatedTools: ReadonlyArray<BuRelatedToolLink> = SCREEN_RELATED_TOOLS;
  readonly formatOrientation = formatOrientationLabel;
  readonly formatAspect = formatAspectRatio;

  readonly info = signal<ScreenInfo>(
    this.isBrowser ? readScreenInfo(window) : createEmptyScreenInfo()
  );
  readonly dismissedSuggestionId = signal<string | null>(null);

  readonly isRetina = computed(() => isRetinaDisplay(this.info().devicePixelRatio));

  readonly primarySuggestion = computed<BuToolSuggestion | null>(() => {
    const suggestion = resolveScreenSuggestion(this.info());
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  private readonly onResize = () => {
    this.info.set(readScreenInfo(window));
  };

  constructor() {
    if (this.isBrowser) {
      window.addEventListener('resize', this.onResize, { passive: true });
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('resize', this.onResize);
    }
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  copyMetrics(): void {
    buCopyText(this.toast, formatScreenMetricsText(this.info()), 'Display metrics');
  }

  copyJson(): void {
    buCopyText(this.toast, JSON.stringify(this.info(), null, 2), 'Display metrics JSON');
  }

  downloadJson(): void {
    try {
      buDownloadJson(this.info(), `screen-resolution-${buDownloadTimestamp()}.json`);
      this.toast.success('Display metrics downloaded');
    } catch {
      this.toast.error('Could not download display metrics');
    }
  }
}
