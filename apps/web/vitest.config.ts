import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [
    react(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
