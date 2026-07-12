import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { RandomNumberGeneratorComponent } from './random-number-generator';

describe('RandomNumberGeneratorComponent', () => {
  let component: RandomNumberGeneratorComponent;
  let fixture: ComponentFixture<RandomNumberGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RandomNumberGeneratorComponent],
      providers: ftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(RandomNumberGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
