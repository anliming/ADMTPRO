import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const hmrHost = process.env.VITE_HMR_HOST;
const hmrPort = process.env.VITE_HMR_PORT ? Number(process.env.VITE_HMR_PORT) : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    hmr: hmrHost || hmrPort ? { host: hmrHost, port: hmrPort, clientPort: hmrPort } : undefined,
    proxy: {
      "/api": {
        target: "http://api:8000",
        changeOrigin: true
      }
    }
  }
});
