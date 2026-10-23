import { test, expect } from '@playwright/test';
import { demo, qaShot } from './helpers';

test('the /demo two-phone stage runs unattended to the end', async ({ page }, info) => {
  await page.goto('/demo?autoplay=1');
  await page.getByRole('radio', { name: '2x' }).click();
  await expect(page.locator(demo('stage-step'))).toContainText('Step 5 of 10', { timeout: 90_000 });
  await qaShot(page, info, 'demo_stage_running');
  await expect(page.locator(demo('stage-caption'))).toContainText('That’s the whole trip, seen from both phones.', { timeout: 140_000 });
  await expect(page.locator(demo('demo-chip')).first()).toBeVisible();
  await qaShot(page, info, 'demo_stage_done');
});
