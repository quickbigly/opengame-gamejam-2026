import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' keeps asset paths relative so the build works when hosted under any sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
});
