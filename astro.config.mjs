// @ts-check
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// ProtSpam HPC Suite — static, client-only educational site.
// See specs/001-protspam-hpc-simulator/plan.md for the migration rationale.
export default defineConfig({
  // No backend, no runtime API: everything is prerendered to plain HTML.
  output: 'static',

  // The deployment origin, used to emit canonical and og:url tags. It comes
  // from the SITE_URL environment variable (set as a repository variable in
  // GitHub Actions) and stays undefined locally, because pointing those tags at
  // localhost is worse than omitting them.
  site: process.env.SITE_URL || undefined,

  // React 19 powers the seven interactive modules, mounted as a single island.
  integrations: [react()],

  // Tailwind 4 ships as a Vite plugin, so it is registered here rather than
  // through the (Tailwind 3 era) @astrojs/tailwind integration.
  vite: {
    plugins: [tailwindcss()],
  },

  server: {
    port: 3000,
    host: true,
  },
});
