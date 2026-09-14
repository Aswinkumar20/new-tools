import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfSearchComponent } from './pdf-search';

describe('PdfSearchComponent', () => {
  let fixture: ComponentFixture<PdfSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfSearchComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfSearchComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
