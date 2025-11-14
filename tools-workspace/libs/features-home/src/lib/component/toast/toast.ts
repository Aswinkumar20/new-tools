import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';

@Component({
  selector: 'lib-toast',
  standalone: true,
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  host: {
    '[class.toast-wrapper]': 'true',
    '[class.toast-wrapper--active]': 'show',
  },
})
export class ToastComponent implements OnChanges, OnDestroy {
  @Input() message = '';
  @Input() show = false;
  @Input() background?: string | null;
  @Input() textColor?: string | null;
  @Input() duration = 2000;

  @Output() dismissed = new EventEmitter<void>();

  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if ('show' in changes) {
      this.handleVisibilityChange();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  get styles() {
    return {
      background: this.background || 'var(--accent)',
      color: this.textColor || '#ffffff',
    };
  }

  dismiss(): void {
    this.clearTimer();
    this.dismissed.emit();
  }

  private handleVisibilityChange(): void {
    this.clearTimer();
    if (this.show && this.duration > 0) {
      this.hideTimer = setTimeout(() => this.dismiss(), this.duration);
    }
  }

  private clearTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}

