import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateDifferenceCalculatorComponent } from './date-difference-calculator';

describe('DateDifferenceCalculatorComponent', () => {
  let component: DateDifferenceCalculatorComponent;
  let fixture: ComponentFixture<DateDifferenceCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateDifferenceCalculatorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DateDifferenceCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
