import { ComponentFixture, TestBed } from '@angular/core/testing';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { HashGeneratorComponent } from './hash-generator';

describe('HashGeneratorComponent', () => {
  let component: HashGeneratorComponent;
  let fixture: ComponentFixture<HashGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HashGeneratorComponent],
      providers: stToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(HashGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
