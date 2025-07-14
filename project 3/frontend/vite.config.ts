import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  //   server: {
  //     proxy: {
  //       '/api': 'http://localhost:5050',
  //     },
  //   },
  //   server: {
  //     proxy: {
  //       "/api": {
  //         // target: "http://127.0.0.1:5050", // not localhost
  //         target: "http://localhost:5050", // for local development
  //         changeOrigin: true,
  //         secure: false,
  //       },
  //     },
  //   },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5050",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
