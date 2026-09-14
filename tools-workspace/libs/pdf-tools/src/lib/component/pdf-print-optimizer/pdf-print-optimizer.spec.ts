import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfPrintOptimizerComponent } from './pdf-print-optimizer';

describe('PdfPrintOptimizerComponent', () => {
  let fixture: ComponentFixture<PdfPrintOptimizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfPrintOptimizerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfPrintOptimizerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
