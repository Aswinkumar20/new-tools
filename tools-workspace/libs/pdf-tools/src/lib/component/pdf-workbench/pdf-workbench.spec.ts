import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfWorkbenchComponent } from './pdf-workbench';

describe('PdfWorkbenchComponent', () => {
  let fixture: ComponentFixture<PdfWorkbenchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfWorkbenchComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfWorkbenchComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
