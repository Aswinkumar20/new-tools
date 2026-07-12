import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { ZodiacFinderComponent } from './zodiac-finder';

describe('ZodiacFinderComponent', () => {
  let component: ZodiacFinderComponent;
  let fixture: ComponentFixture<ZodiacFinderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZodiacFinderComponent],
      providers: mathToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ZodiacFinderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
