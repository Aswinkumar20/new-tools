import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HexToRgbComponent } from './hex-to-rgb';

describe('HexToRgbComponent', () => {
  let component: HexToRgbComponent;
  let fixture: ComponentFixture<HexToRgbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HexToRgbComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HexToRgbComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
