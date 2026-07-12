import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { TextToPdfComponent } from './text-to-pdf';

describe('TextToPdfComponent', () => {
  let component: TextToPdfComponent;
  let fixture: ComponentFixture<TextToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(TextToPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
