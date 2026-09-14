import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfDeskewComponent } from './pdf-deskew';

describe('PdfDeskewComponent', () => {
  let fixture: ComponentFixture<PdfDeskewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfDeskewComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfDeskewComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
