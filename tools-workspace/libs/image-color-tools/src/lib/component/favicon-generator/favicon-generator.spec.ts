import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { FaviconGeneratorComponent } from './favicon-generator';

describe('FaviconGeneratorComponent', () => {
  let component: FaviconGeneratorComponent;
  let fixture: ComponentFixture<FaviconGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaviconGeneratorComponent],
      providers: ictToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(FaviconGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
