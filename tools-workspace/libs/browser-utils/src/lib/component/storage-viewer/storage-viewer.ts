import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-storage-viewer',
  standalone: true,
  templateUrl: './storage-viewer.html',
  styleUrls: ['./storage-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class StorageViewerComponent {
  constructor() {}
}
