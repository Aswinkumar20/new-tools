import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextReversalAndPalindromeChecker } from './text-reversal-and-palindrome-checker';

describe('TextReversalAndPalindromeChecker', () => {
  let component: TextReversalAndPalindromeChecker;
  let fixture: ComponentFixture<TextReversalAndPalindromeChecker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TextReversalAndPalindromeChecker],
    }).compileComponents();

    fixture = TestBed.createComponent(TextReversalAndPalindromeChecker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
