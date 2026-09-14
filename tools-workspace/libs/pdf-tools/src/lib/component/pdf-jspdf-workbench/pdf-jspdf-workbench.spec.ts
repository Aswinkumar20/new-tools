import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfJspdfWorkbenchComponent } from './pdf-jspdf-workbench';

describe('PdfJspdfWorkbenchComponent', () => {
  let fixture: ComponentFixture<PdfJspdfWorkbenchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfJspdfWorkbenchComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfJspdfWorkbenchComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
