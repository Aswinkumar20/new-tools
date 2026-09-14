import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

export interface ToolAuditFinding {
  check: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  detail: string;
}

export interface ToolAuditReport {
  path: string;
  name: string;
  category: string;
  findings: ToolAuditFinding[];
  summary: { pass: number; fail: number; warn: number; skip: number };
}

const UNSAFE_BUTTON = /clear|delete|reset|remove|logout|sign out|discard/i;

export async function collectRuntimeErrors(page: Page): Promise<{ fatal: string[]; warnings: string[] }> {
  const fatal: string[] = [];
  const warnings: string[] = [];

  page.on('pageerror', (error) => fatal.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') {
      return;
    }
    const text = msg.text();
    if (/Failed to load resource|404|favicon|net::ERR_/i.test(text)) {
      warnings.push(text);
      return;
    }
    fatal.push(text);
  });

  return { fatal, warnings };
}

function record(
  findings: ToolAuditFinding[],
  check: string,
  status: ToolAuditFinding['status'],
  detail: string
): void {
  findings.push({ check, status, detail });
}

function summarize(findings: ToolAuditFinding[]): ToolAuditReport['summary'] {
  return findings.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { pass: 0, fail: 0, warn: 0, skip: 0 }
  );
}

async function auditLayout(page: Page, findings: ToolAuditFinding[]): Promise<void> {
  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector('main');
    const h1 = document.querySelector('h1');
    const mainRect = main?.getBoundingClientRect();
    const h1Rect = h1?.getBoundingClientRect();
    return {
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 2,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      mainHeight: mainRect?.height ?? 0,
      h1Visible:
        !!h1Rect &&
        h1Rect.width > 0 &&
        h1Rect.height > 0 &&
        h1Rect.bottom > 0 &&
        h1Rect.top < window.innerHeight,
      h1Text: h1?.textContent?.trim() ?? '',
    };
  });

  if (layout.horizontalOverflow) {
    record(
      findings,
      'layout',
      'fail',
      `Horizontal overflow detected (scroll ${layout.scrollWidth}px vs viewport ${layout.clientWidth}px)`
    );
  } else {
    record(findings, 'layout', 'pass', 'No horizontal overflow');
  }

  if (layout.mainHeight < 120) {
    record(findings, 'content', 'fail', `Main content area too short (${Math.round(layout.mainHeight)}px)`);
  } else {
    record(findings, 'content', 'pass', `Main content height ${Math.round(layout.mainHeight)}px`);
  }

  if (!layout.h1Visible || !layout.h1Text) {
    record(findings, 'heading', 'fail', 'Primary heading missing or not visible in viewport');
  } else {
    record(findings, 'heading', 'pass', `Heading visible: "${layout.h1Text.slice(0, 80)}"`);
  }
}

async function auditButtons(page: Page, findings: ToolAuditFinding[]): Promise<void> {
  const buttons = page.locator('main button:visible');
  const count = await buttons.count();

  if (count === 0) {
    record(findings, 'buttons', 'warn', 'No visible buttons in main workspace');
    return;
  }

  record(findings, 'buttons', 'pass', `${count} visible button(s) in main`);

  const maxChecks = Math.min(count, 8);
  for (let i = 0; i < maxChecks; i++) {
    const button = buttons.nth(i);
    let label = '';
    try {
      label =
        (await button.getAttribute('aria-label', { timeout: 2_000 })) ??
        (await button.innerText({ timeout: 2_000 })).trim().slice(0, 60) ??
        `button-${i + 1}`;
    } catch {
      record(findings, 'button-click', 'warn', `Could not read button ${i + 1}`);
      continue;
    }

    if (UNSAFE_BUTTON.test(label)) {
      record(findings, 'button-click', 'skip', `Skipped risky action: ${label}`);
      continue;
    }

    try {
      await button.click({ trial: true, timeout: 2_000 });
      record(findings, 'button-click', 'pass', `Actionable: ${label}`);
    } catch {
      record(findings, 'button-click', 'warn', `Not actionable: ${label}`);
    }
  }
}

async function auditExportActions(page: Page, findings: ToolAuditFinding[]): Promise<void> {
  const exportButtons = page.locator(
    'main button:visible[aria-label*="Download" i], main button:visible[aria-label*="Copy" i], main button:visible[aria-label*="Export" i], main button:visible[aria-label*="PDF" i], main button:visible[aria-label*="TXT" i]'
  );
  const count = await exportButtons.count();

  if (count === 0) {
    record(findings, 'export', 'skip', 'No export/download/copy buttons detected');
    return;
  }

  const maxChecks = Math.min(count, 6);
  for (let i = 0; i < maxChecks; i++) {
    const button = exportButtons.nth(i);
    let label = '';
    try {
      label =
        (await button.getAttribute('aria-label', { timeout: 2_000 })) ??
        (await button.innerText({ timeout: 2_000 })).trim();
    } catch {
      continue;
    }

    try {
      await button.click({ trial: true, timeout: 2_000 });
      record(findings, 'export', 'pass', `Export/copy control present: ${label.slice(0, 80)}`);
    } catch {
      record(findings, 'export', 'warn', `Export control not clickable: ${label.slice(0, 80)}`);
    }
  }
}

