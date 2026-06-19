import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The merchant-api base URL is injected at build/dev time. Default targets a
// local merchant-api on :3004.
export default defineConfig({
  plugins: [react()],
  define: {
    __MERCHANT_API__: JSON.stringify(process.env.MERCHANT_API_URL ?? "http://localhost:3004"),
  },
  server: { port: 5173 },
});
