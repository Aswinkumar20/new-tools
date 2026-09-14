import { TOOL_CATEGORIES } from './tools-catalog.generated';
import { POPULAR_TOOLS_BY_CATEGORY } from './tools-popularity.config';
import { sortToolsByPopularity } from './tools-catalog.helpers';

describe('tools-popularity.config', () => {
  it('lists every routed tool in popularity order for each category', () => {
    for (const category of TOOL_CATEGORIES) {
      const slugs = category.subCategories.map((tool) => tool.path.replace(/^\/[^/]+\//, ''));
      const ranked = POPULAR_TOOLS_BY_CATEGORY[category.path] ?? [];
      expect(ranked.length).toBe(slugs.length);

      const sorted = sortToolsByPopularity(
        category.path,
        category.subCategories.map((tool) => ({
          name: tool.name,
          path: tool.path,
        }))
      ).map((tool) => tool.path.replace(/^\/[^/]+\//, ''));

      expect(sorted).toEqual(ranked);
      expect(new Set(ranked).size).toBe(slugs.length);
    }
  });
});
