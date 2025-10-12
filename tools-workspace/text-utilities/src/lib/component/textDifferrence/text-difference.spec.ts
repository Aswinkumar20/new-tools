import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextDifference } from './text-difference';

describe('TextDifference', () => {
  let component: TextDifference;
  let fixture: ComponentFixture<TextDifference>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TextDifference],
    }).compileComponents();

    fixture = TestBed.createComponent(TextDifference);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
