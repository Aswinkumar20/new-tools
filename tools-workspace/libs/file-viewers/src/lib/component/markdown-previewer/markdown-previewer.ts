import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-markdown-previewer',
  standalone: true,
  templateUrl: './markdown-previewer.html',
  styleUrls: ['./markdown-previewer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class MarkdownPreviewerComponent {
  constructor() {}
}
