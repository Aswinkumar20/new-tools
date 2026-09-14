import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfSignatureVerificationComponent } from './pdf-signature-verification';

describe('PdfSignatureVerificationComponent', () => {
  let fixture: ComponentFixture<PdfSignatureVerificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfSignatureVerificationComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfSignatureVerificationComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
