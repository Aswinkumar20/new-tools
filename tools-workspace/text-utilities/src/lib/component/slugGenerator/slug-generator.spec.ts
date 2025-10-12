import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SlugGenerator } from './slug-generator';

describe('SlugGenerator', () => {
  let component: SlugGenerator;
  let fixture: ComponentFixture<SlugGenerator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SlugGenerator],
    }).compileComponents();

    fixture = TestBed.createComponent(SlugGenerator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
