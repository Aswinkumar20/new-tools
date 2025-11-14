import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmailUrlIpCheckerComponent } from './email-url-ip-checker';

describe('EmailUrlIpCheckerComponent', () => {
  let component: EmailUrlIpCheckerComponent;
  let fixture: ComponentFixture<EmailUrlIpCheckerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailUrlIpCheckerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EmailUrlIpCheckerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
