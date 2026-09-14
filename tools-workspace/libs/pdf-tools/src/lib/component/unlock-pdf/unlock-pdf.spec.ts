import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { UnlockPdfComponent } from './unlock-pdf';

describe('UnlockPdfComponent', () => {
  let fixture: ComponentFixture<UnlockPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnlockPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(UnlockPdfComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
