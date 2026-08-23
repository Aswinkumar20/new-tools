import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-extract-pages',
  standalone: true,
  templateUrl: './extract-pages.html',
  styleUrls: ['./extract-pages.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ExtractPagesComponent {
  constructor() {}
}
