import { ToolCategoryCatalog } from './tools-catalog.generated';
import {
  categoryDisplayRank,
  GLOBAL_POPULAR_TOOL_PATHS,
  isSpecialistHomeCategory,
  normalizeToolPath,
  popularityRank,
  PRIMARY_HOME_CATEGORY_ORDER,
  SPECIALIST_HOME_CATEGORY_ORDER,
} from './tools-popularity.config';

export function compareCatalogNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

export function sortToolsByPopularity<T extends { path: string; name: string }>(
  categoryPath: string,
  tools: T[]
): T[] {
  return [...tools].sort((left, right) => {
    const rankDiff = popularityRank(categoryPath, left.path) - popularityRank(categoryPath, right.path);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return compareCatalogNames(left.name, right.name);
  });
}

export function sortCategoriesForHome<T extends { path: string; name: string; subCategories?: Array<{ path: string; name: string }> }>(
  catalog: T[]
): T[] {
  return [...catalog]
    .map((category) => ({
      ...category,
      subCategories: sortToolsByPopularity(category.path, category.subCategories ?? []),
    }))
    .sort((left, right) => {
      const rankDiff = categoryDisplayRank(left.path) - categoryDisplayRank(right.path);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return compareCatalogNames(left.name, right.name);
    });
}

export function splitHomeCategories<T extends { path: string }>(
  catalog: T[]
): { primary: T[]; specialist: T[] } {
  const primary: T[] = [];
  const specialist: T[] = [];
  for (const category of catalog) {
    if (isSpecialistHomeCategory(category.path)) {
      specialist.push(category);
    } else {
      primary.push(category);
    }
  }
  const sortByConfig = (list: T[], order: readonly string[]) =>
    [...list].sort(
      (left, right) => order.indexOf(left.path) - order.indexOf(right.path) || compareCatalogNames(left.path, right.path)
    );
  return {
    primary: sortByConfig(primary, PRIMARY_HOME_CATEGORY_ORDER),
    specialist: sortByConfig(specialist, SPECIALIST_HOME_CATEGORY_ORDER),
  };
}

/** @deprecated Alphabetical sort — navigation mega-menu still uses A–Z. */
export function sortCatalogByName<T extends { name: string; subCategories?: Array<{ name: string }> }>(
  catalog: T[]
): T[] {
  return catalog
    .map((category) => ({
      ...category,
      subCategories: [...(category.subCategories ?? [])].sort((left, right) =>
        compareCatalogNames(left.name, right.name)
      ),
    }))
    .sort((left, right) => compareCatalogNames(left.name, right.name));
}

export function toHomeToolCategories(catalog: ToolCategoryCatalog[]) {
  return sortCategoriesForHome(
    catalog.map((category) => ({
      name: category.name,
      description: category.description,
      icon: category.faIcon,
      path: category.path,
      subCategories: category.subCategories,
    }))
  );
}

export function toNavigationCategories(catalog: ToolCategoryCatalog[]) {
  return sortCatalogByName(
    catalog.map((category) => ({
      name: category.name,
      description: category.description,
      icon: category.materialIcon,
      path: category.path,
      subCategories: category.subCategories,
    }))
  );
}

export function pickGlobalPopularTools<
  T extends { path: string; name: string; category: string; iconUrl?: string },
>(allTools: T[], limit = 8): T[] {
  const byPath = new Map(allTools.map((tool) => [normalizeToolPath(tool.path), tool]));
  const picked: T[] = [];
  const seen = new Set<string>();

  for (const path of GLOBAL_POPULAR_TOOL_PATHS) {
    const tool = byPath.get(path);
    if (!tool || seen.has(path)) {
      continue;
    }
    picked.push(tool);
    seen.add(path);
    if (picked.length >= limit) {
      return picked;
    }
  }

  for (const tool of allTools) {
    const path = normalizeToolPath(tool.path);
    if (seen.has(path)) {
      continue;
    }
    picked.push(tool);
    seen.add(path);
    if (picked.length >= limit) {
      break;
    }
  }

  return picked;
}

/** All routed tool paths (leading slash), for featured/popular lists. */
export function getAllRoutedToolPaths(catalog: ToolCategoryCatalog[]): string[] {
  return catalog.flatMap((category) => category.subCategories.map((tool) => tool.path));
}
