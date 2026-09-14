import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfFileRenamerComponent } from './pdf-file-renamer';

describe('PdfFileRenamerComponent', () => {
  let fixture: ComponentFixture<PdfFileRenamerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfFileRenamerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfFileRenamerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
