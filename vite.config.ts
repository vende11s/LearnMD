import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { offlineBuild } from './scripts/offline';
export default defineConfig({
  plugins: [react(), offlineBuild()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/katex/')) return 'math';
          if (id.includes('/highlight.js/')) return 'code';
          if (
            /\/(react|react-dom|scheduler|dexie|dexie-react-hooks)\//.test(id)
          )
            return 'application';
          if (
            /\/(remark|micromark|mdast|unified|unist|vfile|hast|decode-named)/.test(
              id,
            )
          )
            return 'markdown';
          if (/\/(zod|yaml)\//.test(id)) return 'validation';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
