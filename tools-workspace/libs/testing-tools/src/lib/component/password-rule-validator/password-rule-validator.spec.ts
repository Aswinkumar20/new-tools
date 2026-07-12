import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { PasswordRuleValidatorComponent } from './password-rule-validator';

describe('PasswordRuleValidatorComponent', () => {
  let component: PasswordRuleValidatorComponent;
  let fixture: ComponentFixture<PasswordRuleValidatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordRuleValidatorComponent],
      providers: ttToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordRuleValidatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
