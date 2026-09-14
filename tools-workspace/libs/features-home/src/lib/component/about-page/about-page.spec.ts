import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AboutPageComponent } from './about-page';

describe('AboutPageComponent', () => {
  let component: AboutPageComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AboutPageComponent],
      providers: [provideRouter([])],
    });

    component = TestBed.createComponent(AboutPageComponent).componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should build stats from the catalog', () => {
    const stats = (component as unknown as { stats: Array<{ label: string }> }).stats;

    expect(stats).toHaveLength(4);
    expect(stats.map((item) => item.label)).toEqual([
      'Tools',
      'Categories',
      'Free',
      'In-browser',
    ]);
  });
});
