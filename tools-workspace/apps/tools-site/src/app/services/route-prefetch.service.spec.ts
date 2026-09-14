import { RoutePrefetchService } from './route-prefetch.service';

describe('RoutePrefetchService', () => {
  it('ignores home and single-segment paths', () => {
    const service = new RoutePrefetchService();
    expect(() => service.prefetch('/tools/home')).not.toThrow();
    expect(() => service.prefetch('pdf-tools')).not.toThrow();
  });
});
