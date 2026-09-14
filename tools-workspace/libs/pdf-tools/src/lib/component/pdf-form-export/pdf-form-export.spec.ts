import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfFormExportComponent } from './pdf-form-export';

describe('PdfFormExportComponent', () => {
  let fixture: ComponentFixture<PdfFormExportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfFormExportComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfFormExportComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
