import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { FindAndReplaceComponent } from './find-and-replace';

describe('FindAndReplaceComponent', () => {
  let component: FindAndReplaceComponent;
  let fixture: ComponentFixture<FindAndReplaceComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FindAndReplaceComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FindAndReplaceComponent);
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
    expect(component.primarySuggestion?.id).toBe('far-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('replaces all matches', () => {
    component.findText = 'foo';
    component.replaceText = 'bar';
    component.inputText = 'foo baz foo';
    component.onInputChange();
    expect(component.outputText).toBe('bar baz bar');
    expect(component.primarySuggestion?.id).toBe('far-done');
  });

  it('passes input through when find is empty', () => {
    component.findText = '';
    component.inputText = 'unchanged';
    component.onInputChange();
    expect(component.outputText).toBe('unchanged');
    expect(component.primarySuggestion?.id).toBe('far-no-find');
  });

  it('reports invalid regex', () => {
    component.useRegex = true;
    component.findText = '[';
    component.inputText = 'test';
    component.onInputChange();
    expect(component.errorMessage).toContain('Invalid regex');
    expect(component.hasOutput).toBe(false);
    expect(component.primarySuggestion?.id).toBe('far-regex-error');
  });

  it('respects replace-all off', () => {
    component.replaceAll = false;
    component.caseSensitive = true;
    component.findText = 'a';
    component.replaceText = 'X';
    component.inputText = 'a a a';
    component.onInputChange();
    expect(component.outputText).toBe('X a a');
  });

  it('clears with toast feedback', () => {
    component.inputText = 'hello';
    component.findText = 'e';
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.outputText).toBe('');
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
