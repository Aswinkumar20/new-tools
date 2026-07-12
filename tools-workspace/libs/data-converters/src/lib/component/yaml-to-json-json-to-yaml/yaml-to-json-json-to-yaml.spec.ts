import { ComponentFixture, TestBed } from '@angular/core/testing';
import { YamlToJsonJsonToYamlComponent } from './yaml-to-json-json-to-yaml';
import { converterTestProviders } from '../../shared/converter-test.utils';

describe('YamlToJsonJsonToYamlComponent', () => {
  let component: YamlToJsonJsonToYamlComponent;
  let fixture: ComponentFixture<YamlToJsonJsonToYamlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YamlToJsonJsonToYamlComponent],
      providers: converterTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(YamlToJsonJsonToYamlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
