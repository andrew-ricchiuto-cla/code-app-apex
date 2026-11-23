import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { powerApps } from "@microsoft/power-apps-vite/plugin"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), powerApps()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep individual assets small; large single-file uploads get reset by the corporate network.
        manualChunks(id) {
          // Only two vendor chunks, one-directional (charts -> vendor), to avoid circular init order.
          if (!id.includes("node_modules")) return;
          if (/[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return "charts";
          return "vendor";
        },
      },
    },
  },
});
