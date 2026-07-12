import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '@tools-workspace/features-home';
import {
  exitDocumentFullscreen,
  isDocumentFullscreen,
  listenFullscreenChange,
  requestElementFullscreen,
} from '../../shared/pdf-fullscreen.util';

@Component({
  selector: 'lib-pdf-fullscreen-overlay',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './pdf-fullscreen-overlay.html',
  styleUrls: ['./pdf-fullscreen-overlay.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfFullscreenOverlayComponent implements OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() open = false;
  @Input() title = 'PDF preview';

  @Output() closed = new EventEmitter<void>();
  @Output() ready = new EventEmitter<void>();

  @ViewChild('fsContainer') fsContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('fsCanvas') fsCanvas?: ElementRef<HTMLCanvasElement>;

  private stopListening?: () => void;
  private readonly onFullscreenChange = () => {
    if (!isDocumentFullscreen() && this.open) {
      this.closed.emit();
    }
  };

  constructor() {
    this.stopListening = listenFullscreenChange(this.onFullscreenChange);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      queueMicrotask(() => void this.enterNativeFullscreen());
    }
  }

  ngOnDestroy(): void {
    this.stopListening?.();
    if (isDocumentFullscreen()) {
      void exitDocumentFullscreen();
    }
  }

  get canvasElement(): HTMLCanvasElement | undefined {
    return this.fsCanvas?.nativeElement;
  }

  close(): void {
    void exitDocumentFullscreen();
    this.closed.emit();
  }

  private async enterNativeFullscreen(): Promise<void> {
    const container = this.fsContainer?.nativeElement;
    if (!container) return;
    try {
      await requestElementFullscreen(container);
    } catch {
      /* overlay still usable without native fullscreen */
    }
    this.ready.emit();
    this.cdr.markForCheck();
  }
}
