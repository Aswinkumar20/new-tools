import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-text-encrypt-decrypt',
  standalone: true,
  templateUrl: './text-encrypt-decrypt.html',
  styleUrls: ['./text-encrypt-decrypt.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class TextEncryptDecryptComponent {
  constructor() {}
}
