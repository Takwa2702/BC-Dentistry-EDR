import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"

export default defineConfig({
  server: {
    proxy: {
      "/api/database": { target: "http://localhost:8080", changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/database/, "") },
    },
  },
  resolve: { alias: { fs: fileURLToPath(new URL("./src/shims/node-runtime-unavailable.js", import.meta.url)), path: fileURLToPath(new URL("./src/shims/node-runtime-unavailable.js", import.meta.url)) } },
  esbuild: {
    drop: ["console", "debugger"],
  },
  plugins: [
    react(),
  ],
  // seems like only required in dev mode
  optimizeDeps: {
    exclude: ["@cornerstonejs/dicom-image-loader"],
    include: ["dicom-parser"],
  },
  worker: {
    format: "es",
    rollupOptions: {
      external: ["@icr/polyseg-wasm"],
    },
  },
  build: { chunkSizeWarningLimit: 1200 },
})

