import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TextReversalAndPalindromeCheckerComponent } from './text-reversal-and-palindrome-checker';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('TextReversalAndPalindromeCheckerComponent', () => {
  let component: TextReversalAndPalindromeCheckerComponent;
  let fixture: ComponentFixture<TextReversalAndPalindromeCheckerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextReversalAndPalindromeCheckerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TextReversalAndPalindromeCheckerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('detects palindromes', () => {
    component.setMode('palindrome');
    component.inputText = 'Never odd or even';
    component.onInputChange();
    expect(component.palindromeStatus).toBe(true);
  });

  it('reverses text in reverse mode', () => {
    component.setMode('reverse');
    component.inputText = 'drawer';
    component.onInputChange();
    expect(component.resultText).toBe('reward');
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
  });
});
