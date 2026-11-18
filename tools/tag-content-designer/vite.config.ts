import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4180,
    strictPort: true,
  },
  build: {
    // Der RTF-Editor (ProseMirror/Tiptap) ist bewusst enthalten; das Tool läuft offline
    // ohne CDN. Tabellen/Drop-/Gapcursor werden nicht gebündelt (siehe SPECIFICATION §12).
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
});

