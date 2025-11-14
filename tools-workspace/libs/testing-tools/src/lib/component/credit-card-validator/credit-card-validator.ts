import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-credit-card-validator',
  standalone: true,
  templateUrl: './credit-card-validator.html',
  styleUrls: ['./credit-card-validator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class CreditCardValidatorComponent {
  constructor() {}
}
