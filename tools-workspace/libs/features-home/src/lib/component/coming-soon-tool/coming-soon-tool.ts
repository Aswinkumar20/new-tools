import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation } from '../navigation/navigation';
import type { ComingSoonToolConfig } from '../../types/coming-soon-tool.types';

const DEFAULT_LIVE_MESSAGE = 'Soon this tool will be live';

@Component({
  selector: 'lib-coming-soon-tool',
  standalone: true,
  templateUrl: './coming-soon-tool.html',
  styleUrls: ['./coming-soon-tool.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Navigation]
})
export class ComingSoonToolComponent {
  @Input({ required: true }) config!: ComingSoonToolConfig;

  get liveMessage(): string {
    return this.config.liveMessage?.trim() || DEFAULT_LIVE_MESSAGE;
  }
}
