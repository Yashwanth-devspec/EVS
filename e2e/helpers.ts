import { APIRequestContext, Page, expect, TestInfo } from '@playwright/test';

export const demo = (target: string) => `[data-demo="${target}"]`;

/** Screenshots go to /qa, but only from the iPhone (390x844) project so files aren't overwritten. */
export async function qaShot(page: Page, info: TestInfo, name: string) {
  if (info.project.name !== 'iphone' && info.project.name !== 'desktop') return;
  await page.waitForTimeout(450);
  await page.screenshot({ path: `qa/${name}.png` });
}

export async function resetWorld(request: APIRequestContext, scenario: 'full' | 'stage' = 'full') {
  const r = await request.post('/api/demo/reset', { params: { scenario } });
  expect(r.ok()).toBeTruthy();
}

export async function sessionId(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('ecoride_session_id') || '');
}

export async function tripState(page: Page): Promise<string> {
  return (await page.locator(demo('sheet-status')).getAttribute('data-state')) ?? '';
}

export async function expectState(page: Page, state: string, timeout = 20_000) {
  await expect(page.locator(demo('sheet-status'))).toHaveAttribute('data-state', state, { timeout });
}

/** Where + when, then Find people. */
export async function startTrip(page: Page, query = 'Jayanagar', resultIndex = 0) {
  await page.goto('/trip');
  await page.locator(demo('where-input')).fill(query);
  await page.locator(demo(`where-result-${resultIndex}`)).click();
  await page.locator(demo('land-chip-1')).click();
  await page.locator(demo('find-people')).click();
}
