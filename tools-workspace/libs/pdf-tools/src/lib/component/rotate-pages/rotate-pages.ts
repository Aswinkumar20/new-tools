import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-rotate-pages',
  standalone: true,
  templateUrl: './rotate-pages.html',
  styleUrls: ['./rotate-pages.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class RotatePagesComponent {
  constructor() {}
}
