import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { WordToPdfComponent } from './word-to-pdf';

describe('WordToPdfComponent', () => {
  let fixture: ComponentFixture<WordToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(WordToPdfComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
