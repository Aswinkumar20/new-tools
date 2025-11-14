import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-split-pdfs',
  standalone: true,
  templateUrl: './split-pdfs.html',
  styleUrls: ['./split-pdfs.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class SplitPdfsComponent {
  constructor() {}
}
