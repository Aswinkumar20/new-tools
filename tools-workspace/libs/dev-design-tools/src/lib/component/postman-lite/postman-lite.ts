import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-postman-lite',
  standalone: true,
  templateUrl: './postman-lite.html',
  styleUrls: ['./postman-lite.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PostmanLiteComponent {
  constructor() {}
}
