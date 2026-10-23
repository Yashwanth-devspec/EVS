import { test, expect } from '@playwright/test';
import { demo, qaShot, resetWorld, sessionId } from './helpers';

test('Watch it work finishes at 2x in under 120 s and leaves the app in a valid state', async ({ page, request }, info) => {
  await resetWorld(request);
  await page.goto('/');
  await page.locator(demo('watch-demo')).click();
  await page.getByRole('radio', { name: '2x' }).click();
  const started = Date.now();

  await expect(page.locator(demo('autopilot-step'))).toContainText('Step 6 of 15', { timeout: 60_000 });
  await qaShot(page, info, 'autopilot_running');

  await expect(page.locator(demo('autopilot-caption'))).toContainText('That’s the whole trip', { timeout: 120_000 });
  const elapsed = Date.now() - started;
  expect(elapsed).toBeLessThan(120_000);
  test.info().annotations.push({ type: 'autopilot 2x duration', description: `${Math.round(elapsed / 1000)} s` });

  // Valid end state: the trip is done on screen and on the server
  await expect(page.locator(demo('trip-done'))).toBeVisible();
  const sid = await sessionId(page);
  const trip = await (await request.get('/api/trip', { headers: { 'X-Session-ID': sid } })).json();
  expect(trip.state).toBe('done');
  expect(trip.group.final_fare).toBeGreaterThan(0);
  await qaShot(page, info, 'autopilot_done');
});

test('a real tap pauses the demo and offers Resume', async ({ page, request }) => {
  await resetWorld(request);
  await page.goto('/');
  await page.locator(demo('watch-demo')).click();
  await expect(page.locator(demo('autopilot-step'))).toContainText('Step 3 of 15', { timeout: 30_000 });
  await page.mouse.click(30, 300);
  await expect(page.locator(demo('autopilot-caption'))).toContainText('Paused because you touched the screen');
  await expect(page.locator(demo('autopilot-toggle'))).toHaveText('Resume');
  await page.locator(demo('autopilot-toggle')).click();
  await expect(page.locator(demo('autopilot-toggle'))).toHaveText('Pause');
  await page.getByRole('button', { name: 'Close the demo' }).click();
});

test('reset restores the seed', async ({ request }) => {
  const reset = await (await request.post('/api/demo/reset')).json();
  const before = await (await request.get('/api/pool/outlook')).json();
  expect(before.total_active_pool).toBe(reset.count);

  // Make a mess: a trip, an invite, a group, a later clock
  const headers = { 'X-Session-ID': 'sess_e2e_mess_01' };
  await request.post('/api/requests', {
    headers,
    data: { dest_lat: 12.9308, dest_lng: 77.5838, scheduled_arrival: new Date().toISOString(), area: 'Jayanagar' },
  });
  const trip = await (await request.get('/api/trip', { headers })).json();
  const best = trip.options.groups.find((g: any) => g.id === trip.options.best_id);
  await request.post('/api/proposals', {
    headers,
    data: { member_request_ids: best.members.filter((m: any) => !m.is_you).map((m: any) => m.request_id) },
  });
  await request.post('/api/demo/respond', { headers });
  await request.post('/api/demo/advance', { params: { minutes: 60 } });

  const again = await (await request.post('/api/demo/reset')).json();
  expect(again.count).toBe(reset.count);
  const after = await (await request.get('/api/pool/outlook')).json();
  expect(after.total_active_pool).toBe(reset.count);
  const health = await (await request.get('/api/health')).json();
  expect(Math.abs(health.clock_offset_minutes)).toBeLessThan(0.01);
  expect((await (await request.get('/api/trip', { headers })).json()).state).toBe('start');
});
