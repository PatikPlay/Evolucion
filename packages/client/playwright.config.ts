import { defineConfig } from '@playwright/test';

const PORT = 8790;

export default defineConfig({
  testDir: './e2e',
  timeout: 240_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 860 },
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
        : {}),
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  webServer: {
    command: `pnpm run build && cd ../.. && LINAJE_STATIC=packages/client/dist PORT=${PORT} npx tsx packages/server/src/dev.ts`,
    port: PORT,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
