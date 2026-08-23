import { defineConfig, devices } from '@playwright/test';

/**
 * One smoke suite against the built site. The point is not coverage: it is to
 * catch the failure mode that type-checking cannot see — the island failing to
 * hydrate, which leaves a page that looks fine in the HTML and does nothing.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: process.env.SMOKE_URL || 'http://localhost:4321',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Escape hatch for images that already ship a browser (some CI runners
        // and sandboxes), so the suite does not have to download its own.
        launchOptions: process.env.CHROMIUM_PATH
          ? { executablePath: process.env.CHROMIUM_PATH }
          : {},
      },
    },
  ],

  // Skipped when SMOKE_URL points at an already-running deployment.
  webServer: process.env.SMOKE_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4321',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
