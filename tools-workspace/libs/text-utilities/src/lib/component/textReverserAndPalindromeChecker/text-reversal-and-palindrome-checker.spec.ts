import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TextReversalAndPalindromeCheckerComponent } from './text-reversal-and-palindrome-checker';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';

describe('TextReversalAndPalindromeCheckerComponent', () => {
  let component: TextReversalAndPalindromeCheckerComponent;
  let fixture: ComponentFixture<TextReversalAndPalindromeCheckerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextReversalAndPalindromeCheckerComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TextReversalAndPalindromeCheckerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('trp-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.samples.length).toBe(3);
  });

  it('detects palindromes', () => {
    component.setMode('palindrome');
    component.inputText = 'Never odd or even';
    component.onInputChange();
    expect(component.palindromeStatus).toBe(true);
    expect(component.primarySuggestion?.id).toBe('trp-is-palindrome');
  });

  it('rejects non-palindromes', () => {
    component.setMode('palindrome');
    component.inputText = 'Hello, world!';
    component.onInputChange();
    expect(component.palindromeStatus).toBe(false);
    expect(component.primarySuggestion?.id).toBe('trp-not-palindrome');
  });

  it('reverses text in reverse mode', () => {
    component.setMode('reverse');
    component.inputText = 'drawer';
    component.onInputChange();
    expect(component.resultText).toBe('reward');
    expect(component.primarySuggestion?.id).toBe('trp-reversed');
  });

  it('swaps input and output in reverse mode', () => {
    component.setMode('reverse');
    component.inputText = 'abc';
    component.onInputChange();
    component.swapInputOutput();
    expect(component.inputText).toBe('cba');
    expect(component.resultText).toBe('abc');
  });

  it('clears input', () => {
    component.inputText = 'test';
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.resultText).toBe('');
    expect(component.primarySuggestion?.id).toBe('trp-get-started');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('loads a sample from constants', () => {
    component.loadSample(component.samples[0].text);
    expect(component.inputText).toBe('Never odd or even');
    expect(component.palindromeStatus).toBe(true);
  });
});
