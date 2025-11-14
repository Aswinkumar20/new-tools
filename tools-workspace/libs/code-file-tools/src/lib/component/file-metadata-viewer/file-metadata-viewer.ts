import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-file-metadata-viewer',
  standalone: true,
  templateUrl: './file-metadata-viewer.html',
  styleUrls: ['./file-metadata-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class FileMetadataViewerComponent {
  constructor() {}
}
