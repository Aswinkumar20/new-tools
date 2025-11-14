import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-json-schema-validator',
  standalone: true,
  templateUrl: './json-schema-validator.html',
  styleUrls: ['./json-schema-validator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class JsonSchemaValidatorComponent {
  constructor() {}
}
