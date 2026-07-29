import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { MotivationalQuoteGeneratorComponent } from './motivational-quote-generator';

describe('MotivationalQuoteGeneratorComponent', () => {
  let component: MotivationalQuoteGeneratorComponent;
  let fixture: ComponentFixture<MotivationalQuoteGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotivationalQuoteGeneratorComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(MotivationalQuoteGeneratorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create and auto-generate a quote', () => {
    expect(component).toBeTruthy();
    expect(component.hasCurrentQuote()).toBe(true);
    expect(component.hasHistory()).toBe(true);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()?.id).toBe('mqg-typing');
  });

  it('toggles favorites and updates suggestion', () => {
    component.toggleFavorite();
    expect(component.isFavorite()).toBe(true);
    expect(component.primarySuggestion()?.id).toBe('mqg-flashcards');
    component.toggleFavorite();
    expect(component.isFavorite()).toBe(false);
  });

  it('clears history without removing the current quote', () => {
    const quote = component.currentQuote();
    component.clearHistory();
    expect(component.hasHistory()).toBe(false);
    expect(component.currentQuote()).toBe(quote);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies quote with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyQuote();
    expect(toast.info).toHaveBeenCalledWith('Quote copied to clipboard');
  });
});
