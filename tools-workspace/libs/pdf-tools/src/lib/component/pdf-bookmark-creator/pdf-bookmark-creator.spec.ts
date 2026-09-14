import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfBookmarkCreatorComponent } from './pdf-bookmark-creator';

describe('PdfBookmarkCreatorComponent', () => {
  let fixture: ComponentFixture<PdfBookmarkCreatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfBookmarkCreatorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfBookmarkCreatorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
