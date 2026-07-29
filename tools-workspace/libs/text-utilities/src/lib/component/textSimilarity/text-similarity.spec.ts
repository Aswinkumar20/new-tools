import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TextSimilarityComponent } from './text-similarity';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';

describe('TextSimilarityComponent', () => {
  let component: TextSimilarityComponent;
  let fixture: ComponentFixture<TextSimilarityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextSimilarityComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TextSimilarityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('tsim-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('computes similarity for kitten/sitting', () => {
    component.inputText = 'kitten';
    component.textB = 'sitting';
    component.onTextBChange();
    expect(component.similarity).toBeGreaterThan(0);
    expect(component.distance).toBe(3);
    expect(component.outputText).toContain('Levenshtein distance: 3');
    expect(component.primarySuggestion?.id).toBe('tsim-compared');
  });

  it('suggests need-both when only Text A is filled', () => {
    component.inputText = 'hello';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('tsim-need-both');
  });

  it('suggests identical when strings match', () => {
    component.inputText = 'same';
    component.textB = 'same';
    component.onTextBChange();
    expect(component.similarity).toBe(100);
    expect(component.distance).toBe(0);
    expect(component.primarySuggestion?.id).toBe('tsim-identical');
  });

  it('clears both texts and metrics', () => {
    component.inputText = 'a';
    component.textB = 'b';
    component.onTextBChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.textB).toBe('');
    expect(component.similarity).toBe(0);
    expect(component.distance).toBe(0);
    expect(component.primarySuggestion?.id).toBe('tsim-get-started');
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
