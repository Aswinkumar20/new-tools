import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-delete-pages',
  standalone: true,
  templateUrl: './delete-pages.html',
  styleUrls: ['./delete-pages.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class DeletePagesComponent {
  constructor() {}
}
