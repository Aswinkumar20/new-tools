import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-add-signature',
  standalone: true,
  templateUrl: './add-signature.html',
  styleUrls: ['./add-signature.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class AddSignatureComponent {
  constructor() {}
}
