import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-merge-pdfs',
  standalone: true,
  templateUrl: './merge-pdfs.html',
  styleUrls: ['./merge-pdfs.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class MergePdfsComponent {
  constructor() {}
}
