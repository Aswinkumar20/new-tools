import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfVisualComparisonComponent } from './pdf-visual-comparison';

describe('PdfVisualComparisonComponent', () => {
  let fixture: ComponentFixture<PdfVisualComparisonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfVisualComparisonComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfVisualComparisonComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
