import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-fill-pdf-forms',
  standalone: true,
  templateUrl: './fill-pdf-forms.html',
  styleUrls: ['./fill-pdf-forms.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class FillPdfFormsComponent {
  constructor() {}
}
