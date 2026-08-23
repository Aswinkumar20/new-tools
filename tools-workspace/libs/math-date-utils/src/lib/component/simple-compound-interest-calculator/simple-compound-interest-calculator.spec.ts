import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleCompoundInterestCalculatorComponent } from './simple-compound-interest-calculator';

describe('SimpleCompoundInterestCalculatorComponent', () => {
  let component: SimpleCompoundInterestCalculatorComponent;
  let fixture: ComponentFixture<SimpleCompoundInterestCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimpleCompoundInterestCalculatorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SimpleCompoundInterestCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
