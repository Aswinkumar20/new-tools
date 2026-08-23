import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextReversalAndPalindromeCheckerComponent } from './text-reversal-and-palindrome-checker';

describe('TextReversalAndPalindromeCheckerComponent', () => {
  let component: TextReversalAndPalindromeCheckerComponent;
  let fixture: ComponentFixture<TextReversalAndPalindromeCheckerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TextReversalAndPalindromeCheckerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TextReversalAndPalindromeCheckerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
