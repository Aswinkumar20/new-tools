import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-reorder-pages',
  standalone: true,
  templateUrl: './reorder-pages.html',
  styleUrls: ['./reorder-pages.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ReorderPagesComponent {
  constructor() {}
}
