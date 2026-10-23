import { test, expect } from '@playwright/test';
import { demo, qaShot, resetWorld, sessionId, expectState, startTrip } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

test('the full trip, as the person booking, through every state', async ({ page, request }, info) => {
  await page.goto('/trip');
  await expectState(page, 'start');
  await qaShot(page, info, 'trip_01_start');

  // Where: type-ahead results show a bold name and a secondary line
  await page.locator(demo('where-input')).fill('Jayanagar 4th');
  await expect(page.locator(demo('where-result-1'))).toContainText('Jayanagar 4th Block');
  await qaShot(page, info, 'trip_02_where_results');
  await page.locator(demo('where-result-1')).click();
  await expect(page.locator(demo('where-selected'))).toContainText('Exact address');
  await page.locator(demo('drop-detail')).fill('Flat 4B, blue gate');

  // When: one chip
  await page.locator(demo('land-chip-1')).click();
  await qaShot(page, info, 'trip_03_where_and_when');

  // Searching is shown for at least 1.5 s
  await page.locator(demo('find-people')).click();
  await expect(page.locator(demo('trip-searching'))).toBeVisible();
  const searchingFrom = Date.now();
  await qaShot(page, info, 'trip_04_searching');
  await expect(page.locator(demo('best-match'))).toBeVisible({ timeout: 20_000 });
  expect(Date.now() - searchingFrom).toBeGreaterThanOrEqual(1000);
  await expectState(page, 'options');
  await qaShot(page, info, 'trip_05_options');

  await page.locator(demo('other-options')).click();
  await qaShot(page, info, 'trip_06_other_options');
  await page.locator(demo('best-match')).click();

  // Share: the first name is asked for only now
  await page.locator(demo('share-cab')).click();
  await page.locator(demo('name-input')).fill('Asha');
  await qaShot(page, info, 'trip_07_first_name');
  await page.locator(demo('name-confirm')).click();
  await expectState(page, 'invite_sent');
  await qaShot(page, info, 'trip_08_invite_sent');

  // Demo travellers accept after 3-6 s
  await expectState(page, 'confirmed', 25_000);
  await expect(page.locator(demo('trip-confirmed'))).toContainText('Demo traveller');
  await expect(page.locator(demo('trip-confirmed'))).toContainText('Flat 4B, blue gate');
  await qaShot(page, info, 'trip_09_confirmed');

  // A refresh resumes the same state (it comes from the server)
  await page.reload();
  await expectState(page, 'confirmed');

  const sid = await sessionId(page);
  await request.post('/api/demo/advance-to-landing', { headers: { 'X-Session-ID': sid } });
  await page.locator(demo('landed')).click();
  await expectState(page, 'landed');
  await expect(page.locator(demo('pickup-code'))).toBeVisible();
  await qaShot(page, info, 'trip_10_landed');

  await page.locator(demo('at-pickup')).click();
  await expectState(page, 'at_pickup');
  await qaShot(page, info, 'trip_11_at_pickup_booker');

  await page.locator(demo('open-uber')).click();
  await expect(page.locator(demo('handoff'))).toBeVisible();
  const uber = await page.locator(demo('open-uber-app')).getAttribute('href');
  expect(uber).toContain('https://m.uber.com/ul/');
  expect(uber).not.toContain('Flat');
  await qaShot(page, info, 'trip_12_handoff');
  await page.locator(demo('handoff-close')).click();

  await page.locator(demo('cab-input')).fill('KA 01 AB 1234');
  await page.locator(demo('cab-save')).click();
  await expectState(page, 'cab_booked');
  await expect(page.locator(demo('cab-number'))).toHaveText('KA 01 AB 1234');
  await qaShot(page, info, 'trip_13_cab_booked');

  await page.locator(demo('settle-up')).click();
  await expectState(page, 'settle');
  await page.locator(demo('fare-input')).fill('1720');
  await page.locator(demo('upi-input')).fill('asha@okaxis');
  await qaShot(page, info, 'trip_14_settle_enter_fare');
  await page.locator(demo('split-fare')).click();
  await expect(page.locator(demo('finish'))).toBeVisible();
  await expect(page.locator(demo('trip-settle'))).toContainText('Rs 1,720');
  await qaShot(page, info, 'trip_15_settle_split');

  await page.locator(demo('finish')).click();
  await expectState(page, 'done');
  await expect(page.locator(demo('impact-total'))).toContainText('kg CO2');
  await qaShot(page, info, 'trip_16_done');

  await page.locator(demo('new-trip')).click();
  await expectState(page, 'start');
});

