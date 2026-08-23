import { ToolCategoryCatalog } from './tools-catalog.generated';

export function compareCatalogNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

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
  return sortCatalogByName(
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

/** All routed tool paths (leading slash), for featured/popular lists. */
export function getAllRoutedToolPaths(catalog: ToolCategoryCatalog[]): string[] {
  return catalog.flatMap((category) => category.subCategories.map((tool) => tool.path));
}
