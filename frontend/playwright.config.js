import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', serviceWorkers: 'block' }, // SW would bypass page.route mocks
  webServer: [
    // In-memory MongoDB + demo seed (owner@aran.local / Aran@12345) — dev/test only.
    { command: 'node ../backend/src/server.js', url: 'http://localhost:5000/api/v1/health', reuseExistingServer: true, timeout: 120000, env: { NODE_ENV: 'development', PORT: '5000' } },
    { command: 'npx vite build && npx vite preview --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 180000 },
  ],
});
