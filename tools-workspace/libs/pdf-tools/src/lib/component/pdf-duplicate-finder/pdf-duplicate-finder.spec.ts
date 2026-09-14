import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfDuplicateFinderComponent } from './pdf-duplicate-finder';

describe('PdfDuplicateFinderComponent', () => {
  let fixture: ComponentFixture<PdfDuplicateFinderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfDuplicateFinderComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfDuplicateFinderComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
