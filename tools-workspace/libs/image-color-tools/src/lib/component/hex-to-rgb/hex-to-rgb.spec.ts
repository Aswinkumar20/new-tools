import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { HexToRgbComponent } from './hex-to-rgb';

describe('HexToRgbComponent', () => {
  let component: HexToRgbComponent;
  let fixture: ComponentFixture<HexToRgbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HexToRgbComponent],
      providers: ictToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(HexToRgbComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
