import { ComponentFixture, TestBed } from '@angular/core/testing';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { RandomPasswordGeneratorComponent } from './random-password-generator';

describe('RandomPasswordGeneratorComponent', () => {
  let component: RandomPasswordGeneratorComponent;
  let fixture: ComponentFixture<RandomPasswordGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RandomPasswordGeneratorComponent],
      providers: stToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(RandomPasswordGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
