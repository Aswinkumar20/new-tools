import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { MockJsonGeneratorComponent } from './mock-json-generator';

describe('MockJsonGeneratorComponent', () => {
  let component: MockJsonGeneratorComponent;
  let fixture: ComponentFixture<MockJsonGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MockJsonGeneratorComponent],
      providers: ddToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(MockJsonGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
