import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { KeywordDensityComponent } from './keyword-density';

describe('KeywordDensityComponent', () => {
  let component: KeywordDensityComponent;
  let fixture: ComponentFixture<KeywordDensityComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeywordDensityComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(KeywordDensityComponent);
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
    expect(component.topN).toBe(20);
    expect(component.excludeStopWords).toBe(true);
    expect(component.primarySuggestion?.id).toBe('kd-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('computes keyword density', () => {
    component.inputText = 'hello hello world';
    component.onInputChange();
    expect(component.keywords[0]?.word).toBe('hello');
    expect(component.outputText).toContain('Density');
    expect(component.primarySuggestion?.id).toBe('kd-high-density');
  });

  it('clamps Top N and reprocesses', () => {
    component.inputText = 'alpha beta gamma';
    component.onInputChange();
    component.topN = 200;
    component.onTopNChange();
    expect(component.topN).toBe(100);
  });

  it('suggests when stop words dominate', () => {
    component.excludeStopWords = false;
    component.inputText = 'the the the the cat';
    component.onInputChange();
    expect(component.keywords[0]?.word).toBe('the');
    expect(component.primarySuggestion?.id).toBe('kd-stop-words');
  });

  it('suggests none when no keywords match', () => {
    component.inputText = 'a I';
    component.onInputChange();
    expect(component.keywords.length).toBe(0);
    expect(component.primarySuggestion?.id).toBe('kd-none');
  });

  it('clears with toast feedback', () => {
    component.inputText = 'hello world';
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.keywords).toEqual([]);
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
