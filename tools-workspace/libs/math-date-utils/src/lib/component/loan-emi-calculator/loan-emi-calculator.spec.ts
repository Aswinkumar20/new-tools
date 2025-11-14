import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoanEmiCalculatorComponent } from './loan-emi-calculator';

describe('LoanEmiCalculatorComponent', () => {
  let component: LoanEmiCalculatorComponent;
  let fixture: ComponentFixture<LoanEmiCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanEmiCalculatorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LoanEmiCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
