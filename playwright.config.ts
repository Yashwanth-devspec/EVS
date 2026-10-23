import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * End-to-end runs use their own backend (port 8020, a throwaway database, a fixed geocoder and
 * straight-line distances) and their own Vite (port 5190), so they never touch a dev session.
 * Tests run one at a time because they share the demo clock.
 */
const API_PORT = 8020;
const WEB_PORT = 5190;
const DB = join(tmpdir(), `ecoride-e2e-${process.pid}.db`);
const chrome = { browserName: 'chromium' as const, channel: 'chrome' };

export default defineConfig({
  testDir: './e2e',
  timeout: 150_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], ...chrome, deviceScaleFactor: 2 }, testMatch: /(trip|autopilot|homepage)\.spec\.ts/ },
    { name: 'pixel', use: { ...devices['Pixel 7'], ...chrome }, testMatch: /trip\.spec\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...chrome, viewport: { width: 1440, height: 900 } }, testMatch: /(homepage|demo-stage)\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `./venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port ${API_PORT}`,
      url: `http://127.0.0.1:${API_PORT}/health`,
      env: { ECORIDE_DB_PATH: DB, ECORIDE_GEO_FIXTURES: '1', ECORIDE_NO_OSRM: '1' },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { ECORIDE_API: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
