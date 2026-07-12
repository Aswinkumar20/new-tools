import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfViewerComponent } from './pdf-viewer';

describe('PdfViewerComponent', () => {
  let component: PdfViewerComponent;
  let fixture: ComponentFixture<PdfViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfViewerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
