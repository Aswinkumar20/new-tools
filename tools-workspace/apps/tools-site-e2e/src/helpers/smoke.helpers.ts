import { expect, type Page } from '@playwright/test';

/** Visible tool surfaces — excludes hidden file inputs that appear earlier in DOM order. */
const VISIBLE_TOOL_SURFACE =
  'main [class*="__workspace"]:visible, main [class*="__editor"]:visible, main [class*="__editors"]:visible, main textarea:visible, main canvas:visible, main [class*="__workflow"]:visible, main [class*="__stats"]:visible';

export async function collectPageErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export async function assertToolPageReady(page: Page, toolPath: string): Promise<void> {
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });

  const comingSoon = page.locator('.cst__badge').filter({ hasText: 'Coming soon' });
  if (await comingSoon.isVisible().catch(() => false)) {
    return;
  }

  const visibleSurface = page.locator(VISIBLE_TOOL_SURFACE);
  if ((await visibleSurface.count()) > 0) {
    await expect(
      visibleSurface.first(),
      `${toolPath} should render a visible tool workspace in main`
    ).toBeVisible({ timeout: 15_000 });
    return;
  }

  // Upload-first tools keep <input type="file" hidden> and expose an Upload button instead.
  const uploadControl = page.locator(
    'main button[aria-label*="Upload" i], main button:has-text("Upload"), main [class*="drop"]:visible'
  );
  await expect(
    uploadControl.first(),
    `${toolPath} should expose upload UI or a visible workspace`
  ).toBeVisible({ timeout: 15_000 });
}
