import { defineConfig } from "vite";

// Built into the Hugo site at /xu-town/. In dev, site data and media are
// proxied from a running `hugo server` on :1313.
const hugo = "http://127.0.0.1:1313";

export default defineConfig({
  base: "/xu-town/",
  build: {
    outDir: "../static/xu-town",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    proxy: {
      "/town-data": hugo,
      "/games": hugo,
      "/papers": hugo,
      "/me.jpg": hugo,
    },
  },
});
