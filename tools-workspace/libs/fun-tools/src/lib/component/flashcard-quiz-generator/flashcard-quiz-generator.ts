import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-flashcard-quiz-generator',
  standalone: true,
  templateUrl: './flashcard-quiz-generator.html',
  styleUrls: ['./flashcard-quiz-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class FlashcardQuizGeneratorComponent {
  constructor() {}
}
