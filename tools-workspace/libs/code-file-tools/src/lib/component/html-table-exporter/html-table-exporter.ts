import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-html-table-exporter',
  standalone: true,
  templateUrl: './html-table-exporter.html',
  styleUrls: ['./html-table-exporter.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class HtmlTableExporterComponent {
  constructor() {}
}
