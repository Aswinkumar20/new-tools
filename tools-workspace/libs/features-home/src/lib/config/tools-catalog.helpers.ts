import { ToolCategoryCatalog } from './tools-catalog.generated';

export function toHomeToolCategories(catalog: ToolCategoryCatalog[]) {
  return catalog.map((category) => ({
    name: category.name,
    description: category.description,
    icon: category.faIcon,
    path: category.path,
    subCategories: category.subCategories,
  }));
}

export function toNavigationCategories(catalog: ToolCategoryCatalog[]) {
  return catalog.map((category) => ({
    name: category.name,
    description: category.description,
    icon: category.materialIcon,
    path: category.path,
    subCategories: category.subCategories,
  }));
}

/** All routed tool paths (leading slash), for featured/popular lists. */
export function getAllRoutedToolPaths(catalog: ToolCategoryCatalog[]): string[] {
  return catalog.flatMap((category) => category.subCategories.map((tool) => tool.path));
}
