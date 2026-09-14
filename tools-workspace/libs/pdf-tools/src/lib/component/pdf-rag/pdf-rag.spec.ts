import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfRagComponent } from './pdf-rag';

describe('PdfRagComponent', () => {
  let fixture: ComponentFixture<PdfRagComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfRagComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfRagComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
