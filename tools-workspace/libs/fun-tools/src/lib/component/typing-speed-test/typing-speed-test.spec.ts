import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { TYPING_TICK_MS } from '../../constants/typing-speed-test.constants';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { TypingSpeedTestComponent } from './typing-speed-test';

function typeIntoComponent(component: TypingSpeedTestComponent, value: string): void {
  const event = {
    target: { value }
  } as unknown as Event;
  component.onInput(event);
}

describe('TypingSpeedTestComponent', () => {
  let component: TypingSpeedTestComponent;
  let fixture: ComponentFixture<TypingSpeedTestComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TypingSpeedTestComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(TypingSpeedTestComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with sample text and idle suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.currentText().length).toBeGreaterThan(0);
    expect(component.primarySuggestion()?.id).toBe('tst-start');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('starts on first keystroke and completes when passage is finished', fakeAsync(() => {
    const sample = component.currentText();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    typeIntoComponent(component, sample.slice(0, 1));
    expect(component.isActive()).toBe(true);
    nowSpy.mockReturnValue(1_000_000 + 1000);
    tick(TYPING_TICK_MS);
    expect(component.elapsedTime()).toBeGreaterThan(0);
    typeIntoComponent(component, sample);
    expect(component.isComplete()).toBe(true);
    expect(component.hasResults()).toBe(true);
    nowSpy.mockRestore();
  }));

  it('resets attempt state without clearing saved results', fakeAsync(() => {
    const sample = component.currentText();
    typeIntoComponent(component, sample);
    expect(component.hasResults()).toBe(true);
    component.reset();
    expect(component.typedText()).toBe('');
    expect(component.isComplete()).toBe(false);
    expect(component.hasResults()).toBe(true);
    component.clearResults();
    expect(component.hasResults()).toBe(false);
  }));

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies typed text and results with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.typedText.set('hello');
    await component.copyTypedText();
    expect(toast.info).toHaveBeenCalledWith('Typed text copied to clipboard');

    component.testResults.set([
      {
        wpm: 40,
        accuracy: 100,
        time: 10,
        characters: 5,
        correct: 5,
        incorrect: 0,
        timestamp: 1
      }
    ]);
    await component.copyResults();
    expect(toast.info).toHaveBeenCalledWith('Results copied to clipboard');
  });
});
