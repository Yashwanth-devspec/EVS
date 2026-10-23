import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const BASE_URL = 'http://localhost:5173';
const QA_DIR = resolve('qa');
if (!existsSync(QA_DIR)) {
  mkdirSync(QA_DIR, { recursive: true });
}

async function clickByText(page, text, selector = 'button, a') {
  return page.eval(
    ({ text, selector }) => {
      const els = [...document.querySelectorAll(selector)];
      const target = els.find((el) => (el.innerText || '').toLowerCase().includes(text.toLowerCase()));
      if (target) {
        target.click();
        return true;
      }
      return false;
    },
    { text, selector }
  );
}

async function runQa() {
  console.log('--- Starting Browser QA Walkthrough for EcoRide Share ---');
  const browser = await Browser.launch({ width: 1440, height: 900 });

  try {
    // -------------------------------------------------------------
    // 1. DESKTOP VIEWPORT (1440 x 900)
    // -------------------------------------------------------------
    console.log('\n[1/3] Capturing Desktop Viewports (1440x900)...');
    const pDesktop = await browser.newPage({ width: 1440, height: 900 });
    await pDesktop.goto(BASE_URL, { settleMs: 1500 });

    // 01 Landing Desktop
    console.log('Capturing 01_landing_desktop.png');
    await pDesktop.screenshot({ path: join(QA_DIR, '01_landing_desktop.png'), format: 'png' });

    // 02 Check-in Desktop
    console.log('Navigating to Find a cab share...');
    await clickByText(pDesktop, 'Find a cab share');
    await sleep(1000);
    console.log('Capturing 02_checkin_desktop.png');
    await pDesktop.screenshot({ path: join(QA_DIR, '02_checkin_desktop.png'), format: 'png' });

    // Prefill NOW scenario via Demo Drawer
    console.log('Triggering Demo Scenario NOW group...');
    await clickByText(pDesktop, 'Demo');
    await sleep(600);
    await clickByText(pDesktop, 'NOW Group (Jayanagar');
    await sleep(1000);

    // Submit ticket to enter Ride Pool
    console.log('Submitting ticket to enter Ride Pool...');
    await pDesktop.eval(() => {
      const btn = document.getElementById('submit-ticket-btn');
      if (btn) btn.click();
    });
    await sleep(2500);

    // 03 Pool Timeline Desktop (Best Match Hero + Collapsed Options)
    console.log('Capturing 03_pool_best_match_desktop.png');
    await pDesktop.screenshot({ path: join(QA_DIR, '03_pool_best_match_desktop.png'), format: 'png' });

    // Expand Other Options to see WaitSaveChart & Outlook
    console.log('Expanding See other options...');
    await clickByText(pDesktop, 'See other options');
    await sleep(1000);
    await pDesktop.eval(() => window.scrollBy(0, 500));
    await sleep(500);
    console.log('Capturing 04_pool_chart_expanded_desktop.png');
    await pDesktop.screenshot({ path: join(QA_DIR, '04_pool_chart_expanded_desktop.png'), format: 'png' });

    // 05 Inbox Invites Desktop
    console.log('Navigating to inbox...');
    await clickByText(pDesktop, 'Inbox');
    await sleep(1500);
    console.log('Capturing 05_inbox_invites_desktop.png');
    await pDesktop.screenshot({ path: join(QA_DIR, '05_inbox_invites_desktop.png'), format: 'png' });

    // 06 Group Confirmed Desktop
    console.log('Navigating to #group...');
    await pDesktop.goto(BASE_URL + '/#group', { settleMs: 1500 });
    await sleep(1000);
    console.log('Capturing 06_group_confirmed_desktop.png');
    await pDesktop.screenshot({ path: join(QA_DIR, '06_group_confirmed_desktop.png'), format: 'png' });

    // 07 Impact Desktop
    console.log('Navigating to Impact...');
    await clickByText(pDesktop, 'Impact');
    await sleep(1000);
    console.log('Capturing 07_impact_desktop.png');
    await pDesktop.screenshot({ path: join(QA_DIR, '07_impact_desktop.png'), format: 'png' });

    // 08 Methodology Desktop
    console.log('Navigating to Methodology...');
    await clickByText(pDesktop, 'Methodology');
    await sleep(1000);
    console.log('Capturing 08_methodology_desktop.png');
    await pDesktop.screenshot({ path: join(QA_DIR, '08_methodology_desktop.png'), format: 'png' });

    await pDesktop.close();

    // -------------------------------------------------------------
    // 2. MOBILE VIEWPORT (390 x 844)
    // -------------------------------------------------------------
    console.log('\n[2/3] Capturing Mobile Viewports (390x844)...');
    const pMobile = await browser.newPage({ width: 390, height: 844, mobile: true });
    await pMobile.goto(BASE_URL, { settleMs: 1500 });

    // 01 Landing Mobile
    console.log('Capturing 01_landing_mobile.png');
    await pMobile.screenshot({ path: join(QA_DIR, '01_landing_mobile.png'), format: 'png' });

    // 02 Check-in Mobile
    console.log('Navigating to Find a cab share (mobile)...');
    await clickByText(pMobile, 'Find a cab share');
    await sleep(1000);
    console.log('Capturing 02_checkin_mobile.png');
    await pMobile.screenshot({ path: join(QA_DIR, '02_checkin_mobile.png'), format: 'png' });

    // Prefill NOW scenario
    console.log('Prefilling demo scenario NOW (mobile)...');
    await clickByText(pMobile, 'Demo');
    await sleep(600);
    await clickByText(pMobile, 'NOW Group (Jayanagar');
    await sleep(1000);

    // Submit ticket
    await pMobile.eval(() => {
      const btn = document.getElementById('submit-ticket-btn');
      if (btn) btn.click();
    });
    await sleep(2500);

    // 03 Pool Mobile
    console.log('Capturing 03_pool_mobile.png');
    await pMobile.screenshot({ path: join(QA_DIR, '03_pool_mobile.png'), format: 'png' });

    // Expand chart on mobile
    await clickByText(pMobile, 'See other options');
    await sleep(1000);
    await pMobile.eval(() => window.scrollBy(0, 450));
    await sleep(500);
    console.log('Capturing 04_pool_chart_mobile.png');
    await pMobile.screenshot({ path: join(QA_DIR, '04_pool_chart_mobile.png'), format: 'png' });

    // 05 Inbox Mobile
    console.log('Navigating to inbox (mobile)...');
    await clickByText(pMobile, 'Inbox');
    await sleep(1500);
    console.log('Capturing 05_inbox_mobile.png');
    await pMobile.screenshot({ path: join(QA_DIR, '05_inbox_mobile.png'), format: 'png' });

    // 06 Group Confirmed Mobile
    console.log('Navigating to #group (mobile)...');
    await pMobile.goto(BASE_URL + '/#group', { settleMs: 1500 });
    await sleep(1000);
    console.log('Capturing 06_group_confirmed_mobile.png');
    await pMobile.screenshot({ path: join(QA_DIR, '06_group_confirmed_mobile.png'), format: 'png' });

    // 07 Impact Mobile
    console.log('Navigating to Impact (mobile)...');
    await clickByText(pMobile, 'Impact');
    await sleep(1000);
    console.log('Capturing 07_impact_mobile.png');
    await pMobile.screenshot({ path: join(QA_DIR, '07_impact_mobile.png'), format: 'png' });

    await pMobile.close();

    // -------------------------------------------------------------
    // 3. 200% ZOOM & ACCESSIBILITY CHECK
    // -------------------------------------------------------------
    console.log('\n[3/3] Checking 200% Zoom Layout Stability...');
    const pZoom = await browser.newPage({ width: 1440, height: 900 });
    await pZoom.goto(BASE_URL, { settleMs: 1500 });
    // Apply 200% zoom scale
    await pZoom.eval(() => {
      document.documentElement.style.zoom = '200%';
    });
    await sleep(1000);

    const hasHorizontalScroll = await pZoom.eval(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`200% Zoom horizontal scroll check: ${hasHorizontalScroll ? 'FAILED (overflow)' : 'PASSED (no horizontal scroll)'}`);

    await pZoom.screenshot({ path: join(QA_DIR, '09_zoom_200_check.png'), format: 'png' });
    await pZoom.close();

    console.log('\n--- All QA Screenshots and Accessibility Checks Completed! ---');
  } finally {
    await browser.close();
  }
}

runQa().catch((err) => {
  console.error('QA script failed:', err);
  process.exit(1);
});
