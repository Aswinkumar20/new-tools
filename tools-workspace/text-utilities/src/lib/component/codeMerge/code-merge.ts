import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-code-merge',
  standalone: true,
  templateUrl: './code-merge.html',
  styleUrls: ['./code-merge.scss'],
    imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule],

})
export class CodeMergeComponent {
  
}
