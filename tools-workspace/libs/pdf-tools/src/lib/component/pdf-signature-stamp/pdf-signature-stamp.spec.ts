import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfSignatureStampComponent } from './pdf-signature-stamp';

describe('PdfSignatureStampComponent', () => {
  let fixture: ComponentFixture<PdfSignatureStampComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfSignatureStampComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfSignatureStampComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
