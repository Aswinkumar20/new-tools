import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfDataExtractorComponent } from './pdf-data-extractor';

describe('PdfDataExtractorComponent', () => {
  let fixture: ComponentFixture<PdfDataExtractorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfDataExtractorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfDataExtractorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
