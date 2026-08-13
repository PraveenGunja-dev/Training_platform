/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/training/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@fullcalendar')) return 'vendor-fullcalendar';
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) return 'vendor-recharts';
          if (id.includes('xlsx') || id.includes('papaparse')) return 'vendor-spreadsheet';
          if (id.includes('framer-motion')) return 'vendor-framer';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/training/api": {
        target: "http://localhost:3422",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
  },
});
