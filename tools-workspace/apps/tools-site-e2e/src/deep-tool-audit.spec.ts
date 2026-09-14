import { test } from '@playwright/test';
import {
  COMING_SOON_TOOL_ROUTES,
  LIVE_TOOL_ROUTES,
} from './tool-routes';
import { runComingSoonAudit, runLiveToolAudit } from './helpers/tool-audit.helpers';

test.describe('deep tool audit @deep', () => {
  test.describe.configure({ mode: 'parallel', timeout: 90_000 });

  for (const tool of LIVE_TOOL_ROUTES) {
    test(`${tool.path} deep audit (${tool.name})`, async ({ page }, testInfo) => {
      await runLiveToolAudit(page, tool, testInfo);
    });
  }

  for (const tool of COMING_SOON_TOOL_ROUTES) {
    test(`${tool.path} coming soon audit (${tool.name})`, async ({ page }, testInfo) => {
      await runComingSoonAudit(page, tool, testInfo);
    });
  }
});
