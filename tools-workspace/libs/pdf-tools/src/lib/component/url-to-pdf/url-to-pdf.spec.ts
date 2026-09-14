import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { UrlToPdfComponent } from './url-to-pdf';

describe('UrlToPdfComponent', () => {
  let fixture: ComponentFixture<UrlToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UrlToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(UrlToPdfComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
