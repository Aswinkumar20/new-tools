import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-tables-charts-to-pdf',
  standalone: true,
  templateUrl: './tables-charts-to-pdf.html',
  styleUrls: ['./tables-charts-to-pdf.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class TablesChartsToPdfComponent {
  constructor() {}
}
