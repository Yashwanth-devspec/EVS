import { test, expect } from '@playwright/test';
import { demo, qaShot, resetWorld } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

test('the homepage explains the product and the top bar is never empty', async ({ page }, info) => {
  await page.goto('/');
  const header = page.locator('header').first();
  await expect(header.getByRole('button', { name: 'EcoRide Share home' })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Find a cab share' })).toBeVisible();

  await expect(page.getByText(
    'EcoRide Share matches you with people landing at Bengaluru airport around the same time and heading your way, so you split one cab instead of paying for your own.'
  )).toBeVisible();
  const stat = page.locator(`${demo('hero-stat')}:visible`);
  await expect(stat).toContainText('With 3 people, each');
  await expect(stat).toContainText('est.');
  await expect(page.getByText('No account. We don’t run the cabs or touch your money.')).toBeVisible();
  for (const q of ['What’s the problem?', 'What does it look like?', 'How does it work?', 'What do I save?', 'Is it safe?', 'What difference does it make?', 'Questions']) {
    await expect(page.locator('section').getByText(q, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('11:45 pm. 12 passengers. 12 cabs. Same road.')).toBeVisible();

  // Only claims the product delivers
  const body = await page.locator('body').innerText();
  for (const banned of ['police kiosk', 'pickup pillar', 'peace of mind']) expect(body.toLowerCase()).not.toContain(banned);
  expect(/\p{Extended_Pictographic}/u.test(body)).toBe(false);

  // No all-caps labels (the rubber stamp in the phone preview is the one deliberate exception)
  const caps = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => getComputedStyle(el).textTransform === 'uppercase' && !(el as HTMLElement).closest('[aria-label^="Status stamp"]'))
      .map((el) => (el as HTMLElement).innerText.slice(0, 30))
  );
  expect(caps).toEqual([]);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await qaShot(page, info, info.project.name === 'desktop' ? 'home_desktop_fold' : 'home_mobile_fold');
  if (info.project.name === 'iphone' || info.project.name === 'desktop') {
    await page.screenshot({ path: `qa/${info.project.name === 'desktop' ? 'home_desktop_full' : 'home_mobile_full'}.png`, fullPage: true });
  }
});

test('on phones a sticky Find a cab share bar appears after the hero', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'phones only');
  await page.goto('/');
  const bar = page.locator(demo('sticky-cta'));
  await expect(bar).toHaveAttribute('aria-hidden', 'true');
  await page.locator('#how').scrollIntoViewIfNeeded();
  await expect(bar).toHaveAttribute('aria-hidden', 'false');
  await qaShot(page, info, 'home_mobile_sticky_cta');
});

test('methodology says what can go wrong', async ({ page }) => {
  await page.goto('/methodology');
  const section = page.locator('#what-can-go-wrong');
  for (const t of ['Nobody on your flight is going your way', 'The estimate isn’t the real fare', 'Some entries are self-declared', 'The cab app sets the price']) {
    await expect(section).toContainText(t);
  }
});
