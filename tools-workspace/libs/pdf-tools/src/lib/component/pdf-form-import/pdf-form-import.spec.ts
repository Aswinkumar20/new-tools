import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfFormImportComponent } from './pdf-form-import';

describe('PdfFormImportComponent', () => {
  let fixture: ComponentFixture<PdfFormImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfFormImportComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfFormImportComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