async function auditTextInput(page: Page, findings: ToolAuditFinding[]): Promise<void> {
  const textarea = page.locator('main textarea:visible').first();
  if ((await textarea.count()) === 0) {
    record(findings, 'text-input', 'skip', 'No textarea in main');
    return;
  }

  await textarea.fill('Audit sample text. Two sentences for counters.');
  const value = await textarea.inputValue();
  if (value.includes('Audit sample')) {
    record(findings, 'text-input', 'pass', 'Textarea accepts input and updates');
  } else {
    record(findings, 'text-input', 'fail', 'Textarea did not retain typed content');
  }
}

async function auditFileUpload(page: Page, findings: ToolAuditFinding[]): Promise<void> {
  const fileInput = page.locator('main input[type="file"]').first();
  if ((await fileInput.count()) === 0) {
    record(findings, 'upload', 'skip', 'No file upload control in main');
    return;
  }

  const accept = (await fileInput.getAttribute('accept')) ?? 'any';
  const multiple = (await fileInput.getAttribute('multiple')) ?? 'false';
  record(
    findings,
    'upload',
    'pass',
    `File input present (accept=${accept || 'any'}, multiple=${multiple})`
  );
}

async function attachReport(testInfo: TestInfo, report: ToolAuditReport): Promise<void> {
  await testInfo.attach(`${report.path}-audit.json`, {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  });

  const lines = [
    `# Audit: ${report.name}`,
    `Path: ${report.path}`,
    `Category: ${report.category}`,
    '',
    '| Check | Status | Detail |',
    '| ----- | ------ | ------ |',
    ...report.findings.map(
      (f) => `| ${f.check} | ${f.status} | ${f.detail.replace(/\|/g, '\\|')} |`
    ),
    '',
    `Summary: ${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.warn} warn, ${report.summary.skip} skip`,
  ];

  await testInfo.attach(`${report.path}-audit.md`, {
    body: Buffer.from(lines.join('\n')),
    contentType: 'text/markdown',
  });
}

export async function runLiveToolAudit(
  page: Page,
  tool: { path: string; name: string; category: string },
  testInfo: TestInfo
): Promise<ToolAuditReport> {
  const findings: ToolAuditFinding[] = [];
  const { fatal, warnings } = await collectRuntimeErrors(page);

  const response = await page.goto(tool.path, { waitUntil: 'domcontentloaded' });
  if (!response || response.status() >= 400) {
    record(findings, 'route', 'fail', `HTTP ${response?.status() ?? 'no response'}`);
  } else {
    record(findings, 'route', 'pass', `HTTP ${response.status()}`);
  }

  await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Coming soon', { exact: true })).toHaveCount(0);

  await auditLayout(page, findings);
  await auditButtons(page, findings);
  await auditExportActions(page, findings);
  await auditTextInput(page, findings);
  await auditFileUpload(page, findings);

  if (fatal.length) {
    record(findings, 'runtime', 'fail', fatal.slice(0, 5).join(' | '));
  } else {
    record(findings, 'runtime', 'pass', 'No uncaught page errors');
  }

  if (warnings.length) {
    record(findings, 'assets', 'warn', warnings.slice(0, 3).join(' | '));
  }

  await page.screenshot({ path: testInfo.outputPath(`${tool.path.replace(/\//g, '_')}.png`), fullPage: true });

  const report: ToolAuditReport = {
    path: tool.path,
    name: tool.name,
    category: tool.category,
    findings,
    summary: summarize(findings),
  };

  await attachReport(testInfo, report);

  for (const finding of findings.filter((f) => f.status === 'fail')) {
    expect.soft(false, `[${finding.check}] ${finding.detail}`).toBeTruthy();
  }

  return report;
}

export async function runComingSoonAudit(
  page: Page,
  tool: { path: string; name: string; category: string },
  testInfo: TestInfo
): Promise<ToolAuditReport> {
  const findings: ToolAuditFinding[] = [];
  const { fatal, warnings } = await collectRuntimeErrors(page);

  const response = await page.goto(tool.path, { waitUntil: 'domcontentloaded' });
  record(
    findings,
    'route',
    response && response.status() < 400 ? 'pass' : 'fail',
    `HTTP ${response?.status() ?? 'no response'}`
  );

  await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
  record(findings, 'coming-soon', 'pass', 'Coming soon badge visible');

  if (fatal.length) {
    record(findings, 'runtime', 'fail', fatal.slice(0, 3).join(' | '));
  } else {
    record(findings, 'runtime', 'pass', 'No page errors');
  }

  const report: ToolAuditReport = {
    path: tool.path,
    name: tool.name,
    category: tool.category,
    findings,
    summary: summarize(findings),
  };

  await attachReport(testInfo, report);
  return report;
}

export function mainWorkspace(page: Page): Locator {
  return page.locator('main');
}
