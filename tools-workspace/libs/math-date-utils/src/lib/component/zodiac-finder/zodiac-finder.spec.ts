import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZodiacFinderComponent } from './zodiac-finder';

describe('ZodiacFinderComponent', () => {
  let component: ZodiacFinderComponent;
  let fixture: ComponentFixture<ZodiacFinderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZodiacFinderComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ZodiacFinderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
