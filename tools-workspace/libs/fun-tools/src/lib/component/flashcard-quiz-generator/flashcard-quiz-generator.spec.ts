import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { FQG_NEXT_CARD_DELAY_MS } from '../../constants/flashcard-quiz-generator.constants';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { FlashcardQuizGeneratorComponent } from './flashcard-quiz-generator';

describe('FlashcardQuizGeneratorComponent', () => {
  let component: FlashcardQuizGeneratorComponent;
  let fixture: ComponentFixture<FlashcardQuizGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlashcardQuizGeneratorComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FlashcardQuizGeneratorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with empty-deck suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('fqg-lorem');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('validates empty sides and adds cards', () => {
    component.addFlashcard();
    expect(component.errors()).toEqual(['Front side cannot be empty.']);

    component.form.setValue({ front: 'Q1', back: 'A1' });
    component.addFlashcard();
    expect(component.flashcards().length).toBe(1);
    expect(component.form.controls.front.value).toBe('');
  });

  it('requires two cards before starting a quiz', () => {
    component.form.setValue({ front: 'Q1', back: 'A1' });
    component.addFlashcard();
    expect(component.canStartQuiz()).toBe(false);
    component.form.setValue({ front: 'Q2', back: 'A2' });
    component.addFlashcard();
    expect(component.canStartQuiz()).toBe(true);
    component.startQuiz();
    expect(component.quizMode()).toBe(true);
    expect(component.currentQuizIndex()).toBe(0);
  });

  it('advances after grading with the legacy delay', fakeAsync(() => {
    component.form.setValue({ front: 'Q1', back: 'A1' });
    component.addFlashcard();
    component.form.setValue({ front: 'Q2', back: 'A2' });
    component.addFlashcard();
    component.startQuiz();
    component.toggleAnswer();
    component.submitAnswer(true);
    expect(component.quizAnswers().length).toBe(1);
    tick(FQG_NEXT_CARD_DELAY_MS);
    expect(component.currentQuizIndex()).toBe(1);
  }));

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies front text with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.form.setValue({ front: 'Hello', back: 'World' });
    await component.copyFront();
    expect(toast.info).toHaveBeenCalledWith('Front copied to clipboard');
  });
});
