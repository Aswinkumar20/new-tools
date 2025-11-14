import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-flatten-pdf-forms',
  standalone: true,
  templateUrl: './flatten-pdf-forms.html',
  styleUrls: ['./flatten-pdf-forms.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class FlattenPdfFormsComponent {
  constructor() {}
}
