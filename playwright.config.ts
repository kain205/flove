import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;
const serveExport = `python3 -m http.server ${port} --bind 127.0.0.1 --directory apps/app/dist`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'line' : 'list',
  outputDir: 'test-results/playwright',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.E2E_USE_EXISTING_BUILD
      ? serveExport
      : `npm run build:app:web && ${serveExport}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // The unauthenticated smoke path only reads local auth storage. These
      // compile-time values deliberately point nowhere and require no secret.
      EXPO_PUBLIC_SUPABASE_URL:
        process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'e2e-public-anon-key',
    },
  },
});
