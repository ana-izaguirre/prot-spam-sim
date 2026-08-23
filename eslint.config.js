import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Deliberately close to the recommended sets. The point is to catch real
 * mistakes — a missing effect dependency, an unused binding, an unreachable
 * branch — not to enforce a house style, which is Prettier's job.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,

  {
    // Config files run in Node, not in the browser.
    files: ['*.config.{js,mjs,ts}', 'playwright.config.ts', 'scripts/**'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The simulator's step frames are deeply dynamic structures; typing them
      // properly is worthwhile but out of scope for a lint rollout.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // The language/theme provider reconciles with localStorage inside a mount
      // effect on purpose: it is what makes the island safe to prerender (see
      // specs/.../contracts/i18n-theming.md). Restructuring that to satisfy the
      // rule would reintroduce the hydration mismatch it exists to avoid.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
);
