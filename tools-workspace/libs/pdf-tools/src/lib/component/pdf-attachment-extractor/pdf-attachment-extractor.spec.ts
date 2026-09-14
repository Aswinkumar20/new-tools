import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfAttachmentExtractorComponent } from './pdf-attachment-extractor';

describe('PdfAttachmentExtractorComponent', () => {
  let fixture: ComponentFixture<PdfAttachmentExtractorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfAttachmentExtractorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfAttachmentExtractorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
