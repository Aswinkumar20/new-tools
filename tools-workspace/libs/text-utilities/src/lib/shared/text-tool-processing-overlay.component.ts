import { Component, Input, inject } from '@angular/core';
import { AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-text-tool-processing-overlay',
  standalone: true,
  template: `
    @if (visible) {
      <div class="ttool__processing" role="status" aria-live="polite" aria-busy="true">
        <div class="ttool__processing-card">
          <div class="ttool__processing-spinner" aria-hidden="true"></div>
          <p class="ttool__processing-label">
            {{ label }}<span class="ttool__processing-dots" aria-hidden="true"></span>
          </p>
          <div
            class="ttool__progress"
            [class.ttool__progress--indeterminate]="isIndeterminate"
            role="progressbar"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="100"
            [attr.aria-valuenow]="isIndeterminate ? null : progressRounded">
            <div
              class="ttool__progress-bar"
              [style.width.%]="isIndeterminate ? null : progressRounded"></div>
          </div>
          <span class="ttool__progress-meta">
            @if (isIndeterminate) {
              Starting…
            } @else {
              {{ progressRounded }}% complete
            }
          </span>
        </div>
      </div>
    }
  `,
})
export class TextToolProcessingOverlayComponent {
  readonly assetService = inject(AssetService);

  @Input({ required: true }) visible = false;
  @Input({ required: true }) label = 'Processing';
  @Input() progress: number | null = null;

  get isIndeterminate(): boolean {
    return this.visible && this.progress === null;
  }

  get progressRounded(): number {
    return this.progress === null ? 0 : Math.round(this.progress);
  }
}
