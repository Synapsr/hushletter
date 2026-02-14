import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

export default defineConfig({
  server: {
    port: 3000,
  },
  ssr: {
    // Bundle @convex-dev/better-auth for SSR compatibility
    // Bundle @hushletter/shared for monorepo imports
    noExternal: ['@convex-dev/better-auth', '@hushletter/shared'],
    // Native modules must not be bundled
    external: ['better-sqlite3'],
  },
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      outputStructure: 'message-modules',
      cookieName: 'PARAGLIDE_LOCALE',
      strategy: ['cookie', 'url', 'preferredLanguage', 'baseLocale'],
      urlPatterns: [
        {
          pattern: '/:path(.*)?',
          localized: [
            ['fr', '/fr/:path(.*)?'],
            ['en', '/:path(.*)?'],
          ],
        },
      ],
    }),
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
      router: {
        routeFileIgnorePattern: '\\.test\\.(tsx?|jsx?)$',
      },
    }),
    nitro({
      preset: 'node-server',
    }),
    viteReact(),
  ],
})
