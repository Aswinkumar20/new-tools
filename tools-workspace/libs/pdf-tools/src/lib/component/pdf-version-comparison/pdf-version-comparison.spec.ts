import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfVersionComparisonComponent } from './pdf-version-comparison';

describe('PdfVersionComparisonComponent', () => {
  let fixture: ComponentFixture<PdfVersionComparisonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfVersionComparisonComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfVersionComparisonComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
