import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfPageDuplicatorComponent } from './pdf-page-duplicator';

describe('PdfPageDuplicatorComponent', () => {
  let fixture: ComponentFixture<PdfPageDuplicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfPageDuplicatorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfPageDuplicatorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
