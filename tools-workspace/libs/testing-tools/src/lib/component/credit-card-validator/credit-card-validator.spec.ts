import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { CreditCardValidatorComponent } from './credit-card-validator';

describe('CreditCardValidatorComponent', () => {
  let component: CreditCardValidatorComponent;
  let fixture: ComponentFixture<CreditCardValidatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreditCardValidatorComponent],
      providers: ttToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(CreditCardValidatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
