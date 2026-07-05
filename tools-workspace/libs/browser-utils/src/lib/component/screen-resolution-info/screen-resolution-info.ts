import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface ScreenInfo {
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  colorDepth: number | null;
  orientationType: 'portrait' | 'landscape' | 'unknown';
  orientationAngle: number | null;
  aspectRatio: number;
}

@Component({
  selector: 'lib-screen-resolution-info',
  standalone: true,
  templateUrl: './screen-resolution-info.html',
  styleUrls: ['./screen-resolution-info.scss'],
  imports: [CommonModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScreenResolutionInfoComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  readonly info = signal<ScreenInfo>(this.getInfo());

  private readonly onResize = () => {
    this.info.set(this.getInfo());
  };

  constructor() {
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
  }

  readonly isRetina = computed(() => (this.info().devicePixelRatio ?? 1) > 1);

  private getInfo(): ScreenInfo {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const colorDepth = window.screen.colorDepth || null;
    const orientation = (screen.orientation || (screen as any).mozOrientation || (screen as any).msOrientation) as
      | ScreenOrientation
      | undefined;

    let orientationType: ScreenInfo['orientationType'] = 'unknown';
    let orientationAngle: number | null = null;

    if (orientation && 'type' in orientation) {
      const type = orientation.type;
      orientationType = type.includes('landscape') ? 'landscape' : type.includes('portrait') ? 'portrait' : 'unknown';
      orientationAngle = orientation.angle ?? null;
    } else {
      orientationType = viewportWidth >= viewportHeight ? 'landscape' : 'portrait';
    }

    const aspectRatio = viewportHeight ? viewportWidth / viewportHeight : 0;

    return {
      viewportWidth,
      viewportHeight,
      screenWidth,
      screenHeight,
      devicePixelRatio,
      colorDepth,
      orientationType,
      orientationAngle,
      aspectRatio
    };
  }

  copyMetrics(): void {
    const i = this.info();
    const lines = [
      `Viewport: ${i.viewportWidth} × ${i.viewportHeight} px`,
      `Screen: ${i.screenWidth} × ${i.screenHeight} px`,
      `Aspect ratio: ${i.aspectRatio.toFixed(2)}:1`,
      `Device pixel ratio: ${i.devicePixelRatio}x`,
      `Color depth: ${i.colorDepth ?? 'N/A'}-bit`,
      `Orientation: ${i.orientationType}`,
      `Orientation angle: ${i.orientationAngle ?? 0}°`,
    ];
    this.copyText(lines.join('\n'), 'Display metrics');
  }

  copyJson(): void {
    this.copyText(JSON.stringify(this.info(), null, 2), 'Display metrics JSON');
  }

  private copyText(text: string, label: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }
}
