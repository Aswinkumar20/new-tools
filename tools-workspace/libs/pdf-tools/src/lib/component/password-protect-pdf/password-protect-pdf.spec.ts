import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PasswordProtectPdfComponent } from './password-protect-pdf';

describe('PasswordProtectPdfComponent', () => {
  let component: PasswordProtectPdfComponent;
  let fixture: ComponentFixture<PasswordProtectPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordProtectPdfComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordProtectPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
