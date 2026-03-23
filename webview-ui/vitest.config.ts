import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    root: '.',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/main.tsx', 'src/types.ts'],
      thresholds: { lines: 80, branches: 75, functions: 80, perFile: true },
    },
    setupFiles: ['src/__tests__/setup.ts'],
  },
});
