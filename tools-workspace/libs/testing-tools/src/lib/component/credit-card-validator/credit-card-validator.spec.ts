import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreditCardValidatorComponent } from './credit-card-validator';

describe('CreditCardValidatorComponent', () => {
  let component: CreditCardValidatorComponent;
  let fixture: ComponentFixture<CreditCardValidatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreditCardValidatorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CreditCardValidatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
