import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-clipboard-history',
  standalone: true,
  templateUrl: './clipboard-history.html',
  styleUrls: ['./clipboard-history.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ClipboardHistoryComponent {
  constructor() {}
}
