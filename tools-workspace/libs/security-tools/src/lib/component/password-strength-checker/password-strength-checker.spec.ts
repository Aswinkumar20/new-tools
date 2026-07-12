import { ComponentFixture, TestBed } from '@angular/core/testing';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { PasswordStrengthCheckerComponent } from './password-strength-checker';

describe('PasswordStrengthCheckerComponent', () => {
  let component: PasswordStrengthCheckerComponent;
  let fixture: ComponentFixture<PasswordStrengthCheckerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordStrengthCheckerComponent],
      providers: stToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordStrengthCheckerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
