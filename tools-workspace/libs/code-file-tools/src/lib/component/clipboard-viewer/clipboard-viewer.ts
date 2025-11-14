import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-clipboard-viewer',
  standalone: true,
  templateUrl: './clipboard-viewer.html',
  styleUrls: ['./clipboard-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ClipboardViewerComponent {
  constructor() {}
}
