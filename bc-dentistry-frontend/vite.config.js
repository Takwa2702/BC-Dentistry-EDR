import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { viteCommonjs } from "@originjs/vite-plugin-commonjs"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: { alias: { fs: fileURLToPath(new URL("./src/shims/node-runtime-unavailable.js", import.meta.url)), path: fileURLToPath(new URL("./src/shims/node-runtime-unavailable.js", import.meta.url)) } },
  esbuild: {
    drop: ["console", "debugger"],
  },
  plugins: [
    react(),
    // for dicom-parser
    viteCommonjs(),
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

