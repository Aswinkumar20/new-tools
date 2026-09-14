import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { HtmlToPdfComponent } from './html-to-pdf';

describe('HtmlToPdfComponent', () => {
  let fixture: ComponentFixture<HtmlToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlToPdfComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
