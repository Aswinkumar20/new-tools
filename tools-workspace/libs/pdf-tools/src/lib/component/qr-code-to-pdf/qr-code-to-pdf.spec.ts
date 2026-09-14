import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { QrCodeToPdfComponent } from './qr-code-to-pdf';

describe('QrCodeToPdfComponent', () => {
  let fixture: ComponentFixture<QrCodeToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrCodeToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(QrCodeToPdfComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
