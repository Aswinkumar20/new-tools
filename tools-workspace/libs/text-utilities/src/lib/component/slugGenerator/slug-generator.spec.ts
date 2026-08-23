import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SlugGeneratorComponent } from './slug-generator';

describe('SlugGenerator', () => {
  let component: SlugGeneratorComponent;
  let fixture: ComponentFixture<SlugGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SlugGeneratorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SlugGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
