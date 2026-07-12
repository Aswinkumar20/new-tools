import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { PixelToRemComponent } from './pixel-to-rem';

describe('PixelToRemComponent', () => {
  let component: PixelToRemComponent;
  let fixture: ComponentFixture<PixelToRemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PixelToRemComponent],
      providers: ddToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PixelToRemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
