import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so built asset paths work when loaded from the filesystem
  // by Neutralino (no web server) as well as in a normal browser.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": `${import.meta.dirname}/src`,
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2021",
    // Neutralino's `neu build` also writes desktop binaries into
    // dist/<binaryName>/ (dist/KvSpy/). Do NOT let Vite empty the whole
    // outDir — that would delete those binaries (and fails on FUSE mounts).
    // Cleanup is done in the build:desktop npm script instead (rm -rf
    // dist/KvSpy dist/assets): neu re-packages everything under /dist/, so
    // stale outputs there bloat resources.neu across builds.
    emptyOutDir: false,
    // Split node_modules into per-vendor chunks so no single chunk exceeds
    // the 500 kB reporter warning (Mantine/React dominate the bundle).
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // prismjs component files are plain scripts that mutate a bare
              // global `Prism` set by the core, with no import edge between
              // them. The component must live in its own chunk so it is only
              // evaluated via the dynamic import in src/utils/prismMarkup.ts
              // (which exposes the core on globalThis first); sharing a chunk
              // with the core would evaluate it eagerly on static load.
              name: "prism-components",
              test: /node_modules[\\/]prismjs[\\/]components[\\/]/,
              priority: 30,
            },
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: "mantine-vendor",
              test: /node_modules[\\/]@mantine[\\/]/,
              priority: 15,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
