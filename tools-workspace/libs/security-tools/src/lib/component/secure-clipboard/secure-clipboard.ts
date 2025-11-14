import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-secure-clipboard',
  standalone: true,
  templateUrl: './secure-clipboard.html',
  styleUrls: ['./secure-clipboard.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class SecureClipboardComponent {
  constructor() {}
}
