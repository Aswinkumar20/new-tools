import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PasswordRuleValidatorComponent } from './password-rule-validator';

describe('PasswordRuleValidatorComponent', () => {
  let component: PasswordRuleValidatorComponent;
  let fixture: ComponentFixture<PasswordRuleValidatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordRuleValidatorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordRuleValidatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
