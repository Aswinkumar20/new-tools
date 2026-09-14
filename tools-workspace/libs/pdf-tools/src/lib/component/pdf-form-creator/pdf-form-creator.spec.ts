import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfFormCreatorComponent } from './pdf-form-creator';

describe('PdfFormCreatorComponent', () => {
  let fixture: ComponentFixture<PdfFormCreatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfFormCreatorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfFormCreatorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
