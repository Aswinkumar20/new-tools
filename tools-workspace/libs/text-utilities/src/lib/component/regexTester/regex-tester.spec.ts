import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { RegexTesterComponent } from './regex-tester';

describe('RegexTesterComponent', () => {
  let component: RegexTesterComponent;
  let fixture: ComponentFixture<RegexTesterComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegexTesterComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(RegexTesterComponent);
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
    expect(component.flagGlobal).toBe(true);
    expect(component.primarySuggestion?.id).toBe('rx-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('finds regex matches', () => {
    component.pattern = '\\w+';
    component.inputText = 'hello world';
    component.onPatternChange();
    expect(component.matchCount).toBe(2);
    expect(component.outputText).toContain('#1');
    expect(component.primarySuggestion?.id).toBe('rx-found');
  });

  it('shows no-match empty state and suggestion', () => {
    component.pattern = 'zzz';
    component.inputText = 'hello world';
    component.onPatternChange();
    expect(component.matchCount).toBe(0);
    expect(component.hasOutput).toBe(false);
    expect(component.primarySuggestion?.id).toBe('rx-none');
  });

  it('surfaces invalid pattern errors', () => {
    component.pattern = '(';
    component.inputText = 'hello';
    component.onPatternChange();
    expect(component.errorMessage.length).toBeGreaterThan(0);
    expect(component.matchCount).toBe(0);
    expect(component.primarySuggestion?.id).toBe('rx-error');
  });

  it('formats capture groups in output', () => {
    component.pattern = '(\\w+)';
    component.inputText = 'abc';
    component.onPatternChange();
    expect(component.outputText).toContain('groups:');
    expect(component.outputText).toContain('"abc"');
  });

  it('clears with toast feedback', () => {
    component.pattern = '\\w+';
    component.inputText = 'hello';
    component.onPatternChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.matchCount).toBe(0);
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
