import { TOOL_CATEGORIES } from '../../../libs/features-home/src/lib/config/tools-catalog.generated';
import { COMING_SOON_PATHS } from '../../../apps/tools-site/src/app/config/tool-seo-catalog.generated';

export interface ToolRoute {
  path: string;
  name: string;
  category: string;
  comingSoon: boolean;
}

const comingSoonSet = new Set<string>(COMING_SOON_PATHS);

/** All routed tools from the generated catalog. */
export const TOOL_ROUTES: ToolRoute[] = TOOL_CATEGORIES.flatMap((category) =>
  category.subCategories.map((tool) => ({
    path: tool.path,
    name: tool.name,
    category: category.name,
    comingSoon: comingSoonSet.has(tool.path),
  }))
);

export const LIVE_TOOL_ROUTES = TOOL_ROUTES.filter((tool) => !tool.comingSoon);
export const COMING_SOON_TOOL_ROUTES = TOOL_ROUTES.filter((tool) => tool.comingSoon);
