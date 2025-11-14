import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-coin-toss-dice-roller',
  standalone: true,
  templateUrl: './coin-toss-dice-roller.html',
  styleUrls: ['./coin-toss-dice-roller.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class CoinTossDiceRollerComponent {
  constructor() {}
}
