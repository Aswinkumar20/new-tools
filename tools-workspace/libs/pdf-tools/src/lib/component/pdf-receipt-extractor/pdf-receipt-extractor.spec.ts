import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfReceiptExtractorComponent } from './pdf-receipt-extractor';

describe('PdfReceiptExtractorComponent', () => {
  let fixture: ComponentFixture<PdfReceiptExtractorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfReceiptExtractorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfReceiptExtractorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
