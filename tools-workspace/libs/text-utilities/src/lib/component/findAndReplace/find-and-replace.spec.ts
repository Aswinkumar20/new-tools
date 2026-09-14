import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
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

  it('previews replacements without applying to input', () => {
    component.inputText = 'foo baz foo';
    component.findText = 'foo';
    component.replaceText = 'bar';
    component.onOptionsChange();
    expect(component.outputText).toBe('bar baz bar');
    expect(component.inputText).toBe('foo baz foo');
    expect(component.replaceApplied).toBe(false);
    expect(component.replaceStatus).toBe('preview');
    expect(component.primarySuggestion?.id).toBe('far-done');
  });

  it('applies replace after confirmation', () => {
    const confirmSpy = jest.spyOn(globalThis, 'confirm').mockReturnValue(true);
    component.inputText = 'foo baz foo';
    component.findText = 'foo';
    component.replaceText = 'bar';
    component.onOptionsChange();
    component.applyReplace();
    expect(component.inputText).toBe('bar baz bar');
    expect(component.replaceApplied).toBe(true);
    expect(component.replaceStatus).toBe('applied');
    expect(toast.success).toHaveBeenCalledWith('Replaced 2 occurrences. Input text updated.');
    confirmSpy.mockRestore();
  });

  it('cancels replace when confirmation is declined', () => {
    const confirmSpy = jest.spyOn(globalThis, 'confirm').mockReturnValue(false);
    component.inputText = 'foo baz foo';
    component.findText = 'foo';
    component.replaceText = 'bar';
    component.onOptionsChange();
    component.applyReplace();
    expect(component.inputText).toBe('foo baz foo');
    expect(component.replaceApplied).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Replace cancelled.');
    confirmSpy.mockRestore();
  });

  it('passes input through when find is empty', fakeAsync(() => {
    component.findText = '';
    component.inputText = 'unchanged';
    component.onInputChange();
    tick(400);
    expect(component.outputText).toBe('unchanged');
    expect(component.primarySuggestion?.id).toBe('far-no-find');
  }));

  it('reports invalid regex', () => {
    component.useRegex = true;
    component.findText = '[';
    component.inputText = 'test';
    component.onOptionsChange();
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
    component.onOptionsChange();
    expect(component.outputText).toBe('X a a');
  });

  it('clears with toast feedback', fakeAsync(() => {
    component.inputText = 'hello';
    component.findText = 'e';
    component.onInputChange();
    tick(400);
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.outputText).toBe('');
    expect(toast.info).toHaveBeenCalledWith('Text cleared');
  }));

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
