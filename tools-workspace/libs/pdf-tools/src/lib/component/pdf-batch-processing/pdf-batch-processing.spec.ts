import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfBatchProcessingComponent } from './pdf-batch-processing';

describe('PdfBatchProcessingComponent', () => {
  let fixture: ComponentFixture<PdfBatchProcessingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfBatchProcessingComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfBatchProcessingComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
