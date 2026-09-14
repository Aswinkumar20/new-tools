import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MarketingIconId } from '../../types/marketing-icon.types';

@Component({
  selector: 'lib-marketing-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marketing-icon.html',
  styleUrl: './marketing-icon.scss',
  host: {
    class: 'marketing-icon',
  },
})
export class MarketingIconComponent {
  @Input({ required: true }) icon!: MarketingIconId;
  @Input() size = 18;
}
