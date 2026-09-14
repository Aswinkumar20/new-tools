import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { ImagesToSearchablePdfComponent } from './images-to-searchable-pdf';

describe('ImagesToSearchablePdfComponent', () => {
  let fixture: ComponentFixture<ImagesToSearchablePdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImagesToSearchablePdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ImagesToSearchablePdfComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