test('an invite received, as a traveller who is not booking', async ({ page, request }, info) => {
  await startTrip(page);
  await expectState(page, 'options', 25_000);
  const sid = await sessionId(page);
  const r = await request.post('/api/demo/invite-me', { headers: { 'X-Session-ID': sid } });
  expect(r.ok()).toBeTruthy();

  await expect(page.locator(demo('invite-received'))).toBeVisible();
  await expect(page.locator(demo('invite-received'))).toContainText('wants to share a cab with you');
  await qaShot(page, info, 'trip_17_invite_received');

  await page.locator(demo('accept-invite')).click();
  await page.locator(demo('name-input')).fill('Ravi');
  await page.locator(demo('name-confirm')).click();
  await expectState(page, 'confirmed');
  await expect(page.locator(demo('trip-confirmed'))).toContainText('Exact addresses go only to');

  await request.post('/api/demo/advance-to-landing', { headers: { 'X-Session-ID': sid } });
  await page.locator(demo('landed')).click();
  await expectState(page, 'landed');
  await page.locator(demo('at-pickup')).click();
  await expectState(page, 'at_pickup');
  await expect(page.locator(demo('sheet-status'))).toContainText('Wait for the cab details');
  await qaShot(page, info, 'trip_18_at_pickup_rider');

  // The demo traveller who is booking adds the cab number, then the fare
  await expectState(page, 'cab_booked', 20_000);
  await qaShot(page, info, 'trip_19_cab_booked_rider');
  await expect(page.locator(demo('paid'))).toBeVisible({ timeout: 25_000 });
  await qaShot(page, info, 'trip_20_settle_rider');
  await page.locator(demo('paid')).click();
  await expectState(page, 'done');
});

test('nobody heading your way, invite someone from your flight, and the join link', async ({ page, browser }, info) => {
  await page.goto('/trip');
  // A pasted Google Maps link (Nandi Hills: in range, nobody else going there)
  await page.getByRole('button', { name: 'Paste a Google Maps link' }).click();
  await page.getByLabel('Google Maps link').fill('https://www.google.com/maps/place/Nandi+Hills/@13.3702,77.6835,15z');
  await page.getByRole('button', { name: 'Use link' }).click();
  await expect(page.locator(demo('where-selected'))).toContainText('Pin on the map');
  await page.locator(demo('land-chip-1')).click();
  await page.locator(demo('find-people')).click();
  await expectState(page, 'no_match', 20_000);
  await expect(page.locator(demo('sheet-status'))).toContainText('Nobody heading your way yet. We’ll keep looking until you land.');
  await expect(page.locator(demo('book-alone'))).toHaveAttribute('href', /m\.uber\.com/);
  await qaShot(page, info, 'trip_21_no_match');

  // Don't actually open WhatsApp: answer wa.me with a stub page and read the URL
  await page.context().route(/wa\.me|whatsapp\.com/, (route) => route.fulfill({ body: 'stub', contentType: 'text/plain' }));
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator(demo('invite-flight')).click()]);
  await popup.waitForURL(/wa\.me/);
  const waUrl = decodeURIComponent(popup.url());
  await popup.close();
  expect(waUrl).toMatch(/wa\.me|whatsapp/);
  const joinPath = waUrl.match(/\/j\/[A-Za-z0-9_-]+/)?.[0];
  expect(joinPath).toBeTruthy();

  // Someone else opens it: airport and landing time are already filled in
  const other = await browser.newContext({ ...info.project.use });
  const p2 = await other.newPage();
  await p2.goto(joinPath!);
  await expect(p2.getByText('Filled in from your invite link')).toBeVisible();
  await expect(p2.locator(demo('land-chip-1'))).toHaveAttribute('aria-checked', 'true');
  await qaShot(p2, info, 'trip_22_join_link');
  await p2.goto('/j/expired-token');
  await expect(p2.locator(demo('join-expired'))).toBeVisible();
  await other.close();
});

test('address search falls back to a pin, and far drops are refused', async ({ page }, info) => {
  await page.goto('/trip');
  await page.locator(demo('where-input')).fill('zzqx road');
  await expect(page.getByText('No matches yet')).toBeVisible();
  await qaShot(page, info, 'trip_23_search_no_results');

  await page.locator(demo('drop-pin')).click();
  const sheet = page.locator(demo('pin-sheet'));
  await expect(sheet).toBeVisible();
  const box = (await sheet.locator('.leaflet-container').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 60, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(demo('pin-confirm'))).toBeEnabled({ timeout: 10_000 });
  await expect(sheet).toContainText('Near');
  await qaShot(page, info, 'trip_24_drop_pin');
  await page.locator(demo('pin-confirm')).click();
  await expect(page.locator(demo('where-selected'))).toContainText('Pin on the map');

  await page.locator(demo('where-change')).click();
  await page.locator(demo('where-input')).fill('Mysuru');
  await page.locator(demo('where-result-0')).click();
  await expect(page.getByRole('alert')).toContainText('That\'s too far for a shared cab from the airport. Try a closer drop point, or book alone.');
  await expect(page.locator(demo('find-people'))).toBeDisabled();
  await qaShot(page, info, 'trip_25_out_of_range');
});
