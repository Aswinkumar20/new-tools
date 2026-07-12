import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { LoremIpsumGeneratorComponent } from './lorem-ipsum-generator';

describe('LoremIpsumGeneratorComponent', () => {
  let component: LoremIpsumGeneratorComponent;
  let fixture: ComponentFixture<LoremIpsumGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoremIpsumGeneratorComponent],
      providers: ftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(LoremIpsumGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
