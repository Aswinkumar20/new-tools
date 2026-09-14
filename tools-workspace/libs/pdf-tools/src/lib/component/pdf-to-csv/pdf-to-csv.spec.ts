import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfToCsvComponent } from './pdf-to-csv';

describe('PdfToCsvComponent', () => {
  let fixture: ComponentFixture<PdfToCsvComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToCsvComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToCsvComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
