import { Directive, HostListener, Input, inject } from '@angular/core';
import { AutoGATrackerService } from '../services/auto-ga-tracker.service';

/**
 * Directive to easily track tool actions
 * Usage: <button gaToolAction="copy" [gaToolMetadata]="{file_type: 'pdf'}">Copy</button>
 * 
 * This automatically uses the current tool from the route - no need to specify tool name!
 */
@Directive({
  selector: '[gaToolAction]',
  standalone: true,
})
export class GaToolActionDirective {
  private readonly autoTracker = inject(AutoGATrackerService);

  @Input() gaToolAction!: string; // Action type (e.g., 'copy', 'download', 'clear')
  @Input() gaToolMetadata?: Record<string, any>; // Optional metadata

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    if (this.gaToolAction) {
      this.autoTracker.trackAction(this.gaToolAction, this.gaToolMetadata);
    }
  }
}

/**
 * Directive to track tool completion
 * Usage: <button gaToolCompletion [gaToolMetadata]="{duration_ms: 1000}">Complete</button>
 */
@Directive({
  selector: '[gaToolCompletion]',
  standalone: true,
})
export class GaToolCompletionDirective {
  private readonly autoTracker = inject(AutoGATrackerService);

  @Input() gaToolMetadata?: Record<string, any>; // Optional metadata

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    this.autoTracker.trackCompletion(this.gaToolMetadata);
  }
}

