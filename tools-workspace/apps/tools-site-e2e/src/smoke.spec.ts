import { test, expect } from '@playwright/test';
import { TOOL_ROUTES } from './tool-routes';
import { assertToolPageReady, collectPageErrors } from './helpers/smoke.helpers';

test.describe('smoke @smoke', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const tool of TOOL_ROUTES) {
    test(`${tool.path} loads (${tool.name})`, async ({ page }) => {
      const errors = await collectPageErrors(page);

      const response = await page.goto(tool.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${tool.path} should not 404`).toBeLessThan(400);

      await assertToolPageReady(page, tool.path);
      expect(errors, `${tool.path} should not throw runtime errors`).toEqual([]);
    });
  }
});

test('smoke catalog covers every routed tool', () => {
  expect(TOOL_ROUTES.length).toBeGreaterThan(300);
});
