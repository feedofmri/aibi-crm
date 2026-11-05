import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The simulator is its own website (port 5174). In development /api is proxied
// to the CRM API on :4000; in production set VITE_API_URL to the CRM's URL.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:4000", changeOrigin: true },
    },
  },
  preview: { port: 5174 },
  build: { outDir: "dist", sourcemap: true },
});
