import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfDocumentClassifierComponent } from './pdf-document-classifier';

describe('PdfDocumentClassifierComponent', () => {
  let fixture: ComponentFixture<PdfDocumentClassifierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfDocumentClassifierComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfDocumentClassifierComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
