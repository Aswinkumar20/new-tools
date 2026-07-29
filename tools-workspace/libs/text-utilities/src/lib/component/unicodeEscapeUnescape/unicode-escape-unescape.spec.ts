import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UnicodeEscapeUnescapeComponent } from './unicode-escape-unescape';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';

describe('UnicodeEscapeUnescapeComponent', () => {
  let component: UnicodeEscapeUnescapeComponent;
  let fixture: ComponentFixture<UnicodeEscapeUnescapeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnicodeEscapeUnescapeComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(UnicodeEscapeUnescapeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('ueu-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('unicode-escapes non-ascii characters', () => {
    component.selectMode('encode');
    component.inputText = '€';
    component.onInputChange();
    expect(component.outputText).toBe('\\u20AC');
    expect(component.primarySuggestion?.id).toBe('ueu-encoded');
  });

  it('unescapes unicode sequences', () => {
    component.selectMode('decode');
    component.inputText = '\\u20AC';
    component.onInputChange();
    expect(component.outputText).toBe('€');
    expect(component.primarySuggestion?.id).toBe('ueu-decoded');
  });

  it('suggests decode when encode input looks escaped', () => {
    component.selectMode('encode');
    component.inputText = 'price \\u20AC';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('ueu-looks-escaped');
  });

  it('swaps input from output when changing mode with result', () => {
    component.selectMode('encode');
    component.inputText = '€';
    component.onInputChange();
    component.selectMode('decode');
    expect(component.inputText).toBe('\\u20AC');
    expect(component.mode).toBe('decode');
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
