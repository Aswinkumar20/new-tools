import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { GradientGeneratorComponent } from './gradient-generator';

describe('GradientGeneratorComponent', () => {
  let component: GradientGeneratorComponent;
  let fixture: ComponentFixture<GradientGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GradientGeneratorComponent],
      providers: ictToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(GradientGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
