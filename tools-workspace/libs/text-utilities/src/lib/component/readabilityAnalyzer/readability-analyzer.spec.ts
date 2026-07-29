import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { ReadabilityAnalyzerComponent } from './readability-analyzer';

describe('ReadabilityAnalyzerComponent', () => {
  let component: ReadabilityAnalyzerComponent;
  let fixture: ComponentFixture<ReadabilityAnalyzerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReadabilityAnalyzerComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ReadabilityAnalyzerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('ra-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('analyzes readability', () => {
    component.inputText = 'The quick brown fox jumps over the lazy dog.';
    component.onInputChange();
    expect(component.readability?.words).toBeGreaterThan(0);
    expect(component.outputText).toContain('Flesch Reading Ease');
    expect(component.primarySuggestion?.id).toMatch(/^ra-(easy|ready|difficult)$/);
  });

  it('suggests when no words are detected', () => {
    component.inputText = '!!! ???';
    component.onInputChange();
    expect(component.readability?.words).toBe(0);
    expect(component.hasOutput).toBe(false);
    expect(component.primarySuggestion?.id).toBe('ra-no-words');
  });

  it('suggests difficult for dense academic-style text', () => {
    component.inputText =
      'Notwithstanding the aforementioned considerations regarding interdisciplinary methodological frameworks, subsequent empirical investigations necessitate comprehensive evaluative criteria.';
    component.onInputChange();
    expect(component.readability?.fleschReadingEase).toBeLessThan(50);
    expect(component.primarySuggestion?.id).toBe('ra-difficult');
  });

  it('clears with toast feedback', () => {
    component.inputText = 'Hello world.';
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.readability).toBeNull();
    expect(toast.info).toHaveBeenCalledWith('Text cleared');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
