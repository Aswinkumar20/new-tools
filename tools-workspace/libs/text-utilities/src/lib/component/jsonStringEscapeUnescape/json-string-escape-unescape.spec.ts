import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { JsonStringEscapeUnescapeComponent } from './json-string-escape-unescape';

describe('JsonStringEscapeUnescapeComponent', () => {
  let component: JsonStringEscapeUnescapeComponent;
  let fixture: ComponentFixture<JsonStringEscapeUnescapeComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonStringEscapeUnescapeComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(JsonStringEscapeUnescapeComponent);
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
    expect(component.primarySuggestion?.id).toBe('jse-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('escapes JSON special characters', () => {
    component.selectMode('encode');
    component.inputText = 'line\n"quote"';
    component.onInputChange();
    expect(component.outputText).toContain('\\n');
    expect(component.outputText).toContain('\\"');
    expect(component.primarySuggestion?.id).toBe('jse-escaped');
  });

  it('unescapes JSON sequences', () => {
    component.selectMode('decode');
    component.inputText = 'hello\\tworld';
    component.onInputChange();
    expect(component.outputText).toBe('hello\tworld');
    expect(component.primarySuggestion?.id).toBe('jse-unescaped');
  });

  it('reports invalid escape sequences', () => {
    component.selectMode('decode');
    component.inputText = 'bad\\q';
    component.onInputChange();
    expect(component.errorMessage).toContain('Invalid JSON escape sequence');
    expect(component.hasOutput).toBe(false);
    expect(component.primarySuggestion?.id).toBe('jse-error');
  });

  it('suggests unescape when encode input looks escaped', () => {
    component.selectMode('encode');
    component.inputText = 'line\\nnext';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('jse-looks-escaped');
  });

  it('swaps output into input when switching modes', () => {
    component.selectMode('encode');
    component.inputText = 'hi';
    component.onInputChange();
    const escaped = component.outputText;
    component.selectMode('decode');
    expect(component.inputText).toBe(escaped);
    expect(toast.info).toHaveBeenCalledWith('Switched to Unescape mode');
  });

  it('clears with toast feedback', () => {
    component.inputText = 'hi';
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
