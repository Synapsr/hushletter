import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  ssr: {
    // Bundle @convex-dev/better-auth for SSR compatibility
    // Bundle @newsletter-manager/shared for monorepo imports
    noExternal: ['@convex-dev/better-auth', '@newsletter-manager/shared'],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    nitro({
      preset: 'node-server',
    }),
    viteReact(),
  ],
})
