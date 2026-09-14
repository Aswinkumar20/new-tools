import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PowerpointToPdfComponent } from './powerpoint-to-pdf';

describe('PowerpointToPdfComponent', () => {
  let fixture: ComponentFixture<PowerpointToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PowerpointToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PowerpointToPdfComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
