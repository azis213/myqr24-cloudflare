import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const tcpProxyTarget = process.env.TCC_TCP_PROXY_TARGET ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: {
      "/tcp": {
        target: tcpProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tcp/, ""),
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
