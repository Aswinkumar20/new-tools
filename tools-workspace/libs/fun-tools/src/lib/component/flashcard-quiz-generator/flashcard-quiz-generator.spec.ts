import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlashcardQuizGeneratorComponent } from './flashcard-quiz-generator';

describe('FlashcardQuizGeneratorComponent', () => {
  let component: FlashcardQuizGeneratorComponent;
  let fixture: ComponentFixture<FlashcardQuizGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlashcardQuizGeneratorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FlashcardQuizGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
